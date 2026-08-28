// The missing landing route. Shopify's app_url points at the bare "/" path
// (both the embedded admin iframe and a direct visit hit this first) -- this
// project never had a route for it, so every request to "/" was a 404 with
// nothing rendered (root.jsx has no ErrorBoundary, so it showed blank white
// instead of a visible error). Added 2026-08-27 after tracing that down.
//
// Mirrors the standard Shopify Remix template's index route: if a `shop`
// param is present (Shopify always includes one when it loads the app),
// hand off straight to /app, which is where the real auth check
// (authenticate.admin) and the actual UI live. If there's no shop param --
// someone just visiting the bare tunnel URL with nothing appended -- show a
// minimal placeholder instead of a blank page.
import {redirect} from '@remix-run/node';

export const loader = async ({request}) => {
  const url = new URL(request.url);

  if (url.searchParams.get('shop')) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function Index() {
  return (
    <div style={{fontFamily: 'sans-serif', padding: '2rem'}}>
      <h1>Shop Boost Labs Dropshipping App</h1>
      <p>This app is installed from the Shopify admin -- open it from your store's Apps list.</p>
    </div>
  );
}
