# The Gift Case — Product Requirements Document

**Status:** Draft v0.1 (derived from prototype)
**Source of truth for current behavior:** [`docs/prototype.html`](./docs/prototype.html) (original single-file prototype)
**Implementation:** Next.js 16 App Router + TypeScript in this repo. `POST /api/cases` runs NVIDIA NIM extraction/ranking and Channel3 agentic product search; see the README for the pipeline and environment keys.
**Owner:** [FILL IN: name]
**Last updated:** 2026-11-12
**Build target:** [FILL IN: launch date or milestone]

> **How to use this doc.** This PRD was reverse-engineered from the working prototype. The prototype is a single static page with hardcoded demo data. Everything marked `[FILL IN: …]` is a decision the implementation must make before or during the build. Everything marked **MUST / SHOULD / MAY** follows RFC 2119. Requirements are numbered (`FR-x`) so they can be referenced in tickets and tests.

---

## 1. Overview

The Gift Case is a gift-finding experience framed as a detective investigation. The user writes a free-text "witness statement" describing a person (age, interests, aversions, budget). The app then "opens a case": a noir investigation log types itself out, clues about the person are pinned to a corkboard as sticky notes, candidate gifts are pinned as "suspect" photos, and red string connects each gift to the clues it satisfies. Clicking a gift isolates its strings and shows the detective's reasoning.

**One-liner:** Describe the person; the detective finds the gift.

**Current prototype scope:** one page, one input, scripted animation, five fixed clues and six fixed products. No backend, no real search, no persistence, no links to buy anything.

---

## 2. Problem & opportunity

Gift shopping for a specific person is a search problem wrapped in a judgment problem:

- Generic "gift ideas for dads" lists ignore the constraints that actually matter — budget, "hates anything with a screen", "secretly cares how he looks".
- Users don't just need products; they need **reasons** they can defend ("this is why it fits him").
- The shortlist is usually assembled manually across tabs, reviews, and price checks.

The opportunity is to turn that labor into a single, shareable, delightful artifact: a case file that explains its own conclusions.

**Why this framing works:** the detective metaphor gives the recommendation system a natural way to be transparent (clues → evidence → suspect) without looking like a spreadsheet.

---

## 3. Goals & non-goals

### 3.1 Goals

| ID | Goal | Measure |
|----|------|---------|
| G1 | One brief becomes a relevant, explainable shortlist | ≥ 5 candidate gifts, each linked to ≥ 1 clue, in ≤ `[FILL IN: 10]` seconds |
| G2 | Every recommendation is justified | 100% of products render a `why` note referencing at least one real clue |
| G3 | The board is understandable at a glance | User can tell which gift matches which clue without instructions (usability test, `[FILL IN: n]` participants) |
| G4 | The experience is repeatable | User can open a second case with a new brief without reloading |
| G5 | It feels like a detective story, not a form | `[FILL IN: qualitative bar / SUS score target]` |

### 3.2 Non-goals (v1)

- Checkout, cart, or payments.
- Cross-device case history. Accounts exist via Clerk for sign-in, but cases stay in `localStorage` for v1.
- Reviews/ratings aggregation, price comparison across stores.
- Gift wrapping, delivery scheduling, group gifting.
- Mobile native apps.
- Real-time inventory guarantees.

Name any additional cuts here: `[FILL IN: …]`

---

## 4. Success metrics

| Metric | Definition | Target | Instrumentation |
|--------|------------|--------|-----------------|
| Case completion rate | % of opened cases that reach the fully revealed board | `[FILL IN: e.g. ≥ 70%]` | analytics event `case_revealed` |
| Time to first case | Submit → board fully revealed | `[FILL IN: ≤ 8s p75]` | client timing |
| Product inspection rate | % of cases where ≥ 1 product is clicked | `[FILL IN: ≥ 40%]` | `product_inspected` |
| Outbound click rate | Clicks on "view product" / affiliate links per case | `[FILL IN]` | `product_outbound_click` |
| Re-run rate | % of sessions that open ≥ 2 cases | `[FILL IN]` | `case_opened` count per session |
| Error rate | Failed case generations / total | `[FILL IN: < 2%]` | server logs |

`[FILL IN: add business metric — affiliate revenue, email capture, return visits.]`

---

## 5. Target users & jobs to be done

### 5.1 Primary user

A gift-giver who knows the person well enough to describe them, but not the product category. Typically shopping for a parent, partner, sibling, or close friend, with a budget in mind and limited time.

### 5.2 Secondary users

- The "last-minute but thoughtful" shopper (needs a defensible shortlist fast).
- The shared-link recipient ("look what I found for Dad") — may arrive on mobile with no context.

### 5.3 Jobs to be done

- "Help me turn what I know about this person into a shortlist I trust."
- "Give me a reason for each pick so I don't feel like I'm guessing."
- "Keep me inside my budget and away from things they'd hate."
- (Secondary) "Give me something fun to send to my sibling so we can agree."

### 5.4 Representative statements

- "My dad, 58, hates anything with a screen, lives for fishing, and would never admit he cares how he looks. Under $120."
- `[FILL IN: 3–5 additional real user statements collected from interviews.]`

---

