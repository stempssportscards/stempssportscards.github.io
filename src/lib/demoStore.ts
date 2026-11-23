import type { Card, PublicCatalog } from "../types.ts";
import { parseCollection } from "./share.ts";

const COLLECTION_KEY = "ssc.demo.collection.v1";
export const DEMO_SHARE_KEY = "ssc.demo.share.v1";

const memory = new Map<string, Blob>();

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ssc", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("photos")) request.result.createObjectStore("photos");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open photo storage on this phone."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the photo on this phone."));
    tx.onabort = () => reject(tx.error ?? new Error("Could not save the photo on this phone."));
  });
}

export async function demoPutPhoto(id: string, blob: Blob): Promise<void> {
  if (!idbAvailable()) {
    memory.set(id, blob);
    return;
  }
  const db = await openDb();
  const tx = db.transaction("photos", "readwrite");
  tx.objectStore("photos").put(blob, id);
  await txDone(tx);
  db.close();
}

export async function demoGetPhoto(id: string): Promise<Blob | null> {
  if (!idbAvailable()) return memory.get(id) ?? null;
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction("photos", "readonly");
    const request = tx.objectStore("photos").get(id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not open the photo."));
  });
  db.close();
  return blob;
}

export async function demoDeletePhoto(id: string): Promise<void> {
  memory.delete(id);
  if (!idbAvailable()) return;
  const db = await openDb();
  const tx = db.transaction("photos", "readwrite");
  tx.objectStore("photos").delete(id);
  await txDone(tx);
  db.close();
}

export function loadDemoCards(): Card[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (!raw) return [];
    return parseCollection(JSON.parse(raw)).cards;
  } catch {
    return [];
  }
}

export function saveDemoCards(cards: Card[]): void {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify({ version: 1, cards }));
  } catch {
    throw new Error("This phone is out of room for the demo. Remove a card, or sign in with Google.");
  }
}

export function loadDemoShare(): PublicCatalog | null {
  try {
    const raw = localStorage.getItem(DEMO_SHARE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicCatalog;
  } catch {
    return null;
  }
}

export function saveDemoShare(catalog: PublicCatalog): void {
  try {
    localStorage.setItem(DEMO_SHARE_KEY, JSON.stringify(catalog));
  } catch {
    throw new Error("The demo buyer link is too large for this phone. Remove a for-sale photo or sign in with Google.");
  }
}
