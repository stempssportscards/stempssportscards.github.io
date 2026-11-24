import { useLibrary } from "../state.tsx";

/** Small, non-blocking strip above the tabs while cards are read in the background. */
export function ReadStatusBar() {
  const library = useLibrary();
  const { running, done, waiting, paused } = library.readStatus;
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
      <span className="grow">Reading cards {current} of {total}</span>
      <span className="readMini" aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>
    </div>
  );
}
