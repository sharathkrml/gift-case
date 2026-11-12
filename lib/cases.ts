export const EXAMPLE_BRIEF =
  "My dad, 58, hates anything with a screen, lives for fishing, and would never admit he cares how he looks. Under $120.";

export function formatPrice(priceMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: priceMinor % 100 === 0 ? 0 : 2,
  }).format(priceMinor / 100);
}

const RELATIONSHIPS = [
  "dad",
  "father",
  "mom",
  "mother",
  "sister",
  "brother",
  "partner",
  "wife",
  "husband",
  "girlfriend",
  "boyfriend",
  "friend",
  "son",
  "daughter",
  "grandma",
  "grandpa",
];

export function titleFromBrief(brief: string) {
  const lower = brief.toLowerCase();
  const relationship = RELATIONSHIPS.find((r) => new RegExp(`\\b${r}\\b`).test(lower));
  if (relationship) {
    return `The ${relationship[0].toUpperCase()}${relationship.slice(1)} Case`;
  }
  const words = brief.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.replace(/[.,;:!?]+$/, "") || "Untitled Case";
}
