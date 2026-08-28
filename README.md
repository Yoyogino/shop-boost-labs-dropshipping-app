# Shop Boost Labs Dropshipping App — Embedded Shopify App (v0.1, free)

This is a real Shopify app that any merchant can install from their own admin, not one tied to your store specifically. It's separate from the Hydrogen storefront project — this is the multi-merchant tool, that one was your personal store. It's an app *like* DSers: it places supplier orders automatically when a customer buys, with no third-party app or manual step for the merchant — not a DSers integration.

## Status (Aug 27, 2026): works end to end, proven against a real CJ account

Every piece of the pipeline has been tested against real data, not just written and hoped for:

install → connect a real CJ Dropshipping account → search CJ's real catalog → link a real Shopify product to a real CJ product → place a real Shopify order → the webhook auto-fires and places a real order with CJ.

The only thing stopping a fully completed order is that the CJ account currently has $0 balance — CJ rejected payment with "Balance is insufficient" but otherwise accepted everything (real `orderId`, real pricing: $20.25 product + $14.24 shipping = $34.49). The code path and field mapping are confirmed correct; funding the account is what's left.

## What works right now

- **OAuth install flow** — any merchant can add this to their store
- **Embedded admin page** (shows inside Shopify's own admin UI, via App Bridge + Polaris)
- **CSV product import** — paste `title,price,description,imageUrl` rows, they get created as draft products in that specific merchant's store, using their access token (not yours). Every import is logged in the database (`ImportedProduct` table).
- **CJ Dropshipping integration — live-tested against a real account:**
  - `/app/settings` — a merchant links their OWN CJ Dropshipping API key. Orders are paid from their own CJ balance, never Shop Boost Labs' money — same model as DSers linking a merchant's own AliExpress account.
  - `app/suppliers/cj-dropshipping.server.js` — API client for auth (token fetch/cache/refresh), product search, product detail, and order placement (balance-payment mode). Confirmed against real CJ API responses, not just CJ's documented shapes.
  - `/app/link-supplier` — search CJ's real catalog, view a product's real variants, and link one to a Shopify product/variant. Confirmed working end to end with a real account.
  - `webhooks/orders/create.jsx` — the "no third-party app needed" piece: fires on every new order, checks if any line items are linked to a CJ product (`SupplierLink` table), and places the CJ order automatically if so, logging the result in `SupplierOrder`. Handles Shopify's at-least-once webhook delivery safely (upsert, not create — a duplicate delivery won't crash it).
  - Prisma models: `SupplierCredential`, `SupplierLink`, `SupplierOrder`

## What's intentionally not built yet

- **Funding**: the CJ account needs a real balance before a test order can fully complete (currently $0 — this is a funding step, not a code gap).
- **No error/retry UI** — if a CJ order fails, it's logged to `SupplierOrder` but nothing yet notifies the merchant or offers a retry from the admin UI.
- **Still SQLite** — fine for local testing, needs hosted Postgres before real merchants use it.
- **No billing** — this version is free, by design, so people can try it and leave reviews before usage-based billing (5% of sales) is turned on.
- **No storefront generation** — that's the Hydrogen piece, kept separate since it's architecturally a different thing (per-merchant hosted storefront vs. an admin-embedded tool).

## Running it locally (first time setup)

1. Install dependencies

   ```
   cd dropship-app
   npm install
   ```

2. Create the app in your Partner account

   You'll need a free Shopify Partner account (partners.shopify.com) if you don't have one yet — this is separate from your store admin.

   ```
   npx shopify app config link
   ```

   This opens a browser to authenticate, and asks you to either connect to an existing app or create a new one in your Partner dashboard. It fills in `SHOPIFY_API_KEY` and updates `shopify.app.toml` for you.

3. Create your `.env` file (not committed — see `.gitignore`)

   You'll need `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` (from the Partner Dashboard), `SCOPES`, and `SHOPIFY_APP_URL`.

4. Set up the local database

   ```
   npx prisma migrate dev --name init
   ```

5. Run it

   ```
   npm run dev
   ```

   This starts a local tunnel, opens a browser, and lets you install the app on a development store.

## Testing the full loop

1. Install the app on a test store
2. Go to Supplier settings (`/app/settings`) and paste a CJ Dropshipping API key
3. Go to "Link products to a supplier" (`/app/link-supplier`), search CJ's catalog, and link a variant to one of your Shopify products
4. Place a real order for that product in the Shopify admin
5. Check the store's order — the `orders/create` webhook should fire and place a matching CJ order automatically
6. Check `prisma studio` (`npx prisma studio`) to see the `SupplierOrder` log (status `placed` or `failed` with a reason)

## Next milestones

- Fund the CJ Dropshipping account and confirm a fully successful paid order
- Remove temporary debug logging around CJ order placement once a paid order is confirmed
- Add merchant-facing error/retry notification for failed supplier orders
- Move from SQLite to a hosted Postgres database
- Deploy somewhere permanent (Shopify's own Oxygen hosting, Railway, or Fly.io)
- Submit for Shopify App Store listing
- Add usage-based billing (5% of sales) once ready to charge
