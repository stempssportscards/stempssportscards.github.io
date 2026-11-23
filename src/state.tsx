import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadFileConfig, type FileConfig } from "./lib/config.ts";
import { demoDeletePhoto, demoGetPhoto, demoPutPhoto, loadDemoCards, loadDemoShare, saveDemoCards, saveDemoShare } from "./lib/demoStore.ts";
import {
  AuthError,
  deleteFile,
  downloadFile,
  openShelf,
  readSettings,
  shareAnyone,
  unshareAnyone,
  uploadPhoto,
  writeJson,
  writeSettings,
} from "./lib/drive.ts";
import { DEFAULT_GEMINI_MODEL } from "./lib/gemini.ts";
import { blobToDataUrl } from "./lib/images.ts";
import { shareHash, toPublicCatalog } from "./lib/share.ts";
import { clearMode, clearToken, fetchProfile, markDemo, readDemoFlag, readToken, requestGoogleToken, writeToken, type StoredToken } from "./lib/session.ts";
import type { Card, CardInput, PublicCatalog } from "./types.ts";

const CLIENT_ID = "ssc.googleClientId";
const API_KEY = "ssc.googleApiKey";
const GEMINI_KEY = "ssc.geminiKey";
const GEMINI_MODEL = "ssc.geminiModel";
const GEMINI_DRIVE = "ssc.geminiInDrive";

export interface PublishResult {
  url: string;
  warning: string | null;
}

interface LibraryValue {
  mode: "signed-out" | "demo" | "drive";
  loading: boolean;
  error: string | null;
  needsReauth: boolean;
  name: string;
  email: string;
  cards: Card[];
  shareFileId: string | null;
  clientId: string;
  apiKey: string;
  apiKeyFromFile: boolean;
  geminiKey: string;
  geminiModel: string;
  saveGeminiToDrive: boolean;
  geminiFromDrive: boolean;
  geminiRelayUrl: string;
  setClientId: (value: string) => void;
  setApiKey: (value: string) => void;
  setGeminiKey: (value: string) => void;
  setGeminiModel: (value: string) => void;
  setSaveGeminiToDrive: (value: boolean) => void;
  signIn: () => Promise<void>;
  enterDemo: () => void;
  signOut: () => void;
  reload: () => Promise<void>;
  saveCard: (input: CardInput) => Promise<string>;
  deleteCard: (id: string) => Promise<void>;
  publish: () => Promise<PublishResult>;
  photoSrc: (photoId: string) => string | null;
  ensurePhoto: (photoId: string) => Promise<string | null>;
  getPhotoBlob: (photoId: string) => Promise<Blob | null>;
  persistGemini: () => Promise<string>;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function useLibrary(): LibraryValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibrary must be used inside the shelf.");
  return value;
}

function storageGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function storageSet(key: string, value: string): void {
  localStorage.setItem(key, value);
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LibraryValue["mode"]>("signed-out");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [token, setToken] = useState<StoredToken | null>(null);
  const [fileConfig, setFileConfig] = useState<FileConfig>({ googleClientId: "", googleApiKey: "", geminiRelayUrl: "" });
  const [clientId, setClientIdState] = useState("");
  const [apiKeyLocal, setApiKeyLocal] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState(DEFAULT_GEMINI_MODEL);
  const [saveGeminiToDrive, setSaveGeminiToDrive] = useState(false);
  const [geminiFromDrive, setGeminiFromDrive] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const photos = useRef(new Map<string, string>());
  const folderId = useRef<string | null>(null);
  const collectionId = useRef<string | null>(null);
  const tokenRef = useRef<StoredToken | null>(null);
  const cardsRef = useRef<Card[]>([]);
  const modeRef = useRef(mode);
  tokenRef.current = token;
  cardsRef.current = cards;
  modeRef.current = mode;

  function rememberPhoto(id: string, blob: Blob): string {
    const previous = photos.current.get(id);
    if (previous) URL.revokeObjectURL(previous);
    const url = URL.createObjectURL(blob);
    photos.current.set(id, url);
    setPhotoVersion((version) => version + 1);
    return url;
  }

  async function loadDrive(accessToken: string, keepLocalGemini: boolean): Promise<void> {
    setLoading(true);
    setError(null);
    const shelf = await openShelf(accessToken);
    folderId.current = shelf.folderId;
    collectionId.current = shelf.collectionId;
    setShareFileId(shelf.shareFileId);
    setCards(shelf.cards);
    setNeedsReauth(false);
    if (!keepLocalGemini) {
      const settings = await readSettings(accessToken);
      if (settings?.geminiKey) {
        setGeminiKey(settings.geminiKey);
        if (settings.geminiModel) setGeminiModel(settings.geminiModel);
        setGeminiFromDrive(true);
        setSaveGeminiToDrive(true);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      const file = await loadFileConfig();
      if (cancel) return;
      setFileConfig(file);
      const localClient = storageGet(CLIENT_ID);
      const localApi = storageGet(API_KEY);
      const envClient = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
      const envApi = (import.meta.env.VITE_GOOGLE_API_KEY ?? "").trim();
      setClientIdState(localClient || file.googleClientId || envClient);
      setApiKeyLocal(localApi || envApi);
      const storedGemini = storageGet(GEMINI_KEY);
      setGeminiKey(storedGemini);
      setGeminiModel(storageGet(GEMINI_MODEL) || DEFAULT_GEMINI_MODEL);
      setSaveGeminiToDrive(storageGet(GEMINI_DRIVE) === "1");
      const stored = readToken();
      if (stored) {
        setToken(stored);
        setMode("drive");
        try {
          await loadDrive(stored.accessToken, Boolean(storedGemini));
        } catch (reason) {
          if (cancel) return;
          if (reason instanceof AuthError) setNeedsReauth(true);
          setError(reason instanceof Error ? reason.message : "Could not open your Drive folder.");
          setLoading(false);
        }
        return;
      }
      if (readDemoFlag()) {
        setMode("demo");
        setCards(loadDemoCards());
        setShareFileId(loadDemoShare() ? "demo" : null);
      }
      setLoading(false);
    })().catch((reason) => {
      if (cancel) return;
      setError(reason instanceof Error ? reason.message : "Could not start.");
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
    // Boot once. Later reloads go through reload().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(next: Card[]): Promise<void> {
    if (modeRef.current === "demo") {
      saveDemoCards(next);
      setCards(next);
      return;
    }
    const current = tokenRef.current;
    const folder = folderId.current;
    if (!current || !folder) throw new Error("Sign in again before saving.");
    try {
      const id = await writeJson(current.accessToken, {
        id: collectionId.current,
        name: "collection.json",
        folderId: folder,
        role: "collection",
        data: { version: 1, cards: next },
      });
      collectionId.current = id;
      setCards(next);
    } catch (reason) {
      if (reason instanceof AuthError) setNeedsReauth(true);
      throw reason;
    }
  }

  const apiKey = fileConfig.googleApiKey || apiKeyLocal;

  const value = useMemo<LibraryValue>(() => {
    void photoVersion;
    return {
      mode,
      loading,
      error,
      needsReauth,
      name: token?.name ?? (mode === "demo" ? "Demo on this phone" : ""),
      email: token?.email ?? "",
      cards,
      shareFileId,
      clientId,
      apiKey,
      apiKeyFromFile: Boolean(fileConfig.googleApiKey),
      geminiKey,
      geminiModel,
      saveGeminiToDrive,
      geminiFromDrive,
      geminiRelayUrl: fileConfig.geminiRelayUrl,
      setClientId: (next) => {
        const trimmed = next.trim();
        setClientIdState(trimmed);
        storageSet(CLIENT_ID, trimmed);
      },
      setApiKey: (next) => {
        const trimmed = next.trim();
        setApiKeyLocal(trimmed);
        storageSet(API_KEY, trimmed);
      },
      setGeminiKey,
      setGeminiModel,
      setSaveGeminiToDrive,
      signIn: async () => {
        const id = (localStorage.getItem(CLIENT_ID) || clientId || fileConfig.googleClientId).trim();
        if (!id) throw new Error("Add the Google OAuth client ID first. The steps are in Settings.");
        setError(null);
        const granted = await requestGoogleToken(id);
        const profile = await fetchProfile(granted.accessToken);
        const stored: StoredToken = {
          accessToken: granted.accessToken,
          expiresAt: Date.now() + granted.expiresIn * 1000,
          email: profile.email,
          name: profile.name,
        };
        writeToken(stored);
        setToken(stored);
        setMode("drive");
        await loadDrive(stored.accessToken, Boolean(storageGet(GEMINI_KEY)));
      },
      enterDemo: () => {
        markDemo();
        setToken(null);
        setMode("demo");
        setNeedsReauth(false);
        setError(null);
        setCards(loadDemoCards());
        setShareFileId(loadDemoShare() ? "demo" : null);
        setLoading(false);
      },
      signOut: () => {
        clearMode();
        clearToken();
        setToken(null);
        setMode("signed-out");
        setCards([]);
        setShareFileId(null);
        setNeedsReauth(false);
        setError(null);
        folderId.current = null;
        collectionId.current = null;
      },
      reload: async () => {
        const current = tokenRef.current;
        if (!current) return;
        try {
          await loadDrive(current.accessToken, true);
        } catch (reason) {
          if (reason instanceof AuthError) setNeedsReauth(true);
          setError(reason instanceof Error ? reason.message : "Could not reload.");
          setLoading(false);
        }
      },
      saveCard: async (input) => {
        const now = new Date().toISOString();
        const existing = input.id ? cardsRef.current.find((card) => card.id === input.id) : undefined;
        const id = existing?.id ?? crypto.randomUUID();
        let photoId = existing?.photoId ?? "";
        let photoShared = existing?.photoShared ?? false;
        if (!input.photo && !photoId) throw new Error("Add a photo of the card.");
        if (input.photo) {
          if (modeRef.current === "demo") {
            photoId = photoId || crypto.randomUUID();
            await demoPutPhoto(photoId, input.photo);
            rememberPhoto(photoId, input.photo);
          } else {
            const current = tokenRef.current;
            const folder = folderId.current;
            if (!current || !folder) throw new Error("Sign in again before saving.");
            const uploaded = await uploadPhoto(current.accessToken, folder, id, input.photo);
            if (photoId && photoId !== uploaded) {
              if (photoShared) await unshareAnyone(current.accessToken, photoId).catch(() => undefined);
              await deleteFile(current.accessToken, photoId).catch(() => undefined);
            }
            photoId = uploaded;
            photoShared = false;
            rememberPhoto(photoId, input.photo);
          }
        }
        const card: Card = {
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          photoId,
          player: input.player.trim(),
          year: input.year.trim(),
          setName: input.setName.trim(),
          cardNumber: input.cardNumber.trim().replace(/^#/, ""),
          parallel: input.parallel.trim(),
          grade: input.grade.trim(),
          notes: input.notes.trim(),
          buyCents: input.buyCents,
          askingCents: input.askingCents,
          soldCents: input.status === "sold" ? input.soldCents : null,
          soldDate: input.status === "sold" ? input.soldDate : null,
          status: input.status,
          photoShared,
        };
        const next = existing ? cardsRef.current.map((item) => (item.id === id ? card : item)) : [card, ...cardsRef.current];
        await persist(next);
        return id;
      },
      deleteCard: async (id) => {
        const card = cardsRef.current.find((item) => item.id === id);
        if (!card) return;
        if (modeRef.current === "demo") {
          await demoDeletePhoto(card.photoId);
        } else {
          const current = tokenRef.current;
          if (!current) throw new Error("Sign in again before removing a card.");
          if (card.photoShared) await unshareAnyone(current.accessToken, card.photoId).catch(() => undefined);
          await deleteFile(current.accessToken, card.photoId).catch(() => undefined);
        }
        const previous = photos.current.get(card.photoId);
        if (previous) URL.revokeObjectURL(previous);
        photos.current.delete(card.photoId);
        await persist(cardsRef.current.filter((item) => item.id !== id));
      },
      publish: async () => {
        const origin = `${window.location.origin}${window.location.pathname}`;
        if (modeRef.current === "demo") {
          const urls = new Map<string, string>();
          for (const card of cardsRef.current) {
            if (card.status !== "for_sale") continue;
            const blob = await demoGetPhoto(card.photoId);
            urls.set(card.id, blob ? await blobToDataUrl(blob) : "");
          }
          const catalog: PublicCatalog = toPublicCatalog(cardsRef.current, (card) => urls.get(card.id) ?? "");
          saveDemoShare(catalog);
          setShareFileId("demo");
          return {
            url: `${origin}${shareHash("demo")}`,
            warning: "This demo link only opens on this phone. Sign in with Google for a link other people can open.",
          };
        }
        const current = tokenRef.current;
        const folder = folderId.current;
        if (!current || !folder) throw new Error("Sign in again before publishing.");
        const next: Card[] = [];
        for (const card of cardsRef.current) {
          if (card.status === "for_sale") {
            await shareAnyone(current.accessToken, card.photoId);
            next.push({ ...card, photoShared: true });
          } else if (card.photoShared) {
            await unshareAnyone(current.accessToken, card.photoId);
            next.push({ ...card, photoShared: false });
          } else {
            next.push(card);
          }
        }
        await persist(next);
        const catalog = toPublicCatalog(next, (card) => `https://lh3.googleusercontent.com/d/${encodeURIComponent(card.photoId)}=w1600`);
        const fileId = await writeJson(current.accessToken, {
          id: shareFileId,
          name: "for-sale.json",
          folderId: folder,
          role: "share",
          data: catalog,
        });
        await shareAnyone(current.accessToken, fileId);
        setShareFileId(fileId);
        const warning = fileConfig.googleApiKey
          ? null
          : apiKey
            ? "This phone can open the link. Other people cannot until the Google API key is in public/config.json and the site is rebuilt."
            : "Buyers cannot open this link yet. Add the Google API key in Settings, and put the same key in public/config.json before you redeploy.";
        return { url: `${origin}${shareHash(fileId)}`, warning };
      },
      photoSrc: (photoId) => photos.current.get(photoId) ?? null,
      ensurePhoto: async (photoId) => {
        if (!photoId) return null;
        const cached = photos.current.get(photoId);
        if (cached) return cached;
        if (modeRef.current === "demo") {
          const blob = await demoGetPhoto(photoId);
          return blob ? rememberPhoto(photoId, blob) : null;
        }
        const current = tokenRef.current;
        if (!current) return null;
        const blob = await downloadFile(current.accessToken, photoId);
        return rememberPhoto(photoId, blob);
      },
      getPhotoBlob: async (photoId) => {
        if (!photoId) return null;
        if (modeRef.current === "demo") return demoGetPhoto(photoId);
        const current = tokenRef.current;
        if (!current) return null;
        return downloadFile(current.accessToken, photoId);
      },
      persistGemini: async () => {
        const key = geminiKey.trim();
        const model = geminiModel.trim() || DEFAULT_GEMINI_MODEL;
        storageSet(GEMINI_KEY, key);
        storageSet(GEMINI_MODEL, model);
        storageSet(GEMINI_DRIVE, saveGeminiToDrive ? "1" : "0");
        setGeminiKey(key);
        setGeminiModel(model);
        if (modeRef.current === "drive" && folderId.current && tokenRef.current) {
          await writeSettings(tokenRef.current.accessToken, folderId.current, {
            version: 1,
            geminiKey: saveGeminiToDrive ? key : "",
            geminiModel: model,
          });
          setGeminiFromDrive(saveGeminiToDrive && Boolean(key));
          return saveGeminiToDrive ? "Saved on this phone and in your private Drive file." : "Saved on this phone. The Drive copy was cleared.";
        }
        return "Saved on this phone. It is not in the share link or the source code.";
      },
    };
  }, [
    apiKey,
    cards,
    clientId,
    error,
    fileConfig.googleApiKey,
    fileConfig.googleClientId,
    fileConfig.geminiRelayUrl,
    geminiFromDrive,
    geminiKey,
    geminiModel,
    loading,
    mode,
    needsReauth,
    photoVersion,
    saveGeminiToDrive,
    shareFileId,
    token,
  ]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
