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
  /** Saved from a bulk photo upload; details are added later. Absent on older cards. */
  draft?: boolean;
  /** Came from a bulk upload. Kept after details are added so "Needs prices" can find it. */
  bulk?: boolean;
  /** Background card read: "pending" waits in the queue, "failed" means it couldn't be read. */
  readState?: "pending" | "failed";
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
