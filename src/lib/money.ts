import type { Card, CardStatus } from "../types.ts";
import { needsDetails, needsPrices } from "./drafts.ts";

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
  if (cents == null || !Number.isFinite(cents)) return "—";
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
  const buy = safe(card.buyCents);
  if (card.status === "sold") {
    const sold = safe(card.soldCents);
    if (sold == null || buy == null) return { kind: "realized", cents: null };
    return { kind: "realized", cents: sold - buy };
  }
  const asking = safe(card.askingCents);
  if (asking == null || buy == null) return { kind: "potential", cents: null };
  return { kind: "potential", cents: asking - buy };
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
  needsDetailsCount: number;
  needsPricesCount: number;
}

function safe(cents: number | null | undefined): number | null {
  return typeof cents === "number" && Number.isFinite(cents) ? cents : null;
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
  let needsDetailsCount = 0;
  let needsPricesCount = 0;

  for (const card of cards) {
    if (needsDetails(card)) needsDetailsCount += 1;
    if (needsPrices(card)) needsPricesCount += 1;
    if (card.status === "sold") {
      soldCount += 1;
      const profit = cardProfit(card);
      if (profit.cents != null) realizedCents += profit.cents;
      continue;
    }
    if (card.status === "for_sale") forSaleCount += 1;
    else ownedCount += 1;
    const buy = safe(card.buyCents);
    const asking = safe(card.askingCents);
    if (buy == null) missingCost += 1;
    else costCents += buy;
    if (asking == null) missingAsking += 1;
    else askingCents += asking;
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
    needsDetailsCount,
    needsPricesCount,
  };
}
