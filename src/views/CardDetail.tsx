import { useEffect, useState } from "react";
import { compQuery, ebaySoldUrl, point130Url } from "../lib/comps.ts";
import { cardProfit, formatCents, formatProfit } from "../lib/money.ts";
import { go } from "../lib/route.ts";
import { cardSubtitle, cardTitle } from "../lib/text.ts";
import { useLibrary } from "../state.tsx";
import type { CardStatus } from "../types.ts";

export function CardDetail({ id }: { id: string }) {
  const library = useLibrary();
  const card = library.cards.find((item) => item.id === id);
  const [src, setSrc] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!card) return;
    let cancel = false;
    library.ensurePhoto(card.photoId).then((url) => {
      if (!cancel) setSrc(url);
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [card, library]);

  if (!card) {
    return (
      <main className="page withtabs">
        <p className="empty">That card isn't on the shelf.</p>
        <button className="primary big" type="button" onClick={() => go("/")}>Back to the shelf</button>
      </main>
    );
  }

  const shown = card;
  const profitValue = cardProfit(shown);
  const profit = formatProfit(profitValue);
  const profitTone = profitValue.cents != null && profitValue.cents < 0 ? "down" : "up";
  const query = compQuery(shown);

  async function setStatus(next: CardStatus) {
    if (next === shown.status) return;
    if (next === "sold" && shown.soldCents == null) {
      go(`/edit/${shown.id}`);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await library.saveCard({
        id: shown.id,
        player: shown.player,
        year: shown.year,
        setName: shown.setName,
        cardNumber: shown.cardNumber,
        parallel: shown.parallel,
        grade: shown.grade,
        notes: shown.notes,
        buyCents: shown.buyCents,
        askingCents: shown.askingCents,
        soldCents: shown.soldCents,
        soldDate: next === "sold" ? shown.soldDate ?? new Date().toISOString().slice(0, 10) : shown.soldDate,
        status: next,
        photo: null,
      });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not update the card.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await library.deleteCard(shown.id);
      go("/");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not remove the card.");
      setBusy(false);
    }
  }

  return (
    <main className="page withtabs">
      {src ? <img className="heroPhoto" src={src} alt={cardTitle(shown.player)} /> : <div className="photoMissing tall">Photo unavailable</div>}
      <h2 className="playerName">{cardTitle(shown.player)}</h2>
      <p className="muted">{cardSubtitle(shown) || "Sports card"}</p>
      <div className="chips" role="group" aria-label="Status">
        {(["owned", "for_sale", "sold"] as const).map((item) => (
          <button key={item} type="button" className={shown.status === item ? "chip on" : "chip"} disabled={busy} aria-pressed={shown.status === item} onClick={() => void setStatus(item)}>
            {item === "owned" ? "Owned" : item === "for_sale" ? "For sale" : "Sold"}
          </button>
        ))}
      </div>
      {message ? <p className="warn" role="alert">{message}</p> : null}
      <dl className="moneyList">
        <div><dt>Paid</dt><dd>{formatCents(shown.buyCents)}</dd></div>
        <div><dt>Asking</dt><dd>{formatCents(shown.askingCents)}</dd></div>
        <div><dt>Sold</dt><dd>{shown.status === "sold" ? formatCents(shown.soldCents) : "—"}{shown.soldDate ? <span className="muted small"> {shown.soldDate}</span> : null}</dd></div>
        <div><dt>{shown.status === "sold" ? "Profit" : "Potential"}</dt><dd className={profitTone}>{profit ?? "—"}</dd></div>
      </dl>
      {shown.notes ? <p className="notes">{shown.notes}</p> : null}
      <div className="row">
        <a className="secondary linkBtn" href={ebaySoldUrl(query)} target="_blank" rel="noreferrer">eBay sold</a>
        <a className="secondary linkBtn" href={point130Url(query)} target="_blank" rel="noreferrer">130point</a>
      </div>
      <button className="primary big" type="button" onClick={() => go(`/edit/${shown.id}`)}>Edit card</button>
      <button className="danger full" type="button" onClick={() => setConfirming(true)}>Remove card</button>
      {confirming ? (
        <div className="sheetBg" role="presentation" onClick={() => setConfirming(false)}>
          <div className="sheet" role="alertdialog" aria-labelledby="remove-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="remove-title">Remove this card?</h2>
            <p>The photo is deleted from {library.mode === "drive" ? "your Drive folder" : "this phone"} too.</p>
            <button className="dangerFill big" type="button" disabled={busy} onClick={() => void remove()}>Remove</button>
            <button className="secondary big" type="button" onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
