import { describe, expect, it } from "vitest";
import type { Card } from "../types.ts";
import { readPublicCatalog, toPublicCatalog } from "./share.ts";

function card(partial: Partial<Card>): Card {
  return {
    id: partial.id ?? "1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    photoId: partial.photoId ?? "file-1",
    player: partial.player ?? "Patrick Mahomes",
    year: "2020",
    setName: "Panini Prizm",
    cardNumber: "15",
    parallel: "Silver",
    grade: "PSA 10",
    notes: partial.notes ?? "paid cash at the show, gemini-key-secret",
    buyCents: partial.buyCents ?? 1000,
    askingCents: partial.askingCents ?? 2500,
    soldCents: partial.soldCents ?? 4000,
    soldDate: "2026-05-01",
    status: partial.status ?? "for_sale",
    photoShared: true,
  };
}

describe("buyer catalog", () => {
  it("publishes only for-sale cards and drops cost, profit, notes, and sold data", () => {
    const catalog = toPublicCatalog(
      [
        card({ id: "sale", status: "for_sale" }),
        card({ id: "kept", status: "owned" }),
        card({ id: "gone", status: "sold" }),
      ],
      (item) => `https://photos.example/${item.photoId}`,
      "2026-11-23T00:00:00.000Z",
    );
    const text = JSON.stringify(catalog);
    expect(catalog.cards.map((item) => item.id)).toEqual(["sale"]);
    expect(catalog.cards[0]).toEqual({
      id: "sale",
      player: "Patrick Mahomes",
      year: "2020",
      setName: "Panini Prizm",
      cardNumber: "15",
      parallel: "Silver",
      grade: "PSA 10",
      askingCents: 2500,
      photoUrl: "https://photos.example/file-1",
    });
    expect(text).not.toContain("buyCents");
    expect(text).not.toContain("soldCents");
    expect(text).not.toContain("notes");
    expect(text).not.toContain("gemini-key-secret");
    expect(text).not.toContain("profit");
    expect(text).not.toContain("1000");
    expect(text).not.toContain("4000");
    expect(text).toContain("2500");
  });

  it("strips private fields if a published file was hand-edited", () => {
    const catalog = readPublicCatalog({
      updatedAt: "2026-11-23T00:00:00.000Z",
      cards: [
        {
          id: "1",
          player: "CeeDee Lamb",
          year: "2023",
          setName: "Donruss",
          cardNumber: "88",
          parallel: "",
          grade: "",
          askingCents: 500,
          photoUrl: "https://photos.example/1",
          buyCents: 999,
          soldCents: 5000,
          notes: "secret cost note",
          profit: 4001,
          email: "seller@example.com",
        },
      ],
    });
    const text = JSON.stringify(catalog);
    expect(text).not.toContain("999");
    expect(text).not.toContain("5000");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("profit");
    expect(text).not.toContain("seller@example.com");
    expect(catalog.cards[0]?.askingCents).toBe(500);
    expect(catalog.title).toBe("Stemp's Sports Cards");
  });
});
