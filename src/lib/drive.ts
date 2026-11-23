import type { Card } from "../types.ts";
import { parseCollection } from "./share.ts";

const APP = "ssc";

export class AuthError extends Error {
  constructor(message = "Google signed you out. Sign in again, then retry.") {
    super(message);
    this.name = "AuthError";
  }
}

interface DriveFile {
  id: string;
}

export interface ShelfFiles {
  folderId: string;
  collectionId: string;
  cards: Card[];
  shareFileId: string | null;
}

export interface DriveSettings {
  version: 1;
  geminiKey: string;
  geminiModel: string;
}

async function googleMessage(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message || response.statusText || `Google request failed (${response.status})`;
  } catch {
    return response.statusText || `Google request failed (${response.status})`;
  }
}

async function authed(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) throw new AuthError();
  return response;
}

async function listFiles(token: string, query: string): Promise<DriveFile[]> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("fields", "files(id,name)");
  const response = await authed(token, url.toString());
  if (!response.ok) throw new Error(await googleMessage(response));
  const json = (await response.json()) as { files?: DriveFile[] };
  return json.files ?? [];
}

function roleQuery(role: string): string {
  return `trashed=false and appProperties has { key='app' and value='${APP}' } and appProperties has { key='role' and value='${role}' }`;
}

export async function findByRole(token: string, role: string): Promise<string | null> {
  const files = await listFiles(token, roleQuery(role));
  return files[0]?.id ?? null;
}

function multipart(metadata: unknown, media: Blob | string, mediaType: string): { body: Blob; contentType: string } {
  const boundary = "ssc_boundary";
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mediaType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  return { body: new Blob([head, media, tail]), contentType: `multipart/related; boundary=${boundary}` };
}

async function createFolder(token: string): Promise<string> {
  const response = await authed(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Stemp's Sports Cards",
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { app: APP, role: "root" },
    }),
  });
  if (!response.ok) throw new Error(await googleMessage(response));
  const json = (await response.json()) as { id: string };
  return json.id;
}

export async function ensureFolder(token: string): Promise<string> {
  return (await findByRole(token, "root")) ?? (await createFolder(token));
}

export async function writeJson(
  token: string,
  options: { id: string | null; name: string; folderId: string; role: string; data: unknown },
): Promise<string> {
  const text = JSON.stringify(options.data);
  if (options.id) {
    const response = await authed(token, `https://www.googleapis.com/upload/drive/v3/files/${options.id}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: text,
    });
    if (!response.ok) throw new Error(await googleMessage(response));
    return options.id;
  }
  const packed = multipart(
    {
      name: options.name,
      parents: [options.folderId],
      mimeType: "application/json",
      appProperties: { app: APP, role: options.role },
    },
    text,
    "application/json",
  );
  const response = await authed(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { "Content-Type": packed.contentType },
    body: packed.body,
  });
  if (!response.ok) throw new Error(await googleMessage(response));
  const json = (await response.json()) as { id: string };
  return json.id;
}

export async function readJson<T>(token: string, id: string): Promise<T> {
  const response = await authed(token, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { cache: "no-store" });
  if (!response.ok) throw new Error(await googleMessage(response));
  return (await response.json()) as T;
}

export async function uploadPhoto(token: string, folderId: string, cardId: string, blob: Blob): Promise<string> {
  const packed = multipart(
    {
      name: `${cardId}.jpg`,
      parents: [folderId],
      mimeType: "image/jpeg",
      appProperties: { app: APP, role: "photo", cardId },
    },
    blob,
    "image/jpeg",
  );
  const response = await authed(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { "Content-Type": packed.contentType },
    body: packed.body,
  });
  if (!response.ok) throw new Error(await googleMessage(response));
  const json = (await response.json()) as { id: string };
  return json.id;
}

export async function downloadFile(token: string, id: string): Promise<Blob> {
  const response = await authed(token, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  if (!response.ok) throw new Error(await googleMessage(response));
  return response.blob();
}

export async function deleteFile(token: string, id: string): Promise<void> {
  const response = await authed(token, `https://www.googleapis.com/drive/v3/files/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(await googleMessage(response));
}

export async function shareAnyone(token: string, fileId: string): Promise<void> {
  const response = await authed(token, `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "anyone", role: "reader" }),
  });
  if (response.ok) return;
  const message = await googleMessage(response);
  if (/already exists|duplicate/i.test(message)) return;
  throw new Error(message);
}

export async function unshareAnyone(token: string, fileId: string): Promise<void> {
  const response = await authed(token, `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,type)`);
  if (!response.ok) throw new Error(await googleMessage(response));
  const json = (await response.json()) as { permissions?: { id: string; type: string }[] };
  for (const permission of json.permissions ?? []) {
    if (permission.type !== "anyone") continue;
    const removed = await authed(token, `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${permission.id}`, {
      method: "DELETE",
    });
    if (!removed.ok && removed.status !== 404) throw new Error(await googleMessage(removed));
  }
}

let inflight: { token: string; promise: Promise<ShelfFiles> } | null = null;

export function openShelf(token: string): Promise<ShelfFiles> {
  if (inflight?.token === token) return inflight.promise;
  const promise = openShelfNow(token).finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { token, promise };
  return promise;
}

async function openShelfNow(token: string): Promise<ShelfFiles> {
  const folderId = await ensureFolder(token);
  let collectionId = await findByRole(token, "collection");
  let cards: Card[] = [];
  if (!collectionId) {
    collectionId = await writeJson(token, {
      id: null,
      name: "collection.json",
      folderId,
      role: "collection",
      data: { version: 1, cards: [] },
    });
  } else {
    cards = parseCollection(await readJson<unknown>(token, collectionId)).cards;
  }
  const shareFileId = await findByRole(token, "share");
  return { folderId, collectionId, cards, shareFileId };
}

export async function readSettings(token: string): Promise<DriveSettings | null> {
  const id = await findByRole(token, "settings");
  if (!id) return null;
  const raw = await readJson<Partial<DriveSettings>>(token, id);
  return {
    version: 1,
    geminiKey: typeof raw.geminiKey === "string" ? raw.geminiKey : "",
    geminiModel: typeof raw.geminiModel === "string" ? raw.geminiModel : "",
  };
}

export async function writeSettings(token: string, folderId: string, settings: DriveSettings): Promise<void> {
  const id = await findByRole(token, "settings");
  await writeJson(token, { id, name: "settings.json", folderId, role: "settings", data: settings });
}
