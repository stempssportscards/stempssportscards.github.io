import type { Card, CardStatus } from "../types.ts";

export function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/[$,\s]/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  const cents = Number(dollars) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isFinite(cents) || cents > 1_000_000_000) return null;
  return cents;
}

export function centsToInput(cents: number | null): string {
  if (cents == null) return "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rest = abs % 100;
  const body = rest === 0 ? String(dollars) : `${dollars}.${String(rest).padStart(2, "0")}`;
  return cents < 0 ? `-${body}` : body;
}

export function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export interface Profit {
  kind: "realized" | "potential";
  cents: number | null;
}

export function cardProfit(card: {
  status: CardStatus;
  buyCents: number | null;
  askingCents: number | null;
  soldCents: number | null;
}): Profit {
  if (card.status === "sold") {
    if (card.soldCents == null || card.buyCents == null) return { kind: "realized", cents: null };
    return { kind: "realized", cents: card.soldCents - card.buyCents };
  }
  if (card.askingCents == null || card.buyCents == null) return { kind: "potential", cents: null };
  return { kind: "potential", cents: card.askingCents - card.buyCents };
}

export function formatProfit(profit: Profit): string | null {
  if (profit.cents == null) return null;
  if (profit.kind === "realized" && profit.cents < 0) return `Loss ${formatCents(Math.abs(profit.cents))}`;
  if (profit.kind === "realized") return `Profit ${formatCents(profit.cents)}`;
  return `Potential ${formatCents(profit.cents)}`;
}

export interface ShelfSummary {
  count: number;
  ownedCount: number;
  forSaleCount: number;
  soldCount: number;
  costCents: number;
  askingCents: number;
  realizedCents: number;
  missingCost: number;
  missingAsking: number;
}

export function summarize(cards: Card[]): ShelfSummary {
  let ownedCount = 0;
  let forSaleCount = 0;
  let soldCount = 0;
  let costCents = 0;
  let askingCents = 0;
  let realizedCents = 0;
  let missingCost = 0;
  let missingAsking = 0;

  for (const card of cards) {
    if (card.status === "sold") {
      soldCount += 1;
      const profit = cardProfit(card);
      if (profit.cents != null) realizedCents += profit.cents;
      continue;
    }
    if (card.status === "for_sale") forSaleCount += 1;
    else ownedCount += 1;
    if (card.buyCents == null) missingCost += 1;
    else costCents += card.buyCents;
    if (card.askingCents == null) missingAsking += 1;
    else askingCents += card.askingCents;
  }

  return {
    count: cards.length,
    ownedCount,
    forSaleCount,
    soldCount,
    costCents,
    askingCents,
    realizedCents,
    missingCost,
    missingAsking,
  };
}
