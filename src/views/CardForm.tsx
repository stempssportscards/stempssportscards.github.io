import { useEffect, useRef, useState } from "react";
import { compQuery, ebaySoldUrl, point130Url } from "../lib/comps.ts";
import { mockIdentification, type Identification } from "../lib/gemini.ts";
import { fileToJpeg } from "../lib/images.ts";
import { cardProfit, centsToInput, dollarsToCents, formatProfit } from "../lib/money.ts";
import type { Card, CardInput, CardStatus } from "../types.ts";

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function priceError(raw: string): string | null {
  if (!raw.trim()) return null;
  if (raw.trim().startsWith("-")) return "Prices can't be negative.";
  if (dollarsToCents(raw) == null) return "Use a number like 12.50.";
  return null;
}

export function CardForm({
  initial,
  initialPhotoUrl,
  identify,
  loadPhoto,
  onSave,
  onCancel,
}: {
  initial: Card | null;
  initialPhotoUrl: string | null;
  identify: (photo: Blob) => Promise<Identification>;
  loadPhoto?: () => Promise<Blob | null>;
  onSave: (input: CardInput) => Promise<void>;
  onCancel: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(initialPhotoUrl);
  const [player, setPlayer] = useState(initial?.player ?? "");
  const [year, setYear] = useState(initial?.year ?? "");
  const [setName, setSetName] = useState(initial?.setName ?? "");
  const [cardNumber, setCardNumber] = useState(initial?.cardNumber ?? "");
  const [parallel, setParallel] = useState(initial?.parallel ?? "");
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [buy, setBuy] = useState(centsToInput(initial?.buyCents ?? null));
  const [asking, setAsking] = useState(centsToInput(initial?.askingCents ?? null));
  const [sold, setSold] = useState(centsToInput(initial?.soldCents ?? null));
  const [soldDate, setSoldDate] = useState(initial?.soldDate ?? "");
  const [status, setStatus] = useState<CardStatus>(initial?.status ?? "owned");
  const [banner, setBanner] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (preview && preview !== initialPhotoUrl) URL.revokeObjectURL(preview);
    };
  }, [preview, initialPhotoUrl]);

  const buyCents = dollarsToCents(buy);
  const askingCents = dollarsToCents(asking);
  const soldCents = dollarsToCents(sold);
  const buyProblem = priceError(buy);
  const askingProblem = priceError(asking);
  const soldProblem = priceError(sold);
  const profit = cardProfit({
    status,
    buyCents: buyProblem ? null : buyCents,
    askingCents: askingProblem ? null : askingCents,
    soldCents: soldProblem ? null : soldCents,
  });
  const profitText = formatProfit(profit);
  const query = compQuery({ player, year, setName, cardNumber, parallel, grade });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBanner(null);
    try {
      const jpeg = await fileToJpeg(file);
      setPhotoBlob(jpeg);
      const url = URL.createObjectURL(jpeg);
      setPreview((current) => {
        if (current && current !== initialPhotoUrl) URL.revokeObjectURL(current);
        return url;
      });
    } catch (reason) {
      setBanner(reason instanceof Error ? reason.message : "Could not use that photo.");
    }
  }

  function apply(result: Identification) {
    if (result.player) setPlayer(result.player);
    if (result.year) setYear(result.year);
    if (result.setName) setSetName(result.setName);
    if (result.cardNumber) setCardNumber(result.cardNumber);
    if (result.parallel) setParallel(result.parallel);
    if (result.grade) setGrade(result.grade);
    setBanner(
      result.source === "mock"
        ? "Sample read, because this phone has no Gemini key. Edit every field. Add a key in Settings to read the photo."
        : "Check the read, then edit anything that's off.",
    );
  }

  async function onRead() {
    setReading(true);
    setBanner(null);
    try {
      const blob = photoBlob ?? (await loadPhoto?.()) ?? null;
      if (!blob) {
        setBanner("Add a photo first.");
        return;
      }
      apply(await identify(blob));
    } catch (reason) {
      setBanner(reason instanceof Error ? reason.message : "Could not read the card.");
    } finally {
      setReading(false);
    }
  }

  async function onSubmit() {
    if (buyProblem || askingProblem || soldProblem) {
      setBanner("Fix the prices before saving.");
      return;
    }
    if (!photoBlob && !initial?.photoId) {
      setBanner("Add a photo of the card.");
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      await onSave({
        id: initial?.id,
        player,
        year,
        setName,
        cardNumber,
        parallel,
        grade,
        notes,
        buyCents,
        askingCents,
        soldCents,
        soldDate: soldDate || null,
        status,
        photo: photoBlob,
      });
    } catch (reason) {
      setBanner(reason instanceof Error ? reason.message : "Could not save the card.");
      setSaving(false);
    }
  }

  function chooseStatus(next: CardStatus) {
    setStatus(next);
    if (next === "sold" && !soldDate) setSoldDate(today());
  }

  return (
    <form
      className="cardForm"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="photoPick">
        {preview ? <img src={preview} alt="Selected card" /> : <div className="photoMissing">Add a photo</div>}
        <div className="row">
          <button type="button" className="secondary" onClick={() => camera.current?.click()}>Take photo</button>
          <button type="button" className="secondary" onClick={() => library.current?.click()}>Photo library</button>
        </div>
        <input ref={camera} aria-label="Take photo" type="file" accept="image/*" capture="environment" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
        <input ref={library} aria-label="Photo library" type="file" accept="image/*" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
      </div>

      <button type="button" className="primary big" disabled={reading || (!photoBlob && !initial?.photoId)} onClick={() => void onRead()}>
        {reading ? "Reading the card…" : "Read the card"}
      </button>
      {banner ? (
        <div className="warn" role="alert">
          <p>{banner}</p>
          {banner.startsWith("Gemini") || banner.includes("key was rejected") || banner.includes("free limit") ? (
            <button type="button" className="secondary" onClick={() => apply(mockIdentification())}>Fill sample details instead</button>
          ) : null}
        </div>
      ) : null}

      <label htmlFor="player">Player</label>
      <input id="player" value={player} onChange={(event) => setPlayer(event.target.value)} placeholder="Patrick Mahomes" />

      <div className="row">
        <div>
          <label htmlFor="year">Year</label>
          <input id="year" value={year} inputMode="numeric" onChange={(event) => setYear(event.target.value)} placeholder="2024" />
        </div>
        <div>
          <label htmlFor="number">Card number</label>
          <input id="number" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="15" />
        </div>
      </div>

      <label htmlFor="set">Set / brand</label>
      <input id="set" value={setName} onChange={(event) => setSetName(event.target.value)} placeholder="Panini Prizm" />

      <label htmlFor="parallel">Parallel / variant</label>
      <input id="parallel" value={parallel} onChange={(event) => setParallel(event.target.value)} placeholder="Silver, Gold /99, Downtown" />

      <label htmlFor="grade">Grade</label>
      <input id="grade" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="PSA 10, or blank if raw" />

      <label htmlFor="buy">Buy price</label>
      <div className="money">
        <span>$</span>
        <input id="buy" inputMode="decimal" autoComplete="off" value={buy} onChange={(event) => setBuy(event.target.value)} placeholder="0.00" />
      </div>
      {buyProblem ? <p className="fieldError">{buyProblem}</p> : null}

      <label htmlFor="asking">Asking price</label>
      <div className="money">
        <span>$</span>
        <input id="asking" inputMode="decimal" autoComplete="off" value={asking} onChange={(event) => setAsking(event.target.value)} placeholder="0.00" />
      </div>
      {askingProblem ? <p className="fieldError">{askingProblem}</p> : null}

      <p className="label">Status</p>
      <div className="chips" role="group" aria-label="Status">
        {(["owned", "for_sale", "sold"] as const).map((item) => (
          <button key={item} type="button" className={status === item ? "chip on" : "chip"} aria-pressed={status === item} onClick={() => chooseStatus(item)}>
            {item === "owned" ? "Owned" : item === "for_sale" ? "For sale" : "Sold"}
          </button>
        ))}
      </div>
      <p className="muted small">
        {status === "for_sale"
          ? "Buyers will see the photo, these details, and the asking price. Cost and profit stay private."
          : status === "sold"
            ? "Sold cards stay off the buyer link."
            : "Owned cards stay off the buyer link."}
      </p>

      {status === "sold" ? (
        <>
          <label htmlFor="sold">Sold price</label>
          <div className="money">
            <span>$</span>
            <input id="sold" inputMode="decimal" autoComplete="off" value={sold} onChange={(event) => setSold(event.target.value)} placeholder="0.00" />
          </div>
          {soldProblem ? <p className="fieldError">{soldProblem}</p> : null}
          <label htmlFor="sold-date">Sold date</label>
          <input id="sold-date" type="date" value={soldDate} onChange={(event) => setSoldDate(event.target.value)} />
        </>
      ) : null}

      <p className="profitLine" data-testid="profit-line">
        {profitText ?? (status === "sold" ? "Profit needs a buy price and a sold price." : "Potential profit needs a buy price and an asking price.")}
      </p>

      {query ? (
        <div className="row">
          <a className="secondary linkBtn" href={ebaySoldUrl(query)} target="_blank" rel="noreferrer">eBay sold</a>
          <a className="secondary linkBtn" href={point130Url(query)} target="_blank" rel="noreferrer">130point</a>
        </div>
      ) : null}

      <label htmlFor="notes">Notes</label>
      <textarea id="notes" value={notes} rows={3} onChange={(event) => setNotes(event.target.value)} placeholder="Show, seller, anything you don't want on the buyer link" />

      <button className="primary big" type="submit" disabled={saving}>{saving ? "Saving…" : "Save card"}</button>
      <button className="ghost full" type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}
