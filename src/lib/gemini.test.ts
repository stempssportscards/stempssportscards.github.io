import { describe, expect, it } from "vitest";
import { mockIdentification, parseIdentification } from "./gemini.ts";

describe("parseIdentification", () => {
  it("reads a fenced JSON reply and drops the hash on the card number", () => {
    const parsed = parseIdentification(`Here you go:
\`\`\`json
{"player":"CeeDee Lamb","year":"2023","setName":"Donruss","cardNumber":"#88","parallel":"Base","grade":""}
\`\`\``);
    expect(parsed).toEqual({
      player: "CeeDee Lamb",
      year: "2023",
      setName: "Donruss",
      cardNumber: "88",
      parallel: "Base",
      grade: "",
    });
  });

  it("accepts set and variant aliases", () => {
    const parsed = parseIdentification('{"player":"A","year":"2024","set":"Topps Chrome","cardNumber":"1","variant":"Refractor","grade":"PSA 9"}');
    expect(parsed.setName).toBe("Topps Chrome");
    expect(parsed.parallel).toBe("Refractor");
    expect(parsed.grade).toBe("PSA 9");
  });

  it("rejects a reply that is not card JSON", () => {
    expect(() => parseIdentification("I think this is a football card.")).toThrow(/card details/);
  });
});

describe("mockIdentification", () => {
  it("fills a labeled sample the user can edit", () => {
    const sample = mockIdentification();
    expect(sample.source).toBe("mock");
    expect(sample.player).toBe("Sample Player");
    expect(sample.grade).toBe("");
  });
});
