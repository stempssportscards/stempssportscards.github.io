import type { Card } from "../types.ts";
import type { Identification, ReadErrorKind } from "./gemini.ts";

export interface ReadQueueDeps {
  /** The next card waiting to be read, from the latest shelf, or null when none are left. */
  next: () => Card | null;
  /** How many cards are still waiting (used to slow down for big batches). */
  waiting?: () => number;
  /** Read one card. `fallback` asks for the backup free model. */
  read: (card: Card, fallback: boolean) => Promise<Identification>;
  /** Apply a successful read to the latest copy of the card and save the shelf. */
  saveRead: (card: Card, read: Identification) => Promise<void>;
  /** Mark the card "Couldn't read" and save the shelf. */
  saveFailed: (card: Card, message: string) => Promise<void>;
  classify: (error: unknown) => ReadErrorKind;
  sleep: (ms: number) => Promise<void>;
  shouldStop: () => boolean;
  onStart?: (card: Card) => void;
  onDone?: (card: Card, ok: boolean) => void;
  /** Called with the wait before a retry when the scanner is busy, and null once it's moving again. */
  onBackoff?: (ms: number | null) => void;
  pacing?: Partial<Pacing>;
}

export interface Pacing {
  /** Gap between cards for a small batch. */
  gapMs: number;
  /** Gap between cards once a batch is large. */
  bigGapMs: number;
  /** Batches with more waiting cards than this use bigGapMs. */
  bigBatch: number;
  /** Gap after the scanner has been busy during this run. */
  calmGapMs: number;
  /** Retry once after this for an error about the photo itself. */
  retryMs: number;
  /** Waits before each retry while the scanner is busy or rate limited. */
  backoffMs: number[];
  /** Give up on one read after this long so a stuck request can't freeze the queue. */
  timeoutMs: number;
}

/**
 * The shared free model allows about 15 reads a minute per project (shared by everyone using the
 * app). 8–10 seconds between cards plus the read itself keeps one phone near 4–5 a minute.
 */
export const DEFAULT_PACING: Pacing = {
  gapMs: 8000,
  bigGapMs: 10000,
  bigBatch: 10,
  calmGapMs: 15000,
  retryMs: 8000,
  backoffMs: [30000, 60000, 120000, 300000],
  timeoutMs: 90000,
};

export type ReadQueueEnd = { kind: "done" } | { kind: "stopped" } | { kind: "paused"; reason: "daily" | "busy" | "save"; message: string };

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

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read cards one at a time, paced to stay under the free per-minute limit.
 * - Busy / overloaded / per-minute limit: wait 30s, 1m, 2m, 5m (switching to the backup model on
 *   alternate tries) and keep going on its own.
 * - Still rate limited after all that: treat it as the daily cap and pause.
 * - An error about the photo itself: retry once, then mark "Couldn't read" and move on.
 */
export async function runReadQueue(deps: ReadQueueDeps): Promise<ReadQueueEnd> {
  const pace: Pacing = { ...DEFAULT_PACING, ...deps.pacing };
  const tried = new Set<string>();
  let first = true;
  let calm = false;
  for (;;) {
    if (deps.shouldStop()) return { kind: "stopped" };
    const card = deps.next();
    if (!card) return { kind: "done" };
    if (tried.has(card.id)) {
      // Saving didn't clear it (for example the shelf write failed). Stop instead of looping.
      return { kind: "paused", reason: "save", message: "Couldn't save the card details." };
    }
    tried.add(card.id);
    if (!first) {
      const waiting = deps.waiting?.() ?? 0;
      await deps.sleep(calm ? pace.calmGapMs : waiting > pace.bigBatch ? pace.bigGapMs : pace.gapMs);
      if (deps.shouldStop()) return { kind: "stopped" };
    }
    first = false;
    deps.onStart?.(card);

    let result: Identification | null = null;
    let lastError: unknown = null;
    let lastKind: ReadErrorKind = "other";
    let otherRetries = 0;
    let backoffStep = 0;
    let fallback = false;
    for (;;) {
      try {
        result = await withTimeout(deps.read(card, fallback), pace.timeoutMs);
        break;
      } catch (error) {
        lastError = error;
        lastKind = deps.classify(error);
      }
      let wait: number;
      if (lastKind === "other") {
        if (otherRetries >= 1) break;
        otherRetries += 1;
        wait = pace.retryMs;
      } else {
        if (backoffStep >= pace.backoffMs.length) break;
        wait = pace.backoffMs[backoffStep];
        backoffStep += 1;
        calm = true;
        // Alternate to the backup model; it has its own free quota and demand.
        fallback = !fallback;
        deps.onBackoff?.(wait);
      }
      await deps.sleep(wait);
      if (deps.shouldStop()) {
        deps.onBackoff?.(null);
        return { kind: "stopped" };
      }
    }
    if (backoffStep > 0) deps.onBackoff?.(null);

    if (result) {
      try {
        await deps.saveRead(card, result);
      } catch (error) {
        deps.onDone?.(card, false);
        return { kind: "paused", reason: "save", message: message(error) };
      }
      deps.onDone?.(card, Boolean(result.player.trim()));
      continue;
    }
    if (lastKind === "quota") {
      deps.onDone?.(card, false);
      return { kind: "paused", reason: "daily", message: message(lastError) };
    }
    if (lastKind === "busy") {
      deps.onDone?.(card, false);
      return { kind: "paused", reason: "busy", message: message(lastError) };
    }
    try {
      await deps.saveFailed(card, message(lastError));
    } catch (error) {
      deps.onDone?.(card, false);
      return { kind: "paused", reason: "save", message: message(error) };
    }
    deps.onDone?.(card, false);
  }
}
