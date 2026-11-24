import { useRef, useState } from "react";
import { go } from "../lib/route.ts";
import { useLibrary, type BulkProgress, type BulkResult } from "../state.tsx";

export function BulkAdd({ compact = false }: { compact?: boolean }) {
  const library = useLibrary();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress != null;
  const [autoRead, setAutoRead] = useState(() => {
    try {
      return localStorage.getItem("ssc.bulkAutoRead") !== "0";
    } catch {
      return true;
    }
  });
  const reading = autoRead && library.canAutoRead;

  function chooseAuto(next: boolean) {
    setAutoRead(next);
    try {
      localStorage.setItem("ssc.bulkAutoRead", next ? "1" : "0");
    } catch {
      /* private mode */
    }
  }

  async function onPick(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (input.current) input.current.value = "";
    if (files.length === 0) return;
    setResult(null);
    setError(null);
    setProgress({ finished: 0, total: files.length });
    try {
      setResult(await library.addPhotos(files, setProgress, { autoRead: reading }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save those photos.");
    } finally {
      setProgress(null);
    }
  }

  const saving = progress ? Math.min(progress.total, progress.finished + 1) : 0;

  return (
    <section className={compact ? "bulkBox compact" : "bulkBox"} aria-label="Add many photos">
      {library.canAutoRead ? (
        <div className="chips bulkChoice" role="group" aria-label="After upload">
          <button type="button" className={autoRead ? "chip on" : "chip"} aria-pressed={autoRead} disabled={busy} onClick={() => chooseAuto(true)}>
            Read cards automatically
          </button>
          <button type="button" className={!autoRead ? "chip on" : "chip"} aria-pressed={!autoRead} disabled={busy} onClick={() => chooseAuto(false)}>
            Just store them
          </button>
        </div>
      ) : null}
      <button type="button" className="secondary big" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? `Saving ${saving} of ${progress.total}…` : "Add many photos"}
      </button>
      <input
        ref={input}
        aria-label="Choose many photos"
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => void onPick(event.target.files)}
      />
      {busy ? (
        <div className="bulkBar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.finished}>
          <span style={{ width: `${progress.total ? (progress.finished / progress.total) * 100 : 0}%` }} />
        </div>
      ) : null}
      {busy ? <p className="muted small" role="status">Keep this screen open until it finishes.</p> : null}
      {!busy && !result && !error && !compact ? (
        <p className="muted small">
          {reading
            ? "Pick a bunch from your photo library. Each one saves as a card, then the app reads them one by one in the background. You just add prices."
            : "Pick a bunch from your photo library. Each one saves as a card, and you add the details later."}
        </p>
      ) : null}
      {error ? <p className="warn" role="alert">{error}</p> : null}
      {result ? (
        <div className={result.failed.length ? "warn" : "okBox"} role="status">
          <p>
            {result.saved === 1 ? "Saved 1 photo." : `Saved ${result.saved} photos.`}
            {result.saved > 0
              ? reading
                ? " Reading them now in the background. Keep using the app; finished cards move to Needs prices."
                : " They're under Needs details on the shelf."
              : ""}
          </p>
          {result.failed.length ? (
            <>
              <p>{result.failed.length === 1 ? "1 didn't save:" : `${result.failed.length} didn't save:`}</p>
              <ul className="failList">
                {result.failed.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <b>{item.name}</b>: {item.message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {result.saved > 0 ? (
            <button type="button" className="primary" onClick={() => go(reading ? "/" : "/needs")}>{reading ? "Back to the shelf" : "Add details now"}</button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
