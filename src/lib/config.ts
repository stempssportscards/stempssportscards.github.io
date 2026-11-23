export interface FileConfig {
  googleClientId: string;
  googleApiKey: string;
}

export async function loadFileConfig(): Promise<FileConfig> {
  const empty = { googleClientId: "", googleApiKey: "" };
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: "no-store" });
    if (!response.ok) return empty;
    const json = (await response.json()) as { googleClientId?: unknown; googleApiKey?: unknown; geminiKey?: unknown };
    if (json.geminiKey) {
      console.warn("Ignoring geminiKey in config.json. Put that key in Settings so it is not shipped to every visitor.");
    }
    return {
      googleClientId: typeof json.googleClientId === "string" ? json.googleClientId.trim() : "",
      googleApiKey: typeof json.googleApiKey === "string" ? json.googleApiKey.trim() : "",
    };
  } catch {
    return empty;
  }
}

export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
