import { useState } from "react";
import { asset } from "../lib/config.ts";

export function Brand({
  large = false,
  moderate = false,
  onClick,
}: {
  large?: boolean;
  moderate?: boolean;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const markClass = large ? "heroLogo" : moderate ? "brand moderate" : "brand";
  const fallbackClass = large ? "wordmarkFallback large" : moderate ? "wordmarkFallback moderate" : "wordmarkFallback";
  const image = failed ? (
    <span className={fallbackClass}>
      <b>Stemp's</b>
      <span>Sports Cards</span>
    </span>
  ) : (
    <img
      className={markClass}
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
