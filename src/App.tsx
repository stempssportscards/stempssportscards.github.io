import { useEffect, useState } from "react";
import { identifyCard } from "./lib/gemini.ts";
import { go, parseRoute, type Route } from "./lib/route.ts";
import { useLibrary } from "./state.tsx";
import { Brand } from "./views/Brand.tsx";
import { CardDetail } from "./views/CardDetail.tsx";
import { CardForm } from "./views/CardForm.tsx";
import { Landing } from "./views/Landing.tsx";
import { PublicSalePage } from "./views/PublicSale.tsx";
import { SaleDesk } from "./views/SaleDesk.tsx";
import { Settings } from "./views/Settings.tsx";
import { Shelf } from "./views/Shelf.tsx";
import { BulkAdd } from "./views/BulkAdd.tsx";
import { needsDetails } from "./lib/drafts.ts";

function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return parseRoute(hash);
}

export default function App() {
  const library = useLibrary();
  const route = useRoute();

  useEffect(() => {
    document.title = route.name === "public" ? "For sale · Stemp's Sports Cards" : "Stemp's Sports Cards";
  }, [route]);

  if (route.name === "public") return <PublicSalePage fileId={route.fileId} />;

  const signedIn = library.mode !== "signed-out";
  if (library.loading && !signedIn) {
    return (
      <main className="page landing">
        <Brand large />
        <p className="muted">Opening…</p>
      </main>
    );
  }
  if (!signedIn && route.name !== "settings") return <Landing />;

  function back() {
    if (route.name === "edit") {
      const editing = library.cards.find((item) => item.id === route.id);
      go(editing && needsDetails(editing) ? "/needs" : `/card/${route.id}`);
    }
    else go("/");
  }

  return (
    <>
      <header>
        <div className="headNav">
          {route.name !== "shelf" ? (
            <button className="ghost back" type="button" aria-label="Back" onClick={back}>←</button>
          ) : null}
        </div>
        <Brand onClick={() => go("/")} />
      </header>
      {route.name === "shelf" ? <Shelf key={route.filter ?? "all"} initialFilter={route.filter} /> : null}
      {route.name === "add" ? <Editor id={null} /> : null}
      {route.name === "edit" ? <Editor id={route.id} /> : null}
      {route.name === "card" ? <CardDetail id={route.id} /> : null}
      {route.name === "sale" ? <SaleDesk /> : null}
      {route.name === "settings" ? <Settings /> : null}
      {signedIn ? <Tabs route={route} /> : null}
    </>
  );
}

function Editor({ id }: { id: string | null }) {
  const library = useLibrary();
  const card = id ? library.cards.find((item) => item.id === id) ?? null : null;
  const [photoUrl, setPhotoUrl] = useState<string | null>(card ? library.photoSrc(card.photoId) : null);
  useEffect(() => {
    if (!card) return;
    let cancel = false;
    library.ensurePhoto(card.photoId).then((url) => {
      if (!cancel) setPhotoUrl(url);
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [card, library]);
  if (id && !card && !library.loading) {
    return (
      <main className="page withtabs">
        <p className="empty">That card isn't on the shelf.</p>
      </main>
    );
  }
  return (
    <main className="page withtabs">
      <h2>{card ? (needsDetails(card) ? "Add details" : "Edit card") : "Add a card"}</h2>
      {card ? null : <BulkAdd />}
      {card ? null : <p className="orLine"><span>or add one card</span></p>}
      <CardForm
        initial={card}
        initialPhotoUrl={photoUrl}
        loadPhoto={card ? () => library.getPhotoBlob(card.photoId) : undefined}
        identify={(photo) =>
          identifyCard(photo, {
            apiKey: library.geminiKey,
            relayUrl: library.geminiRelayUrl,
            model: library.geminiModel,
          })
        }
        onCancel={() => go(card ? (needsDetails(card) ? "/needs" : `/card/${card.id}`) : "/")}
        onSave={async (input) => {
          const wasDraft = card ? needsDetails(card) : false;
          const saved = await library.saveCard(input);
          const remaining = library.cards.filter((item) => item.id !== saved && needsDetails(item)).length;
          go(wasDraft && remaining > 0 ? "/needs" : `/card/${saved}`);
        }}
      />
    </main>
  );
}

function Tabs({ route }: { route: Route }) {
  const current = route.name === "add" ? "add" : route.name === "sale" ? "sale" : route.name === "settings" ? "settings" : "shelf";
  return (
    <nav className="tabs" aria-label="Sections">
      <button type="button" className={current === "shelf" ? "on" : ""} aria-current={current === "shelf" ? "page" : undefined} onClick={() => go("/")}>
        <ShelfIcon />
        Shelf
      </button>
      <button type="button" className={current === "add" ? "on" : ""} aria-current={current === "add" ? "page" : undefined} onClick={() => go("/add")}>
        <PlusIcon />
        Add
      </button>
      <button type="button" className={current === "sale" ? "on" : ""} aria-current={current === "sale" ? "page" : undefined} onClick={() => go("/sale")}>
        <TagIcon />
        For sale
      </button>
      <button type="button" className={current === "settings" ? "on" : ""} aria-current={current === "settings" ? "page" : undefined} onClick={() => go("/settings")}>
        <GearIcon />
        Settings
      </button>
    </nav>
  );
}

function ShelfIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12V5h7l9 9-7 7-9-9z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
