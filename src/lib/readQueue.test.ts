import { describe, expect, it } from "vitest";
import type { Card } from "../types.ts";
import { applyRead, draftCard, isReading, markFailed, needsDetails, needsPrices, queueAll, readFailed } from "./drafts.ts";
import { readErrorKind, RELAY_QUOTA_MESSAGE, type Identification } from "./gemini.ts";
import { summarize } from "./money.ts";
import { parseCollection, toPublicCatalog } from "./share.ts";
import { runReadQueue, type ReadQueueDeps } from "./readQueue.ts";

const READ: Identification = { player: "Bo Nix", year: "2024", setName: "Panini Prizm", cardNumber: "#301", parallel: "Silver", grade: "", source: "gemini" };
const pending = (id: string): Card => ({ ...draftCard(id, `p-${id}`, "2026-11-24T00:00:00.000Z"), readState: "pending" });

function harness(cards: Card[], read: (card: Card, call: number, fallback: boolean) => Promise<Identification>) {
  let shelf = cards;
  const sleeps: number[] = [];
  const calls: string[] = [];
  const models: boolean[] = [];
  const backoffs: (number | null)[] = [];
  const deps: ReadQueueDeps = {
    next: () => shelf.find(isReading) ?? null,
    waiting: () => shelf.filter(isReading).length,
    read: (card, fallback) => {
      calls.push(card.id);
      models.push(fallback);
      return read(card, calls.length, fallback);
    },
    saveRead: async (card, result) => {
      shelf = shelf.map((item) => (item.id === card.id ? applyRead(item, result) : item));
    },
    saveFailed: async (card) => {
      shelf = shelf.map((item) => (item.id === card.id ? markFailed(item) : item));
    },
    classify: readErrorKind,
    onBackoff: (ms) => backoffs.push(ms),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    shouldStop: () => false,
    pacing: { gapMs: 8000, bigGapMs: 10000, bigBatch: 3, calmGapMs: 15000, retryMs: 8000, backoffMs: [30000, 60000, 120000, 300000] },
  };
  return { deps, sleeps, calls, models, backoffs, shelf: () => shelf };
}

describe("applyRead", () => {
  it("fills blank fields only and moves the card to Needs prices", () => {
    const typed = { ...pending("a"), year: "2025", notes: "show" };
    const next = applyRead(typed, READ);
    expect(next.player).toBe("Bo Nix");
    expect(next.year).toBe("2025");
    expect(next.cardNumber).toBe("301");
    expect(next.notes).toBe("show");
    expect(next.draft).toBeUndefined();
    expect(next.readState).toBeUndefined();
    expect(needsDetails(next)).toBe(false);
    expect(needsPrices(next)).toBe(true);
  });

  it("keeps a typed player and marks Couldn't read when the read finds no player", () => {
    expect(applyRead({ ...pending("a"), player: "Mine" }, READ).player).toBe("Mine");
    const blank = applyRead(pending("b"), { ...READ, player: "", setName: "Topps" });
    expect(readFailed(blank)).toBe(true);
    expect(needsDetails(blank)).toBe(true);
    expect(blank.setName).toBe("Topps");
  });
});

describe("needs prices", () => {
  it("clears once paid and asking (or sold) prices are in; older cards never show", () => {
    const read = applyRead(pending("a"), READ);
    expect(needsPrices({ ...read, buyCents: 500 })).toBe(true);
    expect(needsPrices({ ...read, buyCents: 500, askingCents: 900 })).toBe(false);
    expect(needsPrices({ ...read, buyCents: 500, status: "sold", soldCents: 800 })).toBe(false);
    const legacy = { ...read, bulk: undefined };
    expect(needsPrices(legacy)).toBe(false);
    const summary = summarize([read, pending("b")]);
    expect(summary.needsPricesCount).toBe(1);
    expect(summary.needsDetailsCount).toBe(1);
    for (const value of Object.values(summary)) expect(Number.isFinite(value)).toBe(true);
  });

  it("lists a read card for sale on the buyer link, never a pending one", () => {
    const read = { ...applyRead(pending("a"), READ), status: "for_sale" as const };
    const waiting = { ...pending("b"), status: "for_sale" as const };
    expect(toPublicCatalog([read, waiting], () => "u").cards.map((c) => c.id)).toEqual(["a"]);
  });

  it("saves and reloads the queue flags", () => {
    const parsed = parseCollection({ version: 1, cards: [pending("a"), { ...pending("b"), readState: "failed" }, { ...pending("c"), readState: "weird" }] });
    expect(parsed.cards.map((c) => c.readState)).toEqual(["pending", "failed", undefined]);
    expect(parsed.cards.every((c) => c.bulk === true)).toBe(true);
  });
});

describe("queueAll", () => {
  it("queues stored and failed drafts, skipping finished and waiting cards", () => {
    const stored = draftCard("s", "p", "");
    const failed = { ...draftCard("f", "p", ""), readState: "failed" as const };
    const done = applyRead(pending("d"), READ);
    const { cards, queued } = queueAll([stored, failed, done, pending("w")]);
    expect(queued).toBe(2);
    expect(cards.filter(isReading).map((c) => c.id)).toEqual(["s", "f", "w"]);
    expect(cards[2]).toBe(done);
  });
});

