export interface CompCard {
  player: string;
  year: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  grade: string;
}

/** Search text for the exact card: year, set, player, number, parallel, grade. */
export function compQuery(card: CompCard): string {
  const number = card.cardNumber.trim().replace(/^#/, "");
  return [card.year, card.setName, card.player, number ? `#${number}` : "", card.parallel, card.grade]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/** Public eBay search of sold and completed listings. No eBay API. */
export function ebaySoldUrl(query: string): string {
  const params = new URLSearchParams({
    _nkw: query,
    _sacat: "261328",
    LH_Sold: "1",
    LH_Complete: "1",
    _sop: "13",
  });
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

/** Public 130point card search. No account and no API key. */
export function point130Url(query: string): string {
  return `https://www.130point.com/cards/?q=${encodeURIComponent(query)}`;
}
