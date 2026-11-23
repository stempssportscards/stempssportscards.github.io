import { useState } from "react";
import { DEFAULT_GEMINI_MODEL } from "../lib/gemini.ts";
import { go } from "../lib/route.ts";
import { useLibrary } from "../state.tsx";

export function Settings() {
  const library = useLibrary();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveKey() {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await library.persistGemini());
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save the Gemini key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page withtabs">
      <h2>Settings</h2>
      {library.mode === "drive" ? <p className="muted">Signed in as {library.name}{library.email ? ` · ${library.email}` : ""}</p> : null}
      {library.mode === "demo" ? <p className="warn">Demo data stays in this browser. It is not in Google Drive.</p> : null}

      <label htmlFor="gemini-key">Gemini API key (optional)</label>
      <input
        id="gemini-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={library.geminiKey}
        placeholder="From aistudio.google.com/apikey"
        onChange={(event) => library.setGeminiKey(event.target.value)}
      />
      <p className="muted small">Optional. Photos are read with a shared free scanner, so you can leave this blank. Add your own free-tier key from Google AI Studio if that scanner hits its daily limit, or if you want to use your own. It stays on this phone{library.mode === "drive" ? ", or in a private Drive file if you check the box" : ""}. It is never put in the buyer link or config.json.</p>
      {library.geminiFromDrive ? <p className="muted small">Loaded the key saved in your Drive.</p> : null}

      <label htmlFor="gemini-model">Gemini model</label>
      <input id="gemini-model" value={library.geminiModel} spellCheck={false} onChange={(event) => library.setGeminiModel(event.target.value)} />
      <p className="muted small">Default is {DEFAULT_GEMINI_MODEL}. If Google rejects it, try gemini-3.8-flash. Don't turn on billing.</p>

      {library.mode === "drive" ? (
        <label className="check">
          <input type="checkbox" checked={library.saveGeminiToDrive} onChange={(event) => library.setSaveGeminiToDrive(event.target.checked)} />
          <span>Also keep a copy in my Drive</span>
        </label>
      ) : null}
      <button className="primary big" type="button" disabled={busy} onClick={() => void saveKey()}>{busy ? "Saving…" : "Save Gemini key"}</button>
      {message ? <p className="warn" role="status">{message}</p> : null}

      <h3>Google sign-in</h3>
      <label htmlFor="settings-client">OAuth client ID</label>
      <input id="settings-client" value={library.clientId} autoComplete="off" spellCheck={false} placeholder="….apps.googleusercontent.com" onChange={(event) => library.setClientId(event.target.value)} />

      <label htmlFor="settings-api">Google API key for buyer links</label>
      <input id="settings-api" value={library.apiKey} autoComplete="off" spellCheck={false} placeholder="Browser key, Drive API only" onChange={(event) => library.setApiKey(event.target.value)} />
      <p className="muted small">
        {library.apiKeyFromFile
          ? "A key is already in config.json, so buyers of the deployed site can open share links."
          : "A key saved here lets this phone open a Drive share. Other people need the same key in public/config.json, then a rebuild. Restrict the key to this site and the Drive API."}
      </p>

      <h3>Where the cards live</h3>
      <p className="muted">
        After you sign in, the app creates a Drive folder named Stemp's Sports Cards. collection.json and the photos stay private.
        for-sale.json is the only file shared as "anyone with the link," and it has no cost or profit.
      </p>

      {library.mode === "signed-out" ? (
        <button className="secondary big" type="button" onClick={() => go("/")}>Back</button>
      ) : (
        <button className="danger full" type="button" onClick={() => { library.signOut(); go("/"); }}>
          {library.mode === "demo" ? "Leave the demo" : "Sign out"}
        </button>
      )}
    </main>
  );
}
