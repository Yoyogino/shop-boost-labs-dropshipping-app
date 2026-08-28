import {json} from '@remix-run/node';
import {Link, Outlet, useLoaderData, useRouteError} from '@remix-run/react';
import {boundary} from '@shopify/shopify-app-remix/server';
import {AppProvider} from '@shopify/shopify-app-remix/react';
import {NavMenu} from '@shopify/app-bridge-react';
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url';
import {authenticate, USAGE_PLAN} from '../shopify.server';

export const links = () => [{rel: 'stylesheet', href: polarisStyles}];

export const loader = async ({request}) => {
  const {billing} = await authenticate.admin(request);

  // Gate every /app/* page behind an active billing subscription (with a
  // 14-day free trial). billing.require() checks Shopify directly -- no
  // subscription state to keep in sync ourselves. On first install (or if
  // a merchant ever declines/cancels), this redirects out of the iframe to
  // Shopify's own approval screen, then back into the app once approved.
  await billing.require({
    plans: [USAGE_PLAN],
    onFailure: async () =>
      billing.request({
        plan: USAGE_PLAN,
        isTest: process.env.NODE_ENV !== 'production',
      }),
  });

  return json({apiKey: process.env.SHOPIFY_API_KEY || ''});
};

export default function App() {
  const {apiKey} = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/import">Import products</Link>
        <Link to="/app/link-supplier">Link to supplier</Link>
        <Link to="/app/settings">Supplier settings</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
