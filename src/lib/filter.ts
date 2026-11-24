import type { Card, CardStatus } from "../types.ts";
import { needsDetails, needsPrices } from "./drafts.ts";

export type StatusFilter = "all" | CardStatus | "needs_details" | "needs_prices";

export function filterCards(cards: Card[], query: string, status: StatusFilter): Card[] {
  const needle = query.trim().toLowerCase().replace(/^#/, "");
  return cards
    .filter((card) => {
      if (status === "needs_details") {
        if (!needsDetails(card)) return false;
      } else if (status === "needs_prices") {
        if (!needsPrices(card)) return false;
      } else if (status !== "all" && card.status !== status) return false;
      if (!needle) return true;
      const number = card.cardNumber.replace(/^#/, "");
      const haystack = [card.player, card.year, card.setName, number, `#${number}`, card.parallel, card.grade, card.notes]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    })
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
