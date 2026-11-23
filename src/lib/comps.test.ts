import { describe, expect, it } from "vitest";
import { compQuery, ebaySoldUrl, point130Url } from "./comps.ts";

const card = {
  player: "Patrick Mahomes",
  year: "2020",
  setName: "Panini Prizm",
  cardNumber: "#1",
  parallel: "Silver",
  grade: "PSA 10",
};

describe("comp links", () => {
  it("builds a search for that exact card", () => {
    expect(compQuery(card)).toBe("2020 Panini Prizm Patrick Mahomes #1 Silver PSA 10");
  });

  it("opens eBay sold and completed listings", () => {
    const url = new URL(ebaySoldUrl(compQuery(card)));
    expect(url.hostname).toBe("www.ebay.com");
    expect(url.pathname).toBe("/sch/i.html");
    expect(url.searchParams.get("LH_Sold")).toBe("1");
    expect(url.searchParams.get("LH_Complete")).toBe("1");
    expect(url.searchParams.get("_sacat")).toBe("261328");
    expect(url.searchParams.get("_nkw")).toContain("Patrick Mahomes");
    expect(url.searchParams.get("_nkw")).toContain("#1");
    expect(url.searchParams.get("_nkw")).toContain("PSA 10");
  });

  it("opens a 130point search", () => {
    const url = new URL(point130Url(compQuery(card)));
    expect(url.hostname).toBe("www.130point.com");
    expect(url.pathname).toBe("/cards/");
    expect(url.searchParams.get("q")).toBe("2020 Panini Prizm Patrick Mahomes #1 Silver PSA 10");
  });
});
