import type { Card } from "../types.ts";
import type { Identification } from "./gemini.ts";

export interface ReadQueueDeps {
  /** The next card waiting to be read, from the latest shelf, or null when none are left. */
  next: () => Card | null;
  read: (card: Card) => Promise<Identification>;
  /** Apply a successful read to the latest copy of the card and save the shelf. */
  saveRead: (card: Card, read: Identification) => Promise<void>;
  /** Mark the card "Couldn't read" and save the shelf. */
  saveFailed: (card: Card, message: string) => Promise<void>;
  isQuota: (error: unknown) => boolean;
  sleep: (ms: number) => Promise<void>;
  shouldStop: () => boolean;
  onStart?: (card: Card) => void;
  onDone?: (card: Card, ok: boolean) => void;
  gapMs?: number;
  retryMs?: number;
  quotaRetryMs?: number;
  /** Give up on one read after this long so a stuck request can't freeze the queue. */
  timeoutMs?: number;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The card scanner took too long to answer.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type ReadQueueEnd = { kind: "done" } | { kind: "stopped" } | { kind: "paused"; message: string };

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read cards one at a time with a pause between calls so the free scanner isn't flooded.
 * A failure is retried once after a back-off. A free-limit error pauses the whole queue and
 * leaves the card waiting so it resumes later; any other repeat failure marks "Couldn't read".
 */
export async function runReadQueue(deps: ReadQueueDeps): Promise<ReadQueueEnd> {
  const gap = deps.gapMs ?? 4000;
  const retry = deps.retryMs ?? 8000;
  const quotaRetry = deps.quotaRetryMs ?? 30000;
  const timeout = deps.timeoutMs ?? 90000;
  const tried = new Set<string>();
  let first = true;
  for (;;) {
    if (deps.shouldStop()) return { kind: "stopped" };
    const card = deps.next();
    if (!card) return { kind: "done" };
    if (tried.has(card.id)) {
      // Saving didn't clear it (for example the shelf write failed). Stop instead of looping.
      return { kind: "paused", message: "Couldn't save the card details. Reading will try again next time." };
    }
    tried.add(card.id);
    if (!first) await deps.sleep(gap);
    first = false;
    if (deps.shouldStop()) return { kind: "stopped" };
    deps.onStart?.(card);
    let lastError: unknown = null;
    let result: Identification | null = null;
    for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
      if (attempt > 0) {
        await deps.sleep(deps.isQuota(lastError) ? quotaRetry : retry);
        if (deps.shouldStop()) return { kind: "stopped" };
      }
      try {
        result = await withTimeout(deps.read(card), timeout);
      } catch (error) {
        lastError = error;
      }
    }
    if (result) {
      try {
        await deps.saveRead(card, result);
      } catch (error) {
        deps.onDone?.(card, false);
        return { kind: "paused", message: message(error) };
      }
      deps.onDone?.(card, Boolean(result.player.trim()));
      continue;
    }
    if (deps.isQuota(lastError)) {
      deps.onDone?.(card, false);
      return { kind: "paused", message: message(lastError) };
    }
    try {
      await deps.saveFailed(card, message(lastError));
    } catch (error) {
      deps.onDone?.(card, false);
      return { kind: "paused", message: message(error) };
    }
    deps.onDone?.(card, false);
  }
}
