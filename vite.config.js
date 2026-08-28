import {vitePlugin as remix} from '@remix-run/dev';
import {defineConfig} from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    // Vite blocks unrecognized Host headers by default. `shopify app dev`
    // proxies through a fresh Cloudflare quick-tunnel subdomain every time
    // it restarts, so a fixed hostname won't survive a restart -- allow
    // any host instead. This dev server is only reachable through that
    // private tunnel URL anyway, not the open internet.
    allowedHosts: true,
  },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true,
      },
    }),
  ],
  build: {
    assetsInlineLimit: 0,
  },
});
