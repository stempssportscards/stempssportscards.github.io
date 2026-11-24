import { useEffect, useState } from "react";
import { DEMO_SHARE_KEY } from "../lib/demoStore.ts";
import { formatCents } from "../lib/money.ts";
import { readPublicCatalog } from "../lib/share.ts";
import { cardSubtitle, cardTitle } from "../lib/text.ts";
import { useLibrary } from "../state.tsx";
import type { PublicCard, PublicCatalog } from "../types.ts";
import { Brand } from "./Brand.tsx";

async function loadCatalog(fileId: string, apiKey: string): Promise<PublicCatalog> {
  if (fileId === "demo") {
    const raw = localStorage.getItem(DEMO_SHARE_KEY);
    if (!raw) throw new Error("Nothing is published in this demo yet.");
    return readPublicCatalog(JSON.parse(raw));
  }
  if (!apiKey) {
    throw new Error("This link needs the site's Google API key before it can load. The seller adds that once. You do not need to sign in.");
  }
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error("This buyer link didn't open. It may have been removed, or the Google API key isn't allowed for this website.");
  }
  return readPublicCatalog(await response.json());
}

export function PublicSale({ catalog, demo = false }: { catalog: PublicCatalog; demo?: boolean }) {
  return (
    <main className="page publicPage">
      <Brand moderate />
      <p className="kicker">For sale</p>
      <h1>{catalog.cards.length === 1 ? "1 card" : `${catalog.cards.length} cards`}</h1>
      {demo ? <p className="warn">Demo link. It only opens in this browser.</p> : null}
      {catalog.cards.length === 0 ? (
        <div className="empty">
          <p>Nothing is for sale right now.</p>
        </div>
      ) : (
        <div className="saleList">
          {catalog.cards.map((card) => (
            <SaleCard key={card.id} card={card} />
          ))}
        </div>
      )}
      <p className="muted small footerNote">Asking prices from Stemp's Sports Cards.</p>
    </main>
  );
}

function SaleCard({ card }: { card: PublicCard }) {
  return (
    <article className="card saleCard">
      <CardPhoto url={card.photoUrl} alt={cardTitle(card.player)} />
      <div className="saleBody">
        <h2>{cardTitle(card.player)}</h2>
        <p className="muted">{cardSubtitle(card) || "Sports card"}</p>
        <p className="ask" data-testid="asking">
          {formatCents(card.askingCents)}
        </p>
      </div>
    </article>
  );
}

function CardPhoto({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState(url);
  const [hidden, setHidden] = useState(!url);
  if (hidden) return <div className="photoMissing">Photo unavailable</div>;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => {
        const match = src.match(/\/d\/([^?=]+)/);
        const id = match?.[1];
        if (id && src.includes("googleusercontent")) {
          setSrc(`https://drive.google.com/thumbnail?id=${decodeURIComponent(id)}&sz=w1600`);
          return;
        }
        setHidden(true);
      }}
    />
  );
}

export function PublicSalePage({ fileId }: { fileId: string }) {
  const { apiKey } = useLibrary();
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setCatalog(null);
    setError(null);
    loadCatalog(fileId, apiKey)
      .then((next) => {
        if (!cancel) setCatalog(next);
      })
      .catch((reason) => {
        if (!cancel) setError(reason instanceof Error ? reason.message : "Could not open this link.");
      });
    return () => {
      cancel = true;
    };
  }, [fileId, apiKey]);

  if (error) {
    return (
      <main className="page publicPage">
        <Brand moderate />
        <h1>For sale</h1>
        <p className="warn" role="alert">{error}</p>
      </main>
    );
  }
  if (!catalog) {
    return (
      <main className="page publicPage">
        <Brand moderate />
        <p className="muted">Loading cards for sale…</p>
      </main>
    );
  }
  return <PublicSale catalog={catalog} demo={fileId === "demo"} />;
}
