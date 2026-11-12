export const FREE_CREDITS = 3;

// Each case costs one credit. Tune prices and pack sizes here.
export const CREDIT_PACKS = [
  { id: "starter", name: "Starter", credits: 10, priceMinor: 500 },
  { id: "investigator", name: "Investigator", credits: 30, priceMinor: 1200 },
  { id: "precinct", name: "Precinct", credits: 100, priceMinor: 3000 },
] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];
