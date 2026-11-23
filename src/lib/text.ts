export function cardSubtitle(card: {
  year: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  grade: string;
}): string {
  const number = card.cardNumber.trim().replace(/^#/, "");
  return [card.year, card.setName, number ? `#${number}` : "", card.parallel, card.grade]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

export function cardTitle(player: string): string {
  return player.trim() || "Untitled card";
}
