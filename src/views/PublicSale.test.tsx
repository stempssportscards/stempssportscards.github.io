import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readPublicCatalog } from "../lib/share.ts";
import { PublicSale } from "./PublicSale.tsx";

describe("PublicSale", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the asking price and hides cost, profit, notes, and sold data", () => {
    const catalog = readPublicCatalog({
      updatedAt: "2026-11-23T00:00:00.000Z",
      cards: [
        {
          id: "1",
          player: "Patrick Mahomes",
          year: "2020",
          setName: "Panini Prizm",
          cardNumber: "15",
          parallel: "Silver",
          grade: "PSA 10",
          askingCents: 2500,
          photoUrl: "",
          buyCents: 1000,
          soldCents: 4000,
          notes: "secret cost note",
          profit: 3000,
          email: "seller@example.com",
        },
      ],
    });
    render(<PublicSale catalog={catalog} />);
    const logo = screen.getByRole("img", { name: "Stemp's Sports Cards" });
    expect(logo.className).toContain("brand");
    expect(logo.className).toContain("moderate");
    expect(logo.getAttribute("src")).toContain("wordmark.png");
    expect(screen.getByRole("heading", { name: "Patrick Mahomes" })).toBeTruthy();
    expect(screen.getByTestId("asking").textContent).toBe("$25.00");
    expect(screen.getByText(/2020 · Panini Prizm · #15 · Silver · PSA 10/)).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/secret cost note/);
    expect(text).not.toMatch(/seller@example.com/);
    expect(text).not.toMatch(/\$10\.00/);
    expect(text).not.toMatch(/\$40\.00/);
    expect(text).not.toMatch(/profit/i);
    expect(text).not.toMatch(/cost/i);
    expect(text).not.toMatch(/paid/i);
    expect(document.body.innerHTML).not.toMatch(/github\.com|github\.io|michaeldnbaker/i);
  });
});
