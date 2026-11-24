import { describe, expect, it } from "vitest";
import type { Card } from "../types.ts";
import { countNeedsDetails, draftCard, isListable, needsDetails, nextDraftFlag, runPool } from "./drafts.ts";
import { filterCards } from "./filter.ts";
import { cardProfit, formatCents, formatProfit, summarize } from "./money.ts";
import { parseCard, parseCollection, toPublicCatalog } from "./share.ts";

function full(partial: Partial<Card>): Card {
  return {
    ...draftCard(partial.id ?? "x", "photo-x", partial.updatedAt ?? "2026-01-01T00:00:00.000Z"),
    draft: undefined,
    player: "Patrick Mahomes",
    buyCents: 1000,
    askingCents: 2500,
    ...partial,
  };
}

describe("needs details", () => {
  it("counts only flagged cards without a player; old cards stay normal", () => {
    const cards = [
      draftCard("d1", "p1", "2026-11-23T00:00:00.000Z"),
      draftCard("d2", "p2", "2026-11-23T00:00:01.000Z"),
      { ...draftCard("d3", "p3", "2026-11-23T00:00:02.000Z"), player: "Josh Allen" },
      full({ id: "old", player: "" }),
    ];
    const old = cards[3];
    expect(old.draft).toBeUndefined();
    expect(needsDetails(old)).toBe(false);
    expect(countNeedsDetails(cards)).toBe(2);
    expect(filterCards(cards, "", "needs_details").map((c) => c.id).sort()).toEqual(["d1", "d2"]);
  });

  it("clears the flag once a player is typed", () => {
    expect(nextDraftFlag(true, "")).toBe(true);
    expect(nextDraftFlag(true, "   ")).toBe(true);
    expect(nextDraftFlag(true, "Ja'Marr Chase")).toBe(false);
    expect(nextDraftFlag(undefined, "")).toBe(false);
  });

  it("round-trips the flag through the shelf file without touching older cards", () => {
    const parsed = parseCollection({ version: 1, cards: [draftCard("d", "p", "2026-11-23T00:00:00.000Z"), { id: "legacy", player: "A" }] });
    expect(parsed.cards[0].draft).toBe(true);
    expect("draft" in parsed.cards[1]).toBe(false);
    expect(parseCard({ id: "z", draft: "yes" })?.draft).toBeUndefined();
  });
});

describe("totals with drafts", () => {
  it("never produces NaN with missing or junk prices", () => {
    const junk = { ...full({ id: "junk" }), buyCents: Number.NaN, askingCents: Number.POSITIVE_INFINITY } as Card;
    const cards = [draftCard("d1", "p1", "2026-11-23T00:00:00.000Z"), full({ id: "a" }), junk, full({ id: "s", status: "sold", soldCents: null })];
    const summary = summarize(cards);
    for (const value of Object.values(summary)) expect(Number.isFinite(value)).toBe(true);
    expect(summary.count).toBe(4);
    expect(summary.needsDetailsCount).toBe(1);
    expect(summary.costCents).toBe(1000);
    expect(summary.askingCents).toBe(2500);
    expect(summary.missingCost).toBe(2);
    expect(summary.realizedCents).toBe(0);
    expect(cardProfit(junk).cents).toBeNull();
    expect(formatProfit(cardProfit(cards[0]))).toBeNull();
    expect(formatCents(Number.NaN)).toBe("—");
  });

  it("sorts drafts alongside cards without crashing on blank dates", () => {
    const cards = [draftCard("d", "p", ""), full({ id: "a", updatedAt: "2026-06-01T00:00:00.000Z" })];
    expect(filterCards(cards, "", "all").map((c) => c.id)).toEqual(["a", "d"]);
    expect(filterCards(cards, "mahomes", "all").map((c) => c.id)).toEqual(["a"]);
  });
});

describe("buyer link excludes drafts", () => {
  it("leaves out for-sale drafts until they have a player", () => {
    const forSaleDraft = { ...draftCard("d", "p", "2026-11-23T00:00:00.000Z"), status: "for_sale" as const, askingCents: 500 };
    const finished = { ...forSaleDraft, id: "done", player: "Bo Nix" };
    const ready = full({ id: "ready", status: "for_sale" });
    expect(isListable(forSaleDraft)).toBe(false);
    expect(isListable(finished)).toBe(true);
    const catalog = toPublicCatalog([forSaleDraft, finished, ready], (card) => `u/${card.id}`);
    expect(catalog.cards.map((c) => c.id)).toEqual(["done", "ready"]);
    expect(JSON.stringify(catalog)).not.toContain("draft");
  });
});

describe("runPool", () => {
  it("keeps going after a failure, limits concurrency, and reports progress", async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    const items = Array.from({ length: 10 }, (_, i) => i);
    const failures = await runPool(
      items,
      3,
      async (item) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        if (item === 2 || item === 7) throw new Error(`bad ${item}`);
      },
      (finished) => seen.push(finished),
    );
    expect(peak).toBe(3);
    expect(failures.map((f) => [f.index, f.message])).toEqual([[2, "bad 2"], [7, "bad 7"]]);
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("handles an empty pick", async () => {
    expect(await runPool([], 3, async () => undefined)).toEqual([]);
  });
});
