import { useState } from "react";
import { go } from "../lib/route.ts";
import { useLibrary } from "../state.tsx";
import { Brand } from "./Brand.tsx";

export function Landing() {
  const library = useLibrary();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [typedClientId, setClientId] = useState("");
  const clientId = typedClientId || library.clientId;
  const preset = Boolean(library.clientId.trim()) && !typedClientId;

  async function signIn() {
    setBusy(true);
    setMessage(null);
    library.setClientId(clientId);
    try {
      await library.signIn();
      go("/");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Google sign-in didn't finish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page landing">
      <div className="logo">
        <Brand large />
        <p className="tagline">Your cards stay in your Google Drive. This site keeps no database.</p>
      </div>
      <div className="landBtns">
        <button className="primary huge" type="button" disabled={busy || !clientId.trim()} onClick={() => void signIn()}>
          {busy ? "Signing in…" : "Sign in with Google"}
        </button>
        <button className="secondary huge" type="button" onClick={() => { library.enterDemo(); go("/"); }}>
          Try the demo on this phone
        </button>
      </div>
      {message ? <p className="warn" role="alert">{message}</p> : null}
      {preset ? null : (<>
      <label htmlFor="client-id">Google OAuth client ID</label>
      <input
        id="client-id"
        value={clientId}
        autoComplete="off"
        spellCheck={false}
        placeholder="….apps.googleusercontent.com"
        onChange={(event) => {
          setClientId(event.target.value);
          library.setClientId(event.target.value);
        }}
      />
      <p className="muted small">
        Paste the web client ID once on this phone. Friends each sign in with their own Google account, and each shelf is stored in that person's Drive.
        The exact Cloud Console steps are in the README.
      </p>
      </>)}
      <button className="statsLink" type="button" onClick={() => go("/settings")}>Settings</button>
    </main>
  );
}