## 6. Core experience & user flow

### 6.1 Happy path (as implemented)

1. **Landing.** Title "The Gift Case", subtitle "Describe the person. The detective does the rest." A "Witness statement" textarea is pre-filled with an example brief. Primary button: **Open the case**.
2. **Submit.** Button disables; the empty-board message disappears; the board and detail panel reset.
3. **Investigation log.** Four noir log lines type out sequentially in the log area.
4. **Clues pin in.** 5 sticky notes drop onto the corkboard one at a time (random slight rotation).
5. **Suspects pin in.** 6 product cards scale in one at a time, each with image block, name, price, suspicion bar, and a "PRIME SUSPECT" stamp reserved for the top result.
6. **Strings draw.** Red strings animate from clue pins to product pins, one per product↔clue link.
7. **Suspicion bars fill.** Each bar animates to its score width.
8. **Stamp.** The top product's "PRIME SUSPECT" stamp thuds in.
9. **Detail panel.** The panel summarizes the case and prompts the user to click a photo.
10. **Inspect.** Clicking a card isolates its strings (others dim to 10% opacity, its own thickens), lifts the card, and shows name, price, suspicion %, and the detective's note. Clicking it again clears the selection.

### 6.2 State machine

```
idle
  └─ submit (valid brief) ──► submitting ──► narrating ──► revealing ──► complete
                                                                          │
                                          click product ◄────────────────┤
                                                   │                      │
                                                   └──► inspecting ───────┤
                                                                          │
                                          new brief ──────────────────────┘

submitting/narrating/revealing ── error ──► failed (retry preserves brief)
submitting/narrating/revealing ── no results ──► empty (suggest broader brief)
```

**Rules**

- **MUST** prevent concurrent runs (prototype uses a `busy` flag; keep this behavior).
- **MUST** allow a new case after completion.
- **MUST** reset all board, log, selection, and detail state when a new case starts.
- **SHOULD** keep the typed log running while the real request is in flight, as perceived-progress theater; **MUST NOT** reveal products before real data arrives.
- **SHOULD** expose a cancel/abort path if generation exceeds `[FILL IN: 20s]`.

---

## 7. Functional requirements

### FR-1 — Brief intake

- **MUST** provide a labeled multiline textarea ("Witness statement").
- **MUST** pre-fill an example brief on first load. Example copy: `[FILL IN: keep the dad example or rotate examples?]`
- **MUST** block submission on empty/whitespace-only input.
- **MUST** cap input at `[FILL IN: 500]` characters and show a remaining-count or validation message.
- **MUST** disable the submit button while a case is running.
- **SHOULD** support Enter+Mod to submit from the textarea.
- **MAY** parse and display structured chips after submit (age, budget, interests) for user correction — see §9.
- The brief is free text; **MUST NOT** require separate form fields. `[FILL IN: confirm. If structured fields are added, define them here.]`

### FR-2 — Investigation log

- **MUST** render a sequence of short lines in a monospace, typewriter-styled log.
- Log content **MUST** be derived from the actual brief, not hardcoded. The prototype's four lines describe the example father only — this is demo data.
- **MUST** type at ~16 ms/character with ~180 ms pause per line in normal motion; under `prefers-reduced-motion: reduce`, render instantly.
- **SHOULD** announce the final state to assistive tech (see §11.5).
- **MUST** clear on a new case.
- If generation returns early, **MUST** finish or cut the log gracefully rather than blocking the reveal behind animation.
- **Copy requirements:** detective voice, present tense, no fabricated facts that are not in the brief. See §10.

### FR-3 — Clues (sticky notes)

