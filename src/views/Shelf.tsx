import { useEffect, useState } from "react";
import { formatCents, formatProfit, cardProfit, summarize } from "../lib/money.ts";
import { filterCards, type StatusFilter } from "../lib/filter.ts";
import { needsDetails } from "../lib/drafts.ts";
import { go } from "../lib/route.ts";
import { cardSubtitle, cardTitle } from "../lib/text.ts";
import { useLibrary } from "../state.tsx";
import type { Card } from "../types.ts";
import { BulkAdd } from "./BulkAdd.tsx";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "owned", label: "Owned" },
  { id: "for_sale", label: "For sale" },
  { id: "sold", label: "Sold" },
];

export function Shelf({ initialFilter }: { initialFilter?: StatusFilter }) {
  const library = useLibrary();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>(initialFilter ?? "all");
  const summary = summarize(library.cards);
  const visible = filterCards(library.cards, query, status);
  const drafts = filterCards(library.cards, "", "needs_details");
  const draftCount = drafts.length;
  const filters: { id: StatusFilter; label: string }[] = draftCount > 0 || status === "needs_details"
    ? [...FILTERS, { id: "needs_details", label: `Needs details (${draftCount})` }]
    : FILTERS;

  return (
    <main className="page withtabs">
      {library.mode === "demo" ? <p className="warn">Demo on this phone. Sign in with Google to keep the shelf in your Drive.</p> : null}
      {library.needsReauth ? (
        <div className="warn" role="alert">
          <p>Google signed you out.</p>
          <button className="primary" type="button" onClick={() => void library.signIn()}>Sign in again</button>
        </div>
      ) : null}
      {library.error ? (
        <div className="warn" role="alert">
          <p>{library.error}</p>
          <button className="secondary" type="button" onClick={() => void library.reload()}>Try again</button>
        </div>
      ) : null}

      <section className="statGrid" aria-label="Shelf totals">
        <div className="stat">
          <div className="sv">{summary.count}</div>
          <div className="sl">Cards</div>
          <div className="muted tiny">{summary.ownedCount} owned · {summary.forSaleCount} for sale · {summary.soldCount} sold{summary.needsDetailsCount ? ` · ${summary.needsDetailsCount} need details` : ""}</div>
        </div>
        <div className="stat">
          <div className="sv">{formatCents(summary.costCents)}</div>
          <div className="sl">Cost</div>
          <div className="muted tiny">owned + for sale{summary.missingCost ? ` · ${summary.missingCost} missing` : ""}</div>
        </div>
        <div className="stat">
          <div className="sv">{formatCents(summary.askingCents)}</div>
          <div className="sl">Asking</div>
          <div className="muted tiny">owned + for sale{summary.missingAsking ? ` · ${summary.missingAsking} missing` : ""}</div>
        </div>
        <div className="stat">
          <div className={`sv ${summary.realizedCents < 0 ? "down" : summary.realizedCents > 0 ? "up" : ""}`}>{formatCents(summary.realizedCents)}</div>
          <div className="sl">Realized</div>
          <div className="muted tiny">sold minus buy</div>
        </div>
      </section>

      {draftCount > 0 && status !== "needs_details" ? (
        <section className="draftStrip" aria-label={`Needs details (${draftCount})`}>
          <div className="draftHead">
            <h3>Needs details ({draftCount})</h3>
            <button type="button" className="ghost slim" onClick={() => setStatus("needs_details")}>See all</button>
          </div>
          <div className="draftRow">
            {drafts.slice(0, 12).map((card) => (
              <button key={card.id} type="button" className="draftTile" aria-label="Add details for this photo" onClick={() => go(`/edit/${card.id}`)}>
                <Thumb photoId={card.photoId} alt="" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <label className="searchLabel" htmlFor="search">Search</label>
      <input id="search" value={query} placeholder="Player, set, number, grade" onChange={(event) => setQuery(event.target.value)} />

      <div className="chips" role="group" aria-label="Filter">
        {filters.map((filter) => (
          <button key={filter.id} type="button" className={status === filter.id ? "chip on" : "chip"} aria-pressed={status === filter.id} onClick={() => setStatus(filter.id)}>
            {filter.label}
          </button>
        ))}
      </div>

      {library.mode === "drive" ? (
        <button className="ghost slim" type="button" onClick={() => void library.reload()}>Reload from Drive</button>
      ) : null}

      {library.loading ? <p className="muted">Opening your shelf…</p> : null}
      {!library.loading && library.cards.length === 0 ? (
        <div className="empty">
          <p>The shelf is empty.</p>
          <button className="primary big" type="button" onClick={() => go("/add")}>Add a card</button>
          <BulkAdd compact />
        </div>
      ) : null}
      {!library.loading && library.cards.length > 0 && visible.length === 0 ? (
        <p className="empty">{status === "needs_details" && !query.trim() ? "Every card has details. Nice." : "No cards match that search."}</p>
      ) : null}

      {status === "needs_details" ? (
        <>
          <p className="muted small">Tap a photo to add its details. "Read the card" can fill them in from the photo.</p>
          <BulkAdd compact />
          <div className="draftGrid">
            {visible.map((card) => (
              <button key={card.id} type="button" className="draftTile" aria-label="Add details for this photo" onClick={() => go(`/edit/${card.id}`)}>
                <Thumb photoId={card.photoId} alt="" />
                <span className="tiny">Add details</span>
              </button>
            ))}
          </div>
        </>
      ) : (
      <ul className="cardList">
        {visible.map((card) => (
          <li key={card.id}>
            <button className="card tap cardRow" type="button" onClick={() => go(needsDetails(card) ? `/edit/${card.id}` : `/card/${card.id}`)}>
              <Thumb photoId={card.photoId} alt="" />
              <span className="grow">
                <strong>{cardTitle(card.player)}</strong>
                <span className="muted small">{cardSubtitle(card) || "Sports card"}</span>
                {needsDetails(card) ? <span className="pill draft">Needs details</span> : null}
                <span className={`pill ${card.status}`}>{card.status === "for_sale" ? "For sale" : card.status === "sold" ? "Sold" : "Owned"}</span>
              </span>
              <span className="priceCol">
                <b>{card.status === "sold" ? formatCents(card.soldCents) : formatCents(card.askingCents ?? card.buyCents)}</b>
                <span className={profitClass(card)}>{formatProfit(cardProfit(card)) ?? ""}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      )}
    </main>
  );
}

function profitClass(card: Card): string {
  const profit = cardProfit(card);
  if (profit.cents == null) return "muted tiny";
  return profit.cents < 0 ? "tiny down" : "tiny up";
}

function Thumb({ photoId, alt }: { photoId: string; alt: string }) {
  const library = useLibrary();
  const [src, setSrc] = useState<string | null>(() => library.photoSrc(photoId));
  useEffect(() => {
    let cancel = false;
    library.ensurePhoto(photoId).then((url) => {
      if (!cancel && url) setSrc(url);
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [library, photoId]);
  return src ? <img className="thumb" src={src} alt={alt} /> : <span className="thumb missing" aria-hidden="true" />;
}
