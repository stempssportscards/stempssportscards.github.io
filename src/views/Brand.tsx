import { useState } from "react";
import { asset } from "../lib/config.ts";

export function Brand({ large = false, onClick }: { large?: boolean; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  const image = failed ? (
    <span className={large ? "wordmarkFallback large" : "wordmarkFallback"}>
      <b>Stemp's</b>
      <span>Sports Cards</span>
    </span>
  ) : (
    <img
      className={large ? "heroLogo" : "brand"}
      src={asset("wordmark.png")}
      alt="Stemp's Sports Cards"
      onError={() => setFailed(true)}
    />
  );
  if (!onClick) return image;
  return (
    <button className="brandBtn" type="button" onClick={onClick} aria-label="Stemp's Sports Cards home">
      {image}
    </button>
  );
}
