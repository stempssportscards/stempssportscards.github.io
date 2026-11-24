import type { Card } from "../types.ts";
import type { Identification } from "./gemini.ts";

/** A bulk-uploaded photo that still has no player or title. Older cards (no draft flag) never count. */
export function needsDetails(card: Pick<Card, "draft" | "player">): boolean {
  return card.draft === true && !(card.player ?? "").trim();
}

export function countNeedsDetails(cards: Pick<Card, "draft" | "player">[]): number {
  let count = 0;
  for (const card of cards) if (needsDetails(card)) count += 1;
  return count;
}

/** Cards a buyer may see: marked for sale and not waiting on details. */
export function isListable(card: Pick<Card, "status" | "draft" | "player">): boolean {
  return card.status === "for_sale" && !needsDetails(card);
}

/** Keep the draft flag only while the card still has no player/title. */
export function nextDraftFlag(wasDraft: boolean | undefined, player: string): boolean {
  return wasDraft === true && !player.trim();
}

/** A batch card that has its details but is still missing the purchase price or the sale/asking price. */
export function needsPrices(card: Pick<Card, "draft" | "bulk" | "player" | "status" | "buyCents" | "askingCents" | "soldCents">): boolean {
  if (card.bulk !== true || needsDetails(card)) return false;
  const missing = (value: number | null | undefined) => typeof value !== "number" || !Number.isFinite(value);
  if (missing(card.buyCents)) return true;
  return card.status === "sold" ? missing(card.soldCents) : missing(card.askingCents);
}

export function isReading(card: Pick<Card, "draft" | "player" | "readState">): boolean {
  return card.readState === "pending" && needsDetails(card);
}

export function readFailed(card: Pick<Card, "draft" | "player" | "readState">): boolean {
  return card.readState === "failed" && needsDetails(card);
}

const READ_FIELDS = ["player", "year", "setName", "cardNumber", "parallel", "grade"] as const;

/**
 * Merge a card read into the latest copy of a card. Only blank fields are filled, so anything
 * typed by hand wins. A read with no player leaves the card in Needs details as "Couldn't read".
 */
export function applyRead(card: Card, read: Omit<Identification, "source">): Card {
  const next: Card = { ...card };
  for (const key of READ_FIELDS) {
    const incoming = (read[key] ?? "").trim();
    if (!next[key].trim() && incoming) next[key] = key === "cardNumber" ? incoming.replace(/^#/, "") : incoming;
  }
  delete next.readState;
  if (!next.player.trim()) {
    next.readState = "failed";
    return next;
  }
  delete next.draft;
  next.bulk = true;
  return next;
}

export function markFailed(card: Card): Card {
  if (!needsDetails(card)) {
    const next = { ...card };
    delete next.readState;
    return next;
  }
  return { ...card, readState: "failed" };
}

/** Queue every Needs-details card that isn't already waiting (including ones that failed before). */
export function queueAll(cards: Card[]): { cards: Card[]; queued: number } {
  let queued = 0;
  const next = cards.map((card) => {
    if (!needsDetails(card) || card.readState === "pending") return card;
    queued += 1;
    return { ...card, readState: "pending" as const };
  });
  return { cards: next, queued };
}

export function draftCard(id: string, photoId: string, at: string): Card {
  return {
    id,
    createdAt: at,
    updatedAt: at,
    photoId,
    player: "",
    year: "",
    setName: "",
    cardNumber: "",
    parallel: "",
    grade: "",
    notes: "",
    buyCents: null,
    askingCents: null,
    soldCents: null,
    soldDate: null,
    status: "owned",
    photoShared: false,
    draft: true,
    bulk: true,
  };
}

export interface PoolFailure<T> {
  item: T;
  index: number;
  message: string;
}

/**
 * Run `worker` over `items`, at most `limit` at a time, in order. One failure never stops the rest.
 * `onSettled` fires after each item with how many are finished so far.
 */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
  onSettled?: (finished: number, total: number) => void,
): Promise<PoolFailure<T>[]> {
  const failures: PoolFailure<T>[] = [];
  let next = 0;
  let finished = 0;
  const lanes = Math.max(1, Math.min(limit, items.length));
  async function lane(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      try {
        await worker(item, index);
      } catch (reason) {
        failures.push({ item, index, message: reason instanceof Error ? reason.message : String(reason) });
      }
      finished += 1;
      onSettled?.(finished, items.length);
    }
  }
  await Promise.all(Array.from({ length: lanes }, () => lane()));
  return failures.sort((a, b) => a.index - b.index);
}
