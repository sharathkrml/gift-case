export type Clue = {
  id: string;
  text: string;
};

export type Product = {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
  emoji: string;
  tint: string;
  suspicion: number;
  clueIds: string[];
  why: string;
  imageUrl?: string | null;
  url?: string | null;
};

export type GiftCase = {
  id: string;
  title: string;
  brief: string;
  createdAt: string;
  log: string[];
  clues: Clue[];
  products: Product[];
};
