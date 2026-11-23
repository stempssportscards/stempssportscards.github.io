import type { Card, CollectionFile, PublicCard, PublicCatalog } from "../types.ts";

const STATUSES = new Set(["owned", "for_sale", "sold"]);

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cents(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

export function parseCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  const status = STATUSES.has(String(record.status)) ? (record.status as Card["status"]) : "owned";
  return {
    id: record.id,
    createdAt: str(record.createdAt) || new Date(0).toISOString(),
    updatedAt: str(record.updatedAt) || new Date(0).toISOString(),
    photoId: str(record.photoId),
    player: str(record.player),
    year: str(record.year),
    setName: str(record.setName),
    cardNumber: str(record.cardNumber),
    parallel: str(record.parallel),
    grade: str(record.grade),
    notes: str(record.notes),
    buyCents: cents(record.buyCents),
    askingCents: cents(record.askingCents),
    soldCents: cents(record.soldCents),
    soldDate: typeof record.soldDate === "string" ? record.soldDate : null,
    status,
    photoShared: record.photoShared === true,
  };
}

export function parseCollection(raw: unknown): CollectionFile {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { cards?: unknown }).cards)) {
    throw new Error("The shelf file is not a card collection. Nothing was overwritten.");
  }
  const cards = (raw as { cards: unknown[] }).cards.map(parseCard).filter((card): card is Card => card != null);
  return { version: 1, cards };
}

export function publicPhotoUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1600`;
}

export function toPublicCatalog(cards: Card[], photoUrl: (card: Card) => string, updatedAt = new Date().toISOString()): PublicCatalog {
  const listed: PublicCard[] = [];
  for (const card of cards) {
    if (card.status !== "for_sale") continue;
    listed.push({
      id: card.id,
      player: card.player,
      year: card.year,
      setName: card.setName,
      cardNumber: card.cardNumber,
      parallel: card.parallel,
      grade: card.grade,
      askingCents: card.askingCents,
      photoUrl: photoUrl(card),
    });
  }
  return { version: 1, title: "Stemp's Sports Cards", updatedAt, cards: listed };
}

/** Rebuild a buyer catalog from a file, keeping only public fields even if the file was edited by hand. */
export function readPublicCatalog(raw: unknown): PublicCatalog {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const incoming = Array.isArray(record.cards) ? record.cards : [];
  const cards: PublicCard[] = [];
  for (const item of incoming) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    cards.push({
      id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
      player: str(row.player),
      year: str(row.year),
      setName: str(row.setName),
      cardNumber: str(row.cardNumber),
      parallel: str(row.parallel),
      grade: str(row.grade),
      askingCents: cents(row.askingCents),
      photoUrl: str(row.photoUrl),
    });
  }
  return {
    version: 1,
    title: "Stemp's Sports Cards",
    updatedAt: str(record.updatedAt) || new Date().toISOString(),
    cards,
  };
}

export function shareHash(fileId: string): string {
  return `#/s/${encodeURIComponent(fileId)}`;
}
