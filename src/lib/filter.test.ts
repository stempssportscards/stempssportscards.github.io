import { describe, expect, it } from "vitest";
import type { Card } from "../types.ts";
import { filterCards } from "./filter.ts";

function card(partial: Partial<Card>): Card {
  return {
    id: partial.id ?? "1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
    photoId: "p",
    player: partial.player ?? "Patrick Mahomes",
    year: partial.year ?? "2020",
    setName: partial.setName ?? "Panini Prizm",
    cardNumber: partial.cardNumber ?? "1",
    parallel: partial.parallel ?? "Silver",
    grade: partial.grade ?? "",
    notes: partial.notes ?? "",
    buyCents: null,
    askingCents: null,
    soldCents: null,
    soldDate: null,
    status: partial.status ?? "owned",
    photoShared: false,
  };
}

describe("filterCards", () => {
  const cards = [
    card({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z", player: "Josh Allen", status: "owned" }),
    card({ id: "new", updatedAt: "2026-06-01T00:00:00.000Z", player: "Patrick Mahomes", status: "for_sale", cardNumber: "15" }),
    card({ id: "sold", updatedAt: "2026-03-01T00:00:00.000Z", player: "CeeDee Lamb", status: "sold", grade: "PSA 10" }),
  ];

  it("filters by status and searches player, number, and grade", () => {
    expect(filterCards(cards, "", "for_sale").map((c) => c.id)).toEqual(["new"]);
    expect(filterCards(cards, "lamb", "all").map((c) => c.id)).toEqual(["sold"]);
    expect(filterCards(cards, "#15", "all").map((c) => c.id)).toEqual(["new"]);
    expect(filterCards(cards, "psa 10", "sold").map((c) => c.id)).toEqual(["sold"]);
  });

  it("shows the newest edit first", () => {
    expect(filterCards(cards, "", "all").map((c) => c.id)).toEqual(["new", "sold", "old"]);
  });
});
