import type { Card, CardStatus } from "../types.ts";

export type StatusFilter = "all" | CardStatus;

export function filterCards(cards: Card[], query: string, status: StatusFilter): Card[] {
  const needle = query.trim().toLowerCase().replace(/^#/, "");
  return cards
    .filter((card) => {
      if (status !== "all" && card.status !== status) return false;
      if (!needle) return true;
      const number = card.cardNumber.replace(/^#/, "");
      const haystack = [card.player, card.year, card.setName, number, `#${number}`, card.parallel, card.grade, card.notes]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
