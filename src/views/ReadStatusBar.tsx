import { useEffect, useState } from "react";
import { useLibrary } from "../state.tsx";

/** Small, non-blocking strip above the tabs while cards are read in the background. */
export function ReadStatusBar() {
  const library = useLibrary();
  const { running, done, waiting, paused, retryAt } = library.readStatus;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  if (paused && waiting > 0) {
    return (
      <div className="readBar paused" role="status">
        <span className="grow">{paused}</span>
        <button type="button" className="ghost slim" onClick={() => library.resumeReads()}>Resume</button>
      </div>
    );
  }
  if (!running || waiting === 0) return null;
  const total = done + waiting;
  const current = Math.min(total, done + 1);
  return (
    <div className="readBar" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="grow">
        Reading cards {current} of {total}
        {retryAt ? <span className="muted tiny block">Scanner is busy. Trying again in {formatWait(retryAt - now)}…</span> : null}
      </span>
      <span className="readMini" aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>
    </div>
  );
}

function formatWait(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}
