import { afterEach, describe, expect, it, vi } from "vitest";
import { identifyCard, mockIdentification, parseIdentification, RELAY_QUOTA_MESSAGE } from "./gemini.ts";

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

describe("identifyCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses a personal key before the relay", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '{"player":"A","year":"2024","setName":"Prizm","cardNumber":"1","parallel":"Base","grade":""}' }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await identifyCard(new Blob(["x"], { type: "image/jpeg" }), {
      apiKey: "personal-key",
      relayUrl: "https://relay.example/exec",
    });
    expect(result.source).toBe("gemini");
    expect(result.player).toBe("A");
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("personal-key");
  });

  it("posts to the relay as text/plain when there is no personal key", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://relay.example/exec");
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("text/plain");
      const body = JSON.parse(String(init?.body ?? ""));
      expect(body.image).toBeTypeOf("string");
      expect(body.mimeType).toBe("image/jpeg");
      expect(body.prompt).toMatch(/sports trading card/);
      expect(body.model).toBe("gemini-3.5-flash-lite");
      return new Response(
        JSON.stringify({
          ok: true,
          status: 200,
          data: {
            candidates: [
              {
                content: {
                  parts: [{ text: '{"player":"B","year":"2023","setName":"Chrome","cardNumber":"2","parallel":"Refractor","grade":"PSA 10"}' }],
                },
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await identifyCard(new Blob(["x"], { type: "image/jpeg" }), { relayUrl: "https://relay.example/exec" });
    expect(result.source).toBe("gemini");
    expect(result.player).toBe("B");
    expect(result.grade).toBe("PSA 10");
  });

  it("tells the user to add a key in Settings when the shared scanner is out of quota", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false, status: 429, error: "quota" }), { status: 200 })),
    );
    await expect(identifyCard(new Blob(["x"], { type: "image/jpeg" }), { relayUrl: "https://relay.example/exec" })).rejects.toThrow(
      RELAY_QUOTA_MESSAGE,
    );
  });

  it("falls back to the sample read when there is no key and no relay", async () => {
    const result = await identifyCard(new Blob(["x"], { type: "image/jpeg" }), {});
    expect(result).toEqual(mockIdentification());
  });
});
