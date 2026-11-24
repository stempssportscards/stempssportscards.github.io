import type { Card } from "../types.ts";

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
