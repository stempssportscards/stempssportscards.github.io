export type CardStatus = "owned" | "for_sale" | "sold";

export interface Card {
  id: string;
  createdAt: string;
  updatedAt: string;
  photoId: string;
  player: string;
  year: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  grade: string;
  notes: string;
  buyCents: number | null;
  askingCents: number | null;
  soldCents: number | null;
  soldDate: string | null;
  status: CardStatus;
  photoShared: boolean;
}

export interface CollectionFile {
  version: 1;
  cards: Card[];
}

/** Fields a buyer is allowed to see. Cost, profit, notes, and sold data are absent on purpose. */
export interface PublicCard {
  id: string;
  player: string;
  year: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  grade: string;
  askingCents: number | null;
  photoUrl: string;
}

export interface PublicCatalog {
  version: 1;
  title: "Stemp's Sports Cards";
  updatedAt: string;
  cards: PublicCard[];
}

export interface CardInput {
  id?: string;
  player: string;
  year: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  grade: string;
  notes: string;
  buyCents: number | null;
  askingCents: number | null;
  soldCents: number | null;
  soldDate: string | null;
  status: CardStatus;
  photo: Blob | null;
}
