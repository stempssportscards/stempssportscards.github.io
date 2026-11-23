import { useState } from "react";
import { formatCents } from "../lib/money.ts";
import { go } from "../lib/route.ts";
import { cardSubtitle, cardTitle } from "../lib/text.ts";
import { useLibrary } from "../state.tsx";

export function SaleDesk() {
  const library = useLibrary();
  const listed = library.cards.filter((card) => card.status === "for_sale");
  const [link, setLink] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function publish() {
    setBusy(true);
    setMessage(null);
    setCopied(false);
    try {
      const result = await library.publish();
      setLink(result.url);
      setWarning(result.warning);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not publish the buyer link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
      setMessage("Press and hold the link to copy it.");
    }
  }

  return (
    <main className="page withtabs">
      <h2>Buyer link</h2>
      <p className="muted">Anyone with the link sees cards marked for sale: photo, details, and asking price. Cost, notes, and profit are not in that file.</p>
      {listed.length === 0 ? <p className="empty">No cards are marked for sale. Open a card and tap For sale.</p> : (
        <ul className="cardList">
          {listed.map((card) => (
            <li key={card.id}>
              <button className="card tap cardRow" type="button" onClick={() => go(`/card/${card.id}`)}>
                <span className="grow">
                  <strong>{cardTitle(card.player)}</strong>
                  <span className="muted small">{cardSubtitle(card)}</span>
                </span>
                <b>{formatCents(card.askingCents)}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="primary big" type="button" disabled={busy} onClick={() => void publish()}>
        {busy ? "Publishing…" : library.shareFileId ? "Update buyer link" : "Publish buyer link"}
      </button>
      {message ? <p className="warn" role="alert">{message}</p> : null}
      {warning ? <p className="warn">{warning}</p> : null}
      {link ? (
        <div className="linkBox">
          <label htmlFor="buyer-link">Buyer link</label>
          <input id="buyer-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
          <div className="row">
            <button className="secondary" type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
            <a className="secondary linkBtn" href={link}>Open buyer view</a>
          </div>
        </div>
      ) : null}
    </main>
  );
}