const BUSY = "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.";

describe("readErrorKind", () => {
  it("sorts free-limit, busy, and photo errors", () => {
    expect(readErrorKind(new Error(RELAY_QUOTA_MESSAGE))).toBe("quota");
    expect(readErrorKind(new Error("Gemini's free limit is used up for the moment."))).toBe("quota");
    expect(readErrorKind(new Error(BUSY))).toBe("busy");
    expect(readErrorKind(new Error("The card scanner took too long to answer."))).toBe("busy");
    expect(readErrorKind(new TypeError("Failed to fetch"))).toBe("busy");
    expect(readErrorKind(new Error("Gemini did not return card details."))).toBe("other");
  });
});

describe("runReadQueue", () => {
  it("reads one at a time, spacing calls 8s apart and 10s for a big batch", async () => {
    let active = 0;
    let peak = 0;
    const h = harness(["a", "b", "c", "d", "e"].map(pending), async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return READ;
    });
    expect(await runReadQueue(h.deps)).toEqual({ kind: "done" });
    expect(peak).toBe(1);
    expect(h.calls).toEqual(["a", "b", "c", "d", "e"]);
    // 4 waiting (> bigBatch 3) uses the big gap, then the normal gap.
    expect(h.sleeps).toEqual([10000, 8000, 8000, 8000]);
    expect(h.shelf().every((c) => !needsDetails(c) && needsPrices(c))).toBe(true);
  });

  it("rides out a busy scanner with back-off, alternating to the backup model, and keeps going", async () => {
    const h = harness([pending("a"), pending("b")], async (_card, call) => {
      if (call <= 2) throw new Error(BUSY);
      if (call === 3) throw new Error(RELAY_QUOTA_MESSAGE);
      return READ;
    });
    expect(await runReadQueue(h.deps)).toEqual({ kind: "done" });
    expect(h.calls).toEqual(["a", "a", "a", "a", "b"]);
    expect(h.models).toEqual([false, true, false, true, false]);
    // 30s, 1m, 2m back-off, then a calmer 15s gap for the rest of the run.
    expect(h.sleeps).toEqual([30000, 60000, 120000, 15000]);
    expect(h.backoffs).toEqual([30000, 60000, 120000, null]);
    expect(h.shelf().every((c) => c.player === "Bo Nix")).toBe(true);
  });

  it("pauses as the daily cap only after every back-off still hits the limit, leaving cards waiting", async () => {
    const h = harness([pending("a"), pending("b")], async () => {
      throw new Error(RELAY_QUOTA_MESSAGE);
    });
    const end = await runReadQueue(h.deps);
    expect(end).toMatchObject({ kind: "paused", reason: "daily" });
    expect(h.calls).toEqual(["a", "a", "a", "a", "a"]);
    expect(h.sleeps).toEqual([30000, 60000, 120000, 300000]);
    expect(h.shelf().filter(isReading).length).toBe(2);
  });

  it("pauses as busy (not daily) when Google stays overloaded", async () => {
    const h = harness([pending("a")], async () => {
      throw new Error(BUSY);
    });
    expect(await runReadQueue(h.deps)).toMatchObject({ kind: "paused", reason: "busy" });
    expect(isReading(h.shelf()[0])).toBe(true);
  });

  it("retries a photo error once, then marks Couldn't read and moves on", async () => {
    const h = harness([pending("a"), pending("b")], async (card) => {
      if (card.id === "a") throw new Error("Gemini did not return card details.");
      return READ;
    });
    expect(await runReadQueue(h.deps)).toEqual({ kind: "done" });
    expect(h.calls).toEqual(["a", "a", "b"]);
    expect(h.sleeps).toEqual([8000, 8000]);
    expect(readFailed(h.shelf()[0])).toBe(true);
    expect(h.shelf()[1].player).toBe("Bo Nix");
  });

  it("times out a stuck read, retries, then moves on", async () => {
    const h = harness([pending("a"), pending("b")], (card, call) =>
      card.id === "a" && call === 1 ? new Promise<Identification>(() => undefined) : Promise.resolve(READ),
    );
    h.deps.pacing = { ...h.deps.pacing, timeoutMs: 20 };
    expect(await runReadQueue(h.deps)).toEqual({ kind: "done" });
    expect(h.calls).toEqual(["a", "a", "b"]);
    expect(h.shelf().every((c) => c.player === "Bo Nix")).toBe(true);
  });

  it("stops when asked and doesn't loop forever if a save doesn't stick", async () => {
    const stop = harness([pending("a")], async () => READ);
    stop.deps.shouldStop = () => true;
    expect(await runReadQueue(stop.deps)).toEqual({ kind: "stopped" });
    expect(stop.calls).toEqual([]);

    const stuck = harness([pending("a")], async () => READ);
    stuck.deps.saveRead = async () => undefined;
    const end = await runReadQueue(stuck.deps);
    expect(end).toMatchObject({ kind: "paused", reason: "save" });
    expect(stuck.calls).toEqual(["a"]);
  });
});
