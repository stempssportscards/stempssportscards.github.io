import { describe, expect, it } from "vitest";
import type { Card } from "../types.ts";
import { cardProfit, centsToInput, dollarsToCents, formatCents, formatProfit, summarize } from "./money.ts";

function card(partial: Partial<Card>): Card {
  return {
    id: "1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    photoId: "p",
    player: "A",
    year: "2024",
    setName: "Prizm",
    cardNumber: "1",
    parallel: "",
    grade: "",
    notes: "",
    buyCents: null,
    askingCents: null,
    soldCents: null,
    soldDate: null,
    status: "owned",
    photoShared: false,
    ...partial,
  };
}

describe("dollarsToCents", () => {
  it("parses plain, decimal, and dollar amounts", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("0")).toBe(0);
    expect(dollarsToCents("10")).toBe(1000);
    expect(dollarsToCents("10.5")).toBe(1050);
    expect(dollarsToCents("10.")).toBe(1000);
    expect(dollarsToCents("$1,250.25")).toBe(125025);
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents("10.999")).toBeNull();
  });

  it("round-trips an input", () => {
    expect(centsToInput(1000)).toBe("10");
    expect(centsToInput(1050)).toBe("10.50");
    expect(centsToInput(null)).toBe("");
    expect(dollarsToCents(centsToInput(1050))).toBe(1050);
  });
});

describe("cardProfit", () => {
  it("uses sold minus buy once a card is sold", () => {
    const profit = cardProfit({ status: "sold", buyCents: 1000, askingCents: 1800, soldCents: 2500 });
    expect(profit).toEqual({ kind: "realized", cents: 1500 });
    expect(formatProfit(profit)).toBe("Profit $15.00");
  });

  it("shows a loss when it sold for less than it cost", () => {
    const profit = cardProfit({ status: "sold", buyCents: 1000, askingCents: null, soldCents: 500 });
    expect(formatProfit(profit)).toBe("Loss $5.00");
  });

  it("uses asking minus buy as potential while the card is still held", () => {
    const owned = cardProfit({ status: "owned", buyCents: 1000, askingCents: 1800, soldCents: null });
    const listed = cardProfit({ status: "for_sale", buyCents: 1000, askingCents: 1800, soldCents: 9999 });
    expect(owned).toEqual({ kind: "potential", cents: 800 });
    expect(listed).toEqual({ kind: "potential", cents: 800 });
    expect(formatProfit(owned)).toBe("Potential $8.00");
  });

  it("stays blank until both prices exist", () => {
    expect(cardProfit({ status: "sold", buyCents: 1000, askingCents: null, soldCents: null }).cents).toBeNull();
    expect(cardProfit({ status: "for_sale", buyCents: null, askingCents: 1800, soldCents: null }).cents).toBeNull();
    expect(formatProfit({ kind: "potential", cents: null })).toBeNull();
  });

  it("formats currency", () => {
    expect(formatCents(null)).toBe("—");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(2599)).toBe("$25.99");
  });
});

describe("summarize", () => {
  it("totals cost and asking for held cards, and realized profit for sold cards", () => {
    const summary = summarize([
      card({ id: "a", status: "owned", buyCents: 1000, askingCents: 1500 }),
      card({ id: "b", status: "for_sale", buyCents: 2000, askingCents: 2500 }),
      card({ id: "c", status: "sold", buyCents: 500, soldCents: 2000 }),
      card({ id: "d", status: "owned", buyCents: null, askingCents: null }),
    ]);
    expect(summary.count).toBe(4);
    expect(summary.ownedCount).toBe(2);
    expect(summary.forSaleCount).toBe(1);
    expect(summary.soldCount).toBe(1);
    expect(summary.costCents).toBe(3000);
    expect(summary.askingCents).toBe(4000);
    expect(summary.realizedCents).toBe(1500);
    expect(summary.missingCost).toBe(1);
    expect(summary.missingAsking).toBe(1);
  });
});
