# The Gift Case

A detective-themed gift finder built with Next.js. Describe the person in a witness statement and the app pins clues, suspects, and red string to a corkboard.

The original single-file prototype is preserved at [`docs/prototype.html`](./docs/prototype.html). Product requirements live in [`PRD.md`](./PRD.md).

## Run it

```bash
bun install
bun run dev
```

Open http://localhost:3000.

## Auth

Sign-in and sign-up are handled by [Clerk](https://clerk.com) via `@clerk/nextjs`. The provider is in `app/layout.tsx`, the Next 16 middleware is `proxy.ts`, and the routes are `app/sign-in/[[...sign-in]]` and `app/sign-up/[[...sign-up]]`. Keys live in `.env.local`; pull them with `bunx clerk@latest env pull` if they go missing.

Every page except sign-in/sign-up requires an account. API routes return a JSON `401` when signed out.

## Case generation

`POST /api/cases` runs the real pipeline:

1. NVIDIA NIM (`nvidia/nemotron-3.5-lightning-30b-a3b`) reads the brief and returns the case title, clues, log lines, budget, and a product search query.
2. Channel3 agentic search returns catalog products within the budget.
3. NVIDIA NIM ranks the products, links each to clues, and writes the detective notes.

Keys live in `.env.local` as `NVIDIA_API_KEY` and `CHANNEL3_API_KEY`. Development API responses are cached in `.cache/` (gitignored); delete that folder to force fresh calls.

## Credits & payments

Every signed-in user starts with 3 free case credits. Each case costs one credit. Packs are defined in `lib/credit-packs.ts` (currently $5 / 10 cases, $12 / 30 cases, $30 / 100 cases).

`/credits` sells packs through PayPal Orders v2 (hosted checkout, redirect flow). The server creates the order, PayPal returns the buyer to `/api/credits/capture`, and that route captures the payment and redirects to `/credits/complete`. PayPal Invoicing is a separate asynchronous invoice tool, so it is not used for instant credit purchases.

Environment keys:

- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` — PayPal REST app credentials.
- `PAYPAL_ENV` — `sandbox` (default) or `live`.
- `NEXT_PUBLIC_APP_URL` — optional public origin for PayPal return URLs; defaults to the request origin.

Credits and purchase IDs live in Clerk `privateMetadata`. This is a demo store; move balances to a transactional database and add a PayPal webhook before production.

## Other seams

- **History:** generated cases are saved to `localStorage` under `gift-case:cases:v1:<userId>`. Seeded cases come from `SEED_CASES`. Old unscoped history is migrated once.
- **Auth:** real accounts via Clerk; case history is still local to the browser.

## Structure

- `app/page.tsx` — case generation, log typing, credits, history state
- `app/credits/page.tsx` — credit balance and PayPal packs
- `app/api/credits/capture/route.ts` — PayPal return capture
- `app/credits/complete/page.tsx` — purchase confirmation
- `app/api/cases/route.ts` — auth, credit spend/refund, case pipeline
- `lib/credit-packs.ts` — prices and free grant
- `lib/credits.ts` — Clerk metadata balance and purchase idempotency
- `lib/paypal.ts` — Orders v2 auth, create, capture
- `components/Sidebar.tsx` — case history and Clerk account footer
- `components/CaseBoard.tsx` — clues, suspects, strings, detail panel
- `app/globals.css` — all styling and design tokens