- **MUST** render `[FILL IN: 4–7]` clues, each a short label derived from the brief.
- Each clue has a stable slug `id` (lowercase, letters/digits/hyphen) used to anchor strings. Duplicate/empty ids are invalid.
- **MUST** display 1–`[FILL IN: 2]` short lines; hard cap `[FILL IN: 40]` characters for layout.
- **MUST** pin with slight random rotation in `[-5°, +5°]` and a staggered drop-in animation.
- Clues are evidence, not categories: they should read as facts about the person ("Allergic to screens"), not taxonomy labels ("Technology").
- **MUST** remain legible at 320 px viewport width (wrap, don't clip).

### FR-4 — Suspect products

Each product card **MUST** include:

| Field | Prototype | Production requirement |
|-------|-----------|------------------------|
| Name | `n` | Product title from catalog, escaped |
| Price | `p` (display string, e.g. `"$89"`) | Formatted from `priceMinor` + `currency`; never trust a display string from the API |
| Image | `e` emoji + `c` background tint | Product image URL, 4:3 crop, lazy-loaded, emoji/initials fallback |
| Suspicion | `s` (integer 0–100) | Server-computed, clamped; formula in §9 |
| Clue links | `l` (array of clue ids) | **MUST** be non-empty and reference existing clues; drop invalid links |
| Note | `why` | 1–2 sentences, ≤ `[FILL IN: 180]` chars, references specific clue(s) |
| Ranking | array order | Sorted by suspicion desc; tie-break `[FILL IN: price asc? diversity?]` |
| CTA | none | **SHOULD** add "View this lead" outbound link with affiliate disclosure `[FILL IN: yes/no]` |

- **MUST** render `[FILL IN: 5–8]` products.
- **MUST** show a suspicion bar whose width equals the score.
- **MUST** mark exactly one card as "PRIME SUSPECT" — the top result. `[FILL IN: alternative rule, e.g. score ≥ 90]`
- **MUST** stagger entrance animations; reduce-motion users see the final state immediately.
- **MUST** be keyboard-focusable buttons with an accessible name including name, price, and suspicion.
- Clicking/tapping a card **MUST** select it (see FR-5). Clicking again **MUST** deselect.

### FR-5 — Evidence board

- **MUST** draw an SVG red string from every clue pin to every linked product pin.
- String geometry: quadratic Bézier; control point midway horizontally; sag = `30 + 0.08 × horizontalDistance` px (prototype formula). Preserve unless design revises.
- **MUST** draw endpoint dots at both pins.
- **MUST** redraw on resize, orientation change, and font load; debounce `[FILL IN: 120]` ms. Use `ResizeObserver` on the board rather than `window.resize` alone.
- **MUST** re-measure after entrance animations settle; strings must terminate on the visible pin, not the pre-animation position.
- **MUST** hide strings from assistive tech (`aria-hidden="true"`).
- **MUST** handle 0-link products by excluding them upstream (§9), so no orphan cards.
- **SHOULD** cap total strings at `[FILL IN: 40]` for performance; beyond that, show only top-N links per product.
- Selected state: all non-selected strings at ~10% opacity; selected strings thicker; selected card rotated to 0 and scaled ~1.04 with elevated z-index.

### FR-6 — Detail panel

- Default copy: "Click any photo on the board to read the detective's notes on it."
- Selected state **MUST** show: product name, formatted price, suspicion %, and the note.
- **MUST** use `aria-live="polite"` (prototype already does).
- **MUST** escape all API-provided content. The prototype interpolates `p.n` and `p.why` into `innerHTML`; this is a demo shortcut and an XSS risk with real data.
- **SHOULD** include the outbound product link here as well as on the card.
- **MAY** include a "why not?" note for near-miss products `[FILL IN: scope]`.

### FR-7 — New case / reset

- Submitting a new brief **MUST** fully reset: log, notes, products, strings, stamp, selection, detail panel, scroll position `[FILL IN: keep scroll at board?]`.
- **MUST** abort or ignore stale in-flight responses from a previous submission.

### FR-8 — Loading, empty, and error states

| State | Requirement |
|-------|-------------|
| Loading | Keep the log animating; detail panel shows "Gathering evidence…"; submit disabled. |
| No results | Detective-voice empty state suggesting a broader brief or larger budget; **MUST** preserve the brief. |
| API error | Inline, non-blaming error message; **MUST** re-enable submit and preserve the brief; offer Retry. Prototype has no error branch and leaves the button disabled if the search rejects — production must use `try/finally`. |
| Timeout | Client timeout at `[FILL IN: 20]` s, then error state. |
| Partial data | If 1+ products and 1+ clues are valid, render what exists and note that the case is incomplete `[FILL IN: acceptable?]`. |

### FR-9 — Persistence & sharing (MAY / scope decision)

- **MAY** store the last brief in `localStorage` for convenience. **MUST** disclose it `[FILL IN]`.
- **MAY** generate a shareable case URL. Decide: server-persisted case id vs. encoded state. `[FILL IN]`
- If shared links are in scope: **MUST** render read-only on open, **MUST** include OG title/description/image, **MUST** not expose raw personal data in the URL if avoidable `[FILL IN]`.

### FR-10 — Theme

- **MUST** follow `prefers-color-scheme` by default (already implemented in CSS).
- **MAY** expose a manual light/dark toggle. The CSS already supports `data-theme="light|dark"`; there is no UI control today. `[FILL IN: add toggle?]`

### FR-11 — Responsive layout

- **MUST** support 320 px–1440 px+.
- Notes wrap and center; products sit in an auto-fill grid with `minmax(150px, 1fr)`.
- Board keeps its wooden border and minimum height (360 px) without horizontal scrolling.
- **MUST** respect safe-area insets in standalone/PWA contexts (prototype sets `env(safe-area-inset-*)`).
- Tap targets **MUST** be ≥ 44×44 px.

---

## 8. Data model & API contract

### 8.1 Types

```ts
type ClueId = string; // slug: /^[a-z0-9-]+$/, unique within a case

interface Clue {
  id: ClueId;
  text: string;        // ≤ 40 chars, e.g. "Allergic to screens"
}

interface Product {
  id: string;          // catalog id
  name: string;
  priceMinor: number;  // integer, minor units (cents)
  currency: string;    // ISO 4217, e.g. "USD"
  imageUrl: string | null;
  emoji?: string;      // fallback visual
  tint?: string;       // fallback bg, hex
  suspicion: number;   // 0–100 integer
  clueIds: ClueId[];   // length ≥ 1
  why: string;         // detective note, ≤ 180 chars
  url?: string;        // outbound product page
}

interface Case {
  id: string;
  brief: string;
  clues: Clue[];
  products: Product[];
  primeSuspectId: string | null; // must match top-ranked product
  createdAt: string;             // ISO 8601
  model?: string;                // generation metadata
}
```

### 8.2 Endpoint

Recommended: server-side proxy so API keys never reach the browser.

```
POST /api/cases
Content-Type: application/json

{ "brief": "My dad, 58, hates anything with a screen…" }
```

Success `200`:

```json
{
  "id": "case_01H...",
  "clues": [
    { "id": "age", "text": "58 years old" },
    { "id": "tech", "text": "Allergic to screens" }
  ],
  "products": [
    {
      "id": "prod_123",
      "name": "Polarized Fishing Sunglasses",
      "priceMinor": 8900,
      "currency": "USD",
      "imageUrl": "https://...",
      "suspicion": 94,
      "clueIds": ["fish", "vain", "cash", "age"],
      "why": "Cuts the glare on the water and sharpens his jawline. He will claim it is purely for the fish.",
      "url": "https://..."
    }
  ],
  "primeSuspectId": "prod_123"
}
```

Errors: `400` invalid brief, `422` unparseable brief (no usable attributes), `429` rate limited, `502` upstream search failure, `504` timeout. Error body: `{ "error": { "code": "…", "message": "user-safe copy" } }`.

### 8.3 Upstream search

The prototype marks the intended integration:

```js
// docs/prototype.html:96-97
// client.products.search({ query: brief, config: { mode: "agentic" } })
```

- **FILL IN:** confirm provider (Channel3), SDK version, auth method, and response schema.
- **MUST** keep this call server-side.
- The upstream returns catalog products; the app must additionally produce **clues**, **clue links**, **suspicion scores**, and **why notes**. Decide where that happens: `[FILL IN: one agentic call that returns the whole case vs. search then a second LLM mapping/ranking step]`.
- **FILL IN:** latency budget for upstream (`p50` / `p95`), timeout, retry policy (recommend 1 retry on 5xx, no retry on 4xx).

### 8.4 Mapping & validation rules (server)

- Drop products with no image? `[FILL IN: no, use fallback]`
- Clamp `suspicion` to `0–100`; coerce non-integers.
- Drop links referencing unknown clue ids; drop products left with 0 links.
- Deduplicate products by `id` and near-duplicate names `[FILL IN]`.
- Enforce product count `[FILL IN: 5–8]`; if fewer than 5 valid results, either backfill or return a partial result per FR-8.
- Ensure exactly one `primeSuspectId`; derive from rank if omitted.
- Enforce string length caps and strip control characters.
- Never trust model-provided URLs; validate scheme and domain allowlist `[FILL IN]`.

### 8.5 Caching

- Cache case output by normalized brief hash + locale + currency for `[FILL IN: 24h]` to cut cost/latency. **MUST NOT** cache across users if output could include identifiable input `[FILL IN]`. The brief itself is personal data — see §12.

---

## 9. Recommendation & explanation logic

This is the product's core quality bar and is entirely `[FILL IN]` today: the demo scores were hand-authored.

### 9.1 Pipeline

```
brief
  → extract attributes (relationship, age, budget, interests, aversions, style, constraints)
  → search catalog (agentic mode)
  → hard filters (budget, age-appropriateness, availability, prohibited categories)
  → hard constraints from brief (e.g. "no screens", "no leather")
  → score each candidate
  → link each candidate to clues
  → write a 1–2 sentence why-note grounded in those clues
  → rank, trim, choose prime suspect
```

### 9.2 Attribute extraction

| Attribute | Required | Example | Notes |
|-----------|----------|---------|-------|
| Relationship | no | "dad" | Shapes copy, not necessarily search |
| Age | no | 58 | Avoid age-inappropriate gifts |
| Budget | SHOULD | "under $120" | `[FILL IN: hard cap or soft? include shipping/tax?]` |
| Interests | yes | fishing | Primary search signal |
| Aversions | no | "hates screens" | **MUST** be treated as exclusion/penalty |
| Style / vanity | no | "secretly vain" | Tone/link material |
| Occasion | no | birthday | `[FILL IN: does it change results?]` |

If no usable attributes can be extracted, return `422` with copy asking for one or two specifics. `[FILL IN: exact minimum bar]`

### 9.3 Suspicion score (proposal — calibrate)

```
raw = 100
  − budgetOverrunPenalty     // 25 per 10% over cap; disqualify if > cap × 1.0? [FILL IN]
  − aversionPenalty          // 40 if it violates a stated aversion; disqualify on hard constraint
  + clueCoverageBonus        // e.g. 8 per linked clue beyond the first
  − categoryRepetitionPenalty// if another result is the same category
  − weakEvidencePenalty      // if why-note can only cite a generic clue
clamp(raw, 0, 100)
```

- **MUST** be monotonic with clue coverage, all else equal.
- **MUST** be explained by the rendered clues — no score whose justification isn't visible on the board.
- **FILL IN:** final formula, weights, and thresholds. Calibrate against a labeled set of ≥ 20 briefs.
- The prototype range (63–94) reads well; keep the visual distribution similar `[FILL IN]`.

### 9.4 Why-notes

- **MUST** reference at least one clue by its meaning, not its id.
- **MUST NOT** invent product facts (materials, dimensions, guarantees) that aren't in the catalog.
- **MUST NOT** mention price unless it's true and useful.
- One or two sentences; dry, specific, warm. Avoid exclamation marks.
- **FILL IN:** prompt template and few-shot examples used for generation. Store the prompt in version control.

### 9.5 Quality examples

Use these as acceptance fixtures `[FILL IN: verify after real data]`:

| Brief | Must include | Must exclude |
|-------|--------------|--------------|
| Dad, 58, fishing, no screens, < $120 | Analog/outdoor gifts | Smartwatch, tablet, anything app-connected |
| Sister, 32, ceramics, cozy, < $60 | Studio/comfort items | Generic scented candles? `[FILL IN]` |
| `[FILL IN]` | | |

---

## 10. Content & tone

### 10.1 Voice

Hardboiled detective, played straight, affection for the subject. Short sentences. Concrete nouns. The joke is the format, not the products.

- **Do:** "Obsession on file: fishing. Vanity: denied, but suspected."
- **Don't:** "🎁 Perfect gift alert! Your dad will LOVE this amazing find!"
- **Avoid:** exclamation marks, emoji in voice copy, puns about "case" repeated more than the UI already does.

### 10.2 Lexicon

| Concept | Term |
|---------|------|
| Person described | Subject / the witness's person |
| Input | Witness statement |
| Clues | Clues / evidence |
| Products | Suspects / photos |
| Score | Suspicion |
| Top result | Prime suspect |
| Result page | The board / the case |

### 10.3 Fixed copy to finalize

| Slot | Prototype copy | Final copy |
|------|----------------|------------|
| Title | The Gift Case | `[FILL IN]` |
| Subtitle | Describe the person. The detective does the rest. | `[FILL IN]` |
| Input label | Witness statement | `[FILL IN]` |
| Button | Open the case | `[FILL IN]` |
| Empty board | The board is empty. Open a case to start pinning evidence. | `[FILL IN]` |
| Default detail | Click any photo on the board to read the detective's notes on it. | `[FILL IN]` |
| Result summary | Case closed… almost. The {product} connects to four clues. | `[FILL IN: must use real link count]` |
| Loading detail | Gathering evidence… | `[FILL IN]` |
| Error | — | `[FILL IN]` |
| No results | — | `[FILL IN]` |
| Stamp | PRIME SUSPECT | `[FILL IN]` |
| Footer | Dummy data. Swap in a real search at the marked spot in the script. | **Remove before launch** |

### 10.4 Log line templates

The prototype hardcodes four lines describing the example father. Production **MUST** generate lines from the brief, e.g.:

```
Subject: the {relationship}. Age {age}.
Known weakness: {aversion}.
Obsession on file: {interest}. {vanity clause}.
Running the leads through the search…
```

- **FILL IN:** line count (3–5), max characters per line (`[FILL IN: 90]`), and whether lines should stream from the model or be templated locally from extracted fields. Recommendation: template locally for determinism and latency.

---

## 11. Visual & interaction spec

All tokens below are extracted from the prototype and are the baseline unless revised.

### 11.1 Design tokens

| Token | Light | Dark |
|-------|-------|------|
| `--page` | `#e9dcc3` | `#17110b` |
| `--wood` | `#4a2f1a` | `#2b1b0f` |
| `--cork` | `#c4955d` | `#7b5836` |
| `--cork-dot` | `#a97a46` | `#5f4228` |
| `--paper` | `#f4edd8` | `#e2d9bd` |
| `--ink` | `#2a2118` | `#241c12` |
| `--note` | `#f6e06a` | `#d9c04f` |
| `--note-ink` | `#3a2f10` | `#2d2409` |
| `--red` | `#c8202b` | `#c8202b` |
| `--muted` | `#6e5b44` | `#a8957a` |
| `--shadow` | `rgba(30,15,5,.45)` | `rgba(0,0,0,.6)` |

- Corkboard texture: two layered radial-gradient dot patterns, sizes `14px` / `23px`, offset `0 0` / `7px 9px`; wooden border `14px`; inset shadow + drop shadow.
- Product photo background tint is per product (`--bg`), image height 96 px on the card.

### 11.2 Typography

- Display/body: **Special Elite** (Google Fonts), fallback `"Courier New", monospace`.
- Sticky notes: **Caveat** 600, fallback `"Comic Sans MS", cursive`; note size ~1.45 rem.
- H1: `clamp(1.6rem, 4.5vw, 2.6rem)`.
- Body line-height 1.5; content max-width 1100 px.
- **FILL IN:** self-host fonts for performance/privacy? (recommended: yes; subset Latin.)

### 11.3 Layout

- Page padding: 20 px top, 16 px sides, 48 px bottom.
- Notes: centered flex wrap, 18–22 px gaps, 64 px bottom margin before products (reserved visual breathing room).
- Products: CSS grid `repeat(auto-fill, minmax(150px, 1fr))`, 26×20 px gaps.
- Detail panel: paper background, 6 px red left border.

### 11.4 Motion

| Element | Behavior |
|---------|----------|
| Note entrance | `translateY(-40px)` → `rotate(var(--r))`, opacity 0→1, 450 ms `cubic-bezier(.3,1.6,.5,1)`; stagger 260 ms |
| Product entrance | `scale(1.25)` → `rotate(var(--r))`, opacity 0→1, 400 ms `cubic-bezier(.3,1.5,.5,1)`; stagger 220 ms |
| String draw | stroke-dashoffset reveal, 600 ms ease-out, stagger 70 ms per string |
| Stamp | scale 2.2 → 1, 350 ms ease-out ("thud") |
| Suspicion bar | width transition 800 ms with 200 ms delay |
| Log typing | 16 ms/char, 180 ms per line |
| Caret | 1 s stepped blink |

- **FILL IN:** should motions be interruptible if the user interacts mid-reveal? Recommendation: allow inspection immediately; animations continue behind it.
- **FILL IN:** max total entrance duration cap (`e.g. ≤ 6s` regardless of result count).

### 11.5 Accessibility

Already present: focus-visible outlines (3 px red, 2 px offset), `aria-label` on product buttons, `aria-live="polite"` on detail, strings hidden from AT, reduced-motion media query.

**MUST add/fix:**

- Log container should be `aria-live="polite"` or have a status region so screen readers aren't left waiting; do not announce every keystroke. Announce "Case opened. N clues, M suspects."
- Board regions should have accessible structure: headings for "Clues" and "Suspects", notes as a list, products as a list/grid with button semantics preserved.
- Selection state **MUST** be conveyed beyond color/opacity (`aria-pressed` or a visually hidden status).
- Keyboard: Tab to cards, Enter/Space to select, Escape to clear selection.
- Contrast: verify `--note-ink` on `--note`, `--muted` on `--page`, and red on paper meet WCAG AA. `[FILL IN: audit results]`
- Motion: honor reduced motion for typing, entrances, string draw, stamp, and bar fill (show final state).
- Zoom to 200% without loss of content.

### 11.6 Dark mode

- System preference is respected; there is no manual toggle yet.
- The corkboard in dark mode must retain enough contrast for notes/strings. `[FILL IN: visual QA]`

---

## 12. Technical architecture

### 12.1 Recommendation

Implemented as a **Next.js 16 App Router** project with TypeScript and plain CSS (no Tailwind). The board and case history are live; case generation is still the dummy in `lib/cases.ts`. The target architecture is:

```
Browser (Next.js client components)
  app/page.tsx, components/*
    → POST /api/cases (to build)
        → server: parse/validate → catalog search → rank/explain → validate → respond
            → provider SDK (server-side key)
```

- **Decided:** Next.js 16.4 App Router, TypeScript, plain CSS, Bun for package management.
- **Decided:** Clerk (`@clerk/nextjs`) for authentication; sign-in/sign-up routes and `proxy.ts` middleware. Case data is not yet user-scoped.
- **FILL IN:** hosting target (Vercel/Netlify/Cloudflare), Node version, region.
- **FILL IN:** environment variables (`PRODUCT_SEARCH_API_KEY`, `MODEL_API_KEY`, `ALLOWED_ORIGIN`, cache TTL).
- **MUST** configure CORS, request size limits, and rate limiting per IP/session.

### 12.2 Current file structure

```
/
  app/
    layout.tsx        fonts, metadata, ClerkProvider
    page.tsx          case generation, log typing, history state
    globals.css       all styling and design tokens
    sign-in/[[...sign-in]]/page.tsx   Clerk sign-in
    sign-up/[[...sign-up]]/page.tsx   Clerk sign-up
    api/cases/route.ts  POST /api/cases
  components/
    CaseBoard.tsx     clues, suspects, strings, detail panel
    Sidebar.tsx       case history, new case, Clerk account footer
  lib/
    cases.ts          seed cases + formatting helpers
    generate-case.ts  NIM extraction, Channel3 search, NIM ranking
    cache.ts          dev-only upstream response cache
    types.ts
    useReducedMotion.ts
  proxy.ts            Clerk middleware (Next 16)
  docs/
    prototype.html    original single-file prototype
  PRD.md
```

Server logic lives in `lib/generate-case.ts` behind `app/api/cases/route.ts`. Split it into extraction, search, ranking, and validation modules if it grows. `[FILL IN: tests and fixtures.]`

### 12.3 Client behavior notes (from prototype)

- Keep a `busy` guard and disable submit during a run.
- Use `try/finally` so the UI recovers from failed requests.
- Abort stale requests with `AbortController` if a new case starts.
- Redraw strings using measured pin centers; re-measure after reveal and on resize.
- Avoid index-based ids (`prod-0`) for anything persisted; use stable product ids for keys and analytics.
- Build SVG nodes with DOM APIs; never inject untrusted strings via `innerHTML`.
- Cache DOM references; the prototype re-queries selectors in loops.

### 12.4 Performance budgets

| Budget | Target |
|--------|--------|
| Initial HTML+CSS+JS | `≤ 150 KB` gzipped, excluding images/fonts `[FILL IN]` |
| LCP | `≤ 2.0s p75` |
| Case generation | `≤ 8s p75` end-to-end |
| Animation frame health | 60 fps during reveal on mid-tier mobile `[FILL IN]` |
| CLS | `< 0.1` |

**FILL IN:** image CDN/transform rules; whether product images are proxied.

### 12.5 Observability

- Structured server logs: request id, brief hash (not raw brief), latency, provider status, result counts.
- Client error capture `[FILL IN: Sentry or equivalent]`.
- Alerts: error rate > 2%, p95 latency > 15s, zero-result rate > 20%.

---

## 13. Security, privacy & compliance

- **Personal data:** briefs contain age, interests, relationship, sometimes health/aversion details. Treat as personal data.
  - **MUST NOT** log raw briefs by default.
  - **FILL IN:** retention policy for briefs and generated cases (recommend: no persistence in v1; or `24h` cache with hashed key).
  - **MUST** disclose data sent to third-party search/model providers `[FILL IN: copy + link]`.
- **Secrets:** API keys server-side only.
- **XSS:** all provider/model strings escaped before rendering; no `innerHTML` with untrusted content; sanitize URLs and allowlist schemes/domains.
- **Prompt injection:** the brief is untrusted input into any LLM step. Delimit it, ignore instructions inside it, and validate output structurally. `[FILL IN: guardrail approach]`
- **Abuse:** rate limit, max input length, block repeated identical submissions `[FILL IN]`.
- **Links:** outbound links use `rel="noopener noreferrer"`, plus `sponsored` if monetized.
- **Affiliate:** disclose clearly near product links/`[FILL IN: placement]`.
- **Children's data:** if the subject could be a minor, `[FILL IN: policy]`.

---

## 14. QA & acceptance criteria

### 14.1 Definition of done

- [ ] All `[FILL IN]` decisions in scope for v1 are resolved.
- [ ] Every FR has at least one automated or scripted test where practical.
- [ ] Lighthouse accessibility ≥ 95 `[FILL IN]`.
- [ ] Manual pass on iOS Safari, Android Chrome, desktop Chrome/Safari/Firefox `[FILL IN: versions]`.
- [ ] Error, empty, slow, and reduced-motion paths verified.
- [ ] Copy reviewed for tone and factual grounding.
- [ ] Privacy disclosure and data handling reviewed.

### 14.2 Acceptance tests

| # | Given | When | Then |
|---|-------|------|------|
| 1 | Default example brief | Submit | Board shows `[FILL IN: 5]` clues and `[FILL IN: 6]` products; exactly one prime suspect; every product has ≥ 1 string |
| 2 | Any revealed case | Click product A | Only A's strings are highlighted; A is raised; detail shows A's name, price, score, note |
| 3 | Same case | Click A again | Selection clears; all strings restore; default detail copy returns |
| 4 | Revealed case | Resize to 375 px and back | Every string endpoint stays within ~1 px of its pins |
| 5 | Reduced motion enabled | Submit | No typing animation, no staggered entrances, no string draw, no stamp animation; final board correct |
| 6 | Empty input | Submit | Blocked with validation; no request |
| 7 | Double-click submit | Submit twice rapidly | Exactly one case generated/rendered |
| 8 | Provider error | Submit | Error message shown, brief preserved, retry works, button re-enabled |
| 9 | Brief with no usable attributes | Submit | `422` handled with guidance; no broken board |
| 10 | Zero products | Submit | Empty state shown; brief preserved |
| 11 | Over-budget brief | Submit | No product exceeds the cap `[FILL IN: strictness]` |
| 12 | Aversion in brief ("no screens") | Submit | No screen-based product appears |
| 13 | Dark mode | Load and submit | All text, notes, strings, and borders remain legible; no white flash |
| 14 | Keyboard only | Navigate board | Focus visible; Enter/Space selects; Escape clears; detail announced |
| 15 | Two cases in a row | Submit B after A | No stale notes, strings, stamp, detail, or timers from A |
| 16 | Shared link (if in scope) | Open in new session | Case renders read-only and matches original |

### 14.3 Edge cases to cover

- Very long brief at the character cap.
- Brief in another language `[FILL IN: supported locales]`.
- Currency mismatch between brief and catalog.
- Brief that names multiple people ("for my mom and dad").
- Unrealistic budget ("under $5").
- Offensive or inappropriate input.
- Products with missing images, long names, or missing prices.
- Very narrow (320 px) and very wide (ultrawide) viewports.
- Browser zoom 200%; large text settings.

---

## 15. Prototype → production delta

| # | Prototype shortcut | Production requirement |
|---|--------------------|------------------------|
| 1 | `NOTES` and `PRODUCTS` are hardcoded demo data | Real search + extraction + scoring per case |
| 2 | `LOG` lines describe only the example father | Generate from the brief (templated from extracted fields) |
| 3 | `searchCase()` returns after a 300 ms sleep | Real `POST /api/cases`; error/timeout/abort handling |
| 4 | `openCase()` has no `catch`/`finally` | Recover UI on failure; always re-enable submit |
| 5 | Price is a display string (`"$89"`) | Integer minor units + ISO currency, formatted at render |
| 6 | Product visual is an emoji + tint | Real image URL with fallback |
| 7 | Suspicion scores are hand-set | Defined, testable formula (§9), clamped server-side |
| 8 | Clue links are hand-set | Generated and validated; no unknown ids; no orphan products |
| 9 | `why` notes are hand-written | Generated, grounded, validated for length and facts |
| 10 | `innerHTML` interpolation of product fields | Escaped text nodes / safe templating |
| 11 | No outbound product URL or CTA | Add link + affiliate disclosure (if monetized) |
| 12 | Strings redraw on every resize event, demo-specific guard (`#note-age`) | Debounced/observed redraw independent of demo ids |
| 13 | `#prod-i` and array-index selects | Stable ids for keys, analytics, and persistence |
| 14 | No analytics | Event plan (§4) |
| 15 | Footer says "Dummy data…" | Remove before launch |
| 16 | No sharing/persistence | Decide scope (FR-9) |
| 17 | No theme toggle despite CSS support | Add control or remove unused `data-theme` rules |
| 18 | No rate limiting / input caps | Enforce server-side |
| 19 | No structured a11y semantics for log/board | Add live region, lists/headings, selection state |
| 20 | Only one example brief | Provide 3–5 examples and test fixtures |

---

## 16. Build plan

| Milestone | Scope | Exit criteria | Date |
|-----------|-------|---------------|------|
| M0 — Decisions | Resolve all v1 `[FILL IN]` items; pick provider, stack, hosting | PRD signed off | `[FILL IN]` |
| M1 — Backend contract | `/api/cases`, validation, provider integration, fixtures | Endpoint returns valid case JSON for 10 briefs | `[FILL IN]` |
| M2 — Real data UI | Replace demo arrays; loading/error/empty states | Happy path + failure path usable | `[FILL IN]` |
| M3 — Board interactions | Strings, selection, resize, reduce-motion, abort/stale handling | Acceptance tests 1–7, 15 pass | `[FILL IN]` |
| M4 — Quality & a11y | Scoring calibration, copy, contrast, keyboard, screen reader | Tests 8–14 pass; a11y audit clean | `[FILL IN]` |
| M5 — Launch | Hosting, analytics, rate limits, privacy copy, OG/share (if scoped) | DoD complete | `[FILL IN]` |

---

## 17. Open questions

| # | Question | Owner | Answer |
|---|----------|-------|--------|
| 1 | Which product search provider and plan? Confirm Channel3 + `mode: "agentic"` | `[FILL IN]` | |
| 2 | One agentic call for the whole case, or search then separate ranking/explanation? | `[FILL IN]` | |
| 3 | Is monetization (affiliate) in v1? Disclosure placement? | `[FILL IN]` | |
| 4 | Is persistence/sharing in v1? Server case ids or encoded URLs? | `[FILL IN]` | |
| 5 | Framework: stay vanilla or adopt one? | `[FILL IN]` | |
| 6 | Exact suspicion formula and calibration set | `[FILL IN]` | |
| 7 | Budget handling: hard cap, soft cap, includes shipping/tax? | `[FILL IN]` | |
| 8 | Currency/locale support in v1 | `[FILL IN]` | |
| 9 | Retention policy for briefs and generated cases | `[FILL IN]` | |
| 10 | Manual theme toggle? | `[FILL IN]` | |
| 11 | Product count and clue count ranges | `[FILL IN]` | |
| 12 | Age-appropriateness rules (gifts for minors) | `[FILL IN]` | |

---

## Appendix A — Prototype inventory

Useful map when migrating code:

| Concern | Location in `docs/prototype.html` |
|---------|--------------------------|
| Theme tokens (light/dark) | lines 10–25 |
| Page layout & typography | lines 26–41 |
| Board, notes, products, strings, stamp | lines 42–65 |
| Markup (input, log, board, detail) | lines 70–93 |
| Demo clues (`NOTES`) | lines 98–104 |
| Demo products (`PRODUCTS`) | lines 105–112 |
| Demo log (`LOG`) | lines 113–118 |
| Typing effect | lines 125–132 |
| String geometry & draw | lines 134–156 |
| Selection/dim logic | lines 158–169 |
| Demo search stand-in | line 172 |
| Case orchestration | lines 174–200 |
| Resize redraw | line 203 |

**Prototype-specific gotchas:** `drawStrings` looks up `#note-<id>` so clue ids must be slug-safe and unique; selection uses product array indices; only the first `.stamp` is activated; the resize guard checks for `#note-age`, which only exists for the demo brief; the log is decorative and not tied to request progress; failed generations would leave the submit button disabled.

---

## Appendix B — Test briefs

Fill in and keep as fixtures. Each should have an expected must-include / must-exclude set.

1. **The dad (current demo):** "My dad, 58, hates anything with a screen, lives for fishing, and would never admit he cares how he looks. Under $120."
2. **The ceramicist:** `[FILL IN]`
3. **The new homeowner:** `[FILL IN]`
4. **The minimalist with a strict budget:** `[FILL IN]`
5. **The hard-to-read teenager:** `[FILL IN]`
6. **Adversarial:** prompt-injection style input; must not alter system behavior. `[FILL IN]`
7. **No attributes:** "Something nice." Expected: guidance or generic-but-explainable results `[FILL IN: decide]`

---

*End of document.*
