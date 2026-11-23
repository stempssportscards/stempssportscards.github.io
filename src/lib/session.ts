const TOKEN_KEY = "ssc.googleToken";
const MODE_KEY = "ssc.mode";

export interface StoredToken {
  accessToken: string;
  expiresAt: number;
  email: string;
  name: string;
}

export function readToken(): StoredToken | null {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const token = JSON.parse(raw) as StoredToken;
    if (!token.accessToken || token.expiresAt < Date.now() + 30_000) return null;
    return token;
  } catch {
    return null;
  }
}

export function writeToken(token: StoredToken): void {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  sessionStorage.setItem(MODE_KEY, "drive");
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function markDemo(): void {
  sessionStorage.setItem(MODE_KEY, "demo");
  sessionStorage.removeItem(TOKEN_KEY);
}

export function clearMode(): void {
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function readDemoFlag(): boolean {
  return sessionStorage.getItem(MODE_KEY) === "demo";
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in. Check the connection and try again."));
    document.head.appendChild(script);
  });
}

export async function requestGoogleToken(clientId: string): Promise<{ accessToken: string; expiresIn: number }> {
  await loadGis();
  const google = window.google;
  if (!google) throw new Error("Google sign-in did not load.");
  const response = await new Promise<TokenResponse>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (token) => resolve(token),
      error_callback: (error) => reject(new Error(error.message || "Google sign-in was closed before it finished. Allow pop-ups for this site and try again.")),
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
  if (!response.access_token) {
    throw new Error(response.error_description || response.error || "Google did not return a sign-in token.");
  }
  return { accessToken: response.access_token, expiresIn: response.expires_in ?? 3600 };
}

export async function fetchProfile(accessToken: string): Promise<{ email: string; name: string }> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not read the Google account name.");
  const json = (await response.json()) as { email?: string; name?: string };
  return { email: json.email ?? "", name: json.name || json.email || "Google account" };
}
