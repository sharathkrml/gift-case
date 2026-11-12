import { titleFromBrief } from "@/lib/cases";
import { cached } from "@/lib/cache";
import type { Clue, GiftCase, Product } from "@/lib/types";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const CHANNEL3_URL = "https://api.trychannel3.com/v1/search";

// Swapped to another NVIDIA NIM model by changing this id.
const MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

const MAX_PRODUCTS = 6;

export class BriefError extends Error {}

type Channel3Offer = {
  url?: string;
  price?: { price?: number; currency?: string };
  availability?: string;
};

type Channel3Product = {
  id?: string;
  title?: string;
  description?: string | null;
  brands?: { name?: string }[];
  category?: { title?: string } | null;
  images?: { url?: string; cleaned_url?: string | null; is_main_image?: boolean }[];
  colors?: { hex?: string }[];
  key_features?: string[] | null;
  offers?: Channel3Offer[];
};

type Extraction = {
  title?: string;
  clues?: { id?: string; text?: string }[];
  log?: string[];
  searchQuery?: string;
  budgetMax?: number | null;
};

type Ranked = {
  products?: {
    id?: string;
    suspicion?: number;
    clueIds?: string[];
    why?: string;
  }[];
};

function requireKey(name: string) {
  const key = process.env[name];
  if (!key) throw new Error(`${name} is not set`);
  return key;
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("The model did not return a JSON object.");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

async function chatJson<T>(system: string, user: string): Promise<T> {
  return cached(`nvidia:${MODEL}:${system}:${user}`, async () => {
    const response = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireKey("NVIDIA_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        // This model reasons by default; the case pipeline wants the JSON only.
        chat_template_kwargs: { thinking: false },
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      throw new Error(
        `NVIDIA API ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("NVIDIA API returned no content.");
    return parseJson<T>(content);
  });
}

async function searchCatalog(query: string, maxPrice: number | null) {
  const body = {
    query,
    config: { mode: "agentic", country: "US", currency: "USD" },
    limit: 24,
    filters: {
      availability: ["InStock"],
      // shortcut: a hard budget filter can return zero products; add a
      // broaden-and-rank fallback when empty results become a real case.
      ...(maxPrice ? { price: { max_price: maxPrice } } : {}),
    },
  };

  return cached(`channel3:${JSON.stringify(body)}`, async () => {
    const response = await fetch(CHANNEL3_URL, {
      method: "POST",
      headers: {
        "x-api-key": requireKey("CHANNEL3_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      throw new Error(
        `Channel3 API ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as { products?: Channel3Product[] };
    return data.products ?? [];
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function safeUrl(value: unknown, hosts: string[]) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") return null;
    if (!hosts.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cheapestOffer(product: Channel3Product) {
  const offers = (product.offers ?? []).filter(
    (
      offer,
    ): offer is Channel3Offer & {
      price: { price: number; currency: string };
    } =>
      typeof offer.price?.price === "number" &&
      offer.price.price > 0 &&
      typeof offer.price.currency === "string",
  );
  const stocked = offers.filter((offer) => offer.availability !== "OutOfStock");
  return (
    (stocked.length ? stocked : offers).sort(
      (a, b) => a.price.price - b.price.price,
    )[0] ?? null
  );
}

function toProduct(
  source: Channel3Product,
  ranked: { suspicion?: number; clueIds?: string[]; why?: string },
  clues: Clue[],
): Product | null {
  const id = String(source.id ?? "").trim();
  const name = String(source.title ?? "").trim().slice(0, 140);
  const offer = cheapestOffer(source);
  if (!id || !name || !offer) return null;

  const knownClues = new Set(clues.map((clue) => clue.id));
  const linked = Array.isArray(ranked.clueIds) ? ranked.clueIds : [];
  const clueIds = [
    ...new Set(
      linked
        .map((clueId) => String(clueId))
        .filter((clueId) => knownClues.has(clueId)),
    ),
  ].slice(0, 4);
  if (clueIds.length === 0) return null;

  const why =
    typeof ranked.why === "string"
      ? ranked.why.trim().replace(/\s+/g, " ").slice(0, 180)
      : "";
  if (!why) return null;

  const image =
    source.images?.find((item) => item.is_main_image) ?? source.images?.[0];
  const imageUrl = safeUrl(image?.cleaned_url ?? image?.url, [
    "cdn.trychannel3.com",
  ]);
  const color = source.colors?.[0]?.hex ?? "";
  const tint = /^#[0-9a-f]{6}$/i.test(color) ? color : "#8a8f96";

  return {
    id,
    name,
    priceMinor: Math.round(offer.price.price * 100),
    currency: offer.price.currency,
    emoji: "🎁",
    tint,
    suspicion: clamp(ranked.suspicion, 0, 100, 50),
    clueIds,
    why,
    imageUrl,
    url: safeUrl(offer.url, ["buy.trychannel3.com"]),
  };
}

function readClues(extraction: Extraction): Clue[] {
  const seenIds = new Set<string>();
  const seenText = new Set<string>();
  const clues: Clue[] = [];

  const items = Array.isArray(extraction.clues) ? extraction.clues : [];
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object") continue;
    const text = String(item.text ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
    if (!text || seenText.has(text.toLowerCase())) continue;

    let id = slugify(String(item.id ?? "")) || `clue-${index + 1}`;
    while (seenIds.has(id)) id = `${id.slice(0, 20)}-${index + 1}`;

    seenIds.add(id);
    seenText.add(text.toLowerCase());
    clues.push({ id, text });
    if (clues.length === 6) break;
  }

  return clues;
}

async function rankProducts(
  brief: string,
  clues: Clue[],
  catalog: Channel3Product[],
  retry = false,
) {
  const compact = catalog.map((product) => {
    const offer = cheapestOffer(product);
    return {
      id: product.id,
      title: product.title,
      brand: product.brands?.[0]?.name ?? null,
      category: product.category?.title ?? null,
      price: offer?.price.price ?? null,
      currency: offer?.price.currency ?? null,
      description: product.description?.slice(0, 280) ?? null,
      features: product.key_features?.slice(0, 3) ?? [],
    };
  });

  const system = `You are the detective in a gift-finding app. You have a witness statement, clues, and catalog search results. Choose the strongest gift leads and connect each to the clues it serves.

Return ONE JSON object, no prose, no markdown:
{"products":[{"id":"catalog id exactly as given","suspicion":0-100,"clueIds":["clue id"],"why":"1-2 sentences <= 180 chars"}]}

Rules:
- Pick 5-6 products, best first. If the catalog is weak, pick fewer rather than padding.
- Use only ids from the catalog. Do not invent products.
- Prefer variety: no more than two products from the same category. Build a varied list across categories, with at least one wearable and one small tool or accessory when the catalog allows.
- Penalize products that duplicate the recipient's own craft or that they could easily make themselves.
- clueIds: 2-4 per product, only from the given clue ids, no duplicates.
- suspicion: integer 0-100, higher is a stronger fit. Spread scores roughly 60-96. Penalize over-budget, screen-based, generic, duplicate-category, and age-awkward items.
- Respect hard constraints from the statement (budget, aversions).
- why: specific, dry, warm. Reference the clue meaning. Never invent materials, sizes, guarantees, or facts not in the catalog. Never state a number that is not in the catalog data or the clues. No exclamation marks.
- Tone example: "Cuts the glare on the water and sharpens his jawline. He will claim it is purely for the fish." Avoid list-like notes such as "graphite rod; under budget; no screens".`;

  const user = `WITNESS STATEMENT
${brief}

CLUES
${JSON.stringify(clues)}

CATALOG
${JSON.stringify(compact)}${
    retry
      ? "\n\nYour previous answer had no products with valid clue ids. Return at least 5 products using only catalog ids and only the clue ids above."
      : ""
  }`;

  return chatJson<Ranked>(system, user);
}

export async function generateCase(brief: string): Promise<GiftCase> {
  const extraction = await chatJson<Extraction>(
    `You are the detective in a gift-finding app. Read one witness statement and return ONE JSON object. No prose, no markdown fences.

Schema:
{
  "title": "short detective-style case title, <= 40 chars",
  "clues": [{ "id": "kebab-case", "text": "fact <= 40 chars" }],
  "log": ["3-4 terse log lines, present tense, <= 90 chars each"],
  "searchQuery": "3-8 word product search query",
  "budgetMax": number | null,
  "currency": "USD"
}

Rules:
- title is a nickname for the person, in the style of "The Fisherman Dad", "The Potter's Sister", "The Man Who Has Everything".
- 4-6 clues. Each is a concrete fact stated or directly implied: relationship, age, interests, aversions, style, budget. Never invent.
- Clue text reads like evidence, not a category: "Allergic to screens", not "Technology".
- ids: lowercase letters, digits, hyphens only; unique.
- log is the detective's case notes. Only facts from the statement. Adapt the relationship. Do not mention products.
- Tone examples (do not copy the facts):
  "Subject: the father. Age 58."
  "Known weakness: any device with a screen."
  "Obsession on file: fishing. Vanity: denied, but suspected."
- searchQuery is a broad gift search, not one product type. Describe the giftable interests and the person, not the budget or aversions. Example: "fishing gifts for men".
- budgetMax in USD if a budget is stated, otherwise null.`,
    brief,
  );

  const clues = readClues(extraction);
  if (clues.length < 2) {
    throw new BriefError(
      "That statement is too thin to work with. Add a couple of specifics about the person.",
    );
  }

  const budget = Number(extraction.budgetMax);
  const maxPrice =
    Number.isFinite(budget) && budget > 0 ? Math.min(budget, 10_000) : null;
  const query =
    String(extraction.searchQuery ?? "").trim().slice(0, 200) || brief;

  const rawProducts = await searchCatalog(query, maxPrice);
  const catalog = rawProducts
    .filter((product) => product.id && product.title && cheapestOffer(product))
    .slice(0, 24);

  if (catalog.length === 0) {
    throw new Error("The catalog returned no products for that brief.");
  }

  let ranked = await rankProducts(brief, clues, catalog);
  let products = collectProducts(ranked, catalog, clues);
  if (products.length === 0) {
    ranked = await rankProducts(brief, clues, catalog, true);
    products = collectProducts(ranked, catalog, clues);
  }
  if (products.length === 0) {
    throw new Error("The model could not connect the catalog results to the clues.");
  }

  // 6 products x 4 clue links stays under the 40-string board budget.
  products = products.slice(0, MAX_PRODUCTS);

  const log = (Array.isArray(extraction.log) ? extraction.log : [])
    .map((line) => String(line).trim().replace(/\s+/g, " ").slice(0, 90))
    .filter(Boolean)
    .slice(0, 4);
  if (log.length === 0) {
    log.push("Witness statement logged.", "Running the leads through the search…");
  }
  log.push(`Pulled ${catalog.length} suspects from the catalog.`);

  const title =
    String(extraction.title ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60) || titleFromBrief(brief);

  return {
    id: `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    brief,
    createdAt: new Date().toISOString(),
    log,
    clues,
    products,
  };
}

function collectProducts(
  ranked: Ranked,
  catalog: Channel3Product[],
  clues: Clue[],
) {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const seen = new Set<string>();
  const products: Product[] = [];

  const items = Array.isArray(ranked.products) ? ranked.products : [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id ?? "");
    const source = byId.get(id);
    if (!source || seen.has(id)) continue;

    const product = toProduct(source, item, clues);
    if (!product) continue;

    seen.add(id);
    products.push(product);
    if (products.length === MAX_PRODUCTS) break;
  }

  return products.sort((a, b) => b.suspicion - a.suspicion);
}
