# Shop Boost Labs Dropshipping App — Embedded Shopify App (v0.1, free)

This is the foundation: a real Shopify app that **any merchant can install
from their own admin**, not one tied to your store specifically. It's
separate from the Hydrogen storefront project — this is the multi-merchant
tool, that one was your personal store.

## What works right now
- OAuth install flow — any merchant can add this to their store
- Embedded admin page (shows inside Shopify's own admin UI, via App Bridge + Polaris)
- CSV product import — paste `title,price,description,imageUrl` rows, they
  get created as draft products in *that specific merchant's* store, using
  *their* access token (not yours)
- Every import is logged in the database (`ImportedProduct` table) — this is
  the piece that makes "5% of sales from imported products" trackable later,
  even though billing isn't wired up yet
- **CJ Dropshipping integration (added 2026-08-27, NOT YET LIVE-TESTED):**
  - Supplier settings page (`/app/settings`) where a merchant links their
    OWN CJ Dropshipping API key — orders are paid from *their* CJ balance,
    never Shop Boost Labs' money, same model as DSers linking a merchant's
    own AliExpress account
  - `app/suppliers/cj-dropshipping.server.js` — API client for auth
    (token fetch/cache/refresh), product search, and order placement,
    written against CJ's documented API v2.0
  - `webhooks.orders.create.jsx` — the actual "no third-party app needed"
    piece: fires on every new order, checks if any line items are linked
    to a CJ product (`SupplierLink` table), and places the CJ order
    automatically if so, logging the result in `SupplierOrder`
  - New Prisma models: `SupplierCredential`, `SupplierLink`, `SupplierOrder`

## What's intentionally not built yet
- **Nothing yet actually links a Shopify product to a CJ product.** The
  `SupplierLink` table and the fulfillment webhook are ready, but there's
  no UI yet to search CJ's catalog and create that link when importing a
  product — right now `SupplierLink` rows would have to be created by hand.
  This is the next real piece of work.
- No live catalog browsing from CJ yet in the Discover-style sense —
  `searchProducts`/`getProductDetail` exist in the client but aren't wired
  into any UI.
- No billing — this version is free, by design, so people can try it and
  leave reviews before you turn on the 5% usage charge.
- No storefront generation yet — that's the Hydrogen piece, kept separate
  for now since it's architecturally a different thing (per-merchant hosted
  storefront vs. an admin-embedded tool).

## Running it locally (first time setup)

### 1. Install dependencies
```bash
cd shop-boost-labs-dropshipping-app
npm install
```

### 2. Create the app in your Partner account
You'll need a free Shopify Partner account (partners.shopify.com) if you
don't have one yet — this is separate from your store admin.

```bash
npx shopify app config link
```
This opens a browser to authenticate, and asks you to either connect to an
existing app or create a new one in your Partner dashboard. It fills in
`SHOPIFY_API_KEY` and updates `shopify.app.toml` for you.

### 3. Set up the local database
```bash
npx prisma migrate dev --name init
```

### 4. Run it
```bash
npm run dev
```
This starts a local tunnel, opens a browser, and lets you install the app
on a development store (use `clearhaven8.myshopify.com` or a separate dev
store — either works for testing).

## Testing the full loop
1. Install the app on a test store
2. Go to the "Import products" page
3. Paste a couple of CSV rows
4. Check the store's product list in Shopify Admin — the drafts should be there
5. Check `prisma studio` (`npx prisma studio`) to see the `ImportedProduct` log

## Next milestones (no rush, build these when ready)
- [ ] Build the "link this product to a CJ product" flow — search CJ's
      catalog (client already supports this), pick a product/variant, save
      a `SupplierLink` row. This is what actually turns on auto-fulfillment
      for a given product.
- [ ] Get a real CJ Dropshipping account + API key and test the full loop
      end to end: link a product, place a real test order, confirm the CJ
      order gets created and `SupplierOrder` logs it correctly
- [ ] Move from SQLite to a hosted Postgres database (needed once real
      merchants install it, not just you testing)
- [ ] Deploy somewhere permanent (Shopify's own Oxygen hosting, Railway, or Fly.io)
- [ ] Submit for Shopify App Store listing once you're ready for public discovery
- [ ] Add usage-based billing (5% of sales) once you're ready to charge —
      this is a Partner Dashboard config change plus reporting usage events,
      no rebuild needed of what's here
