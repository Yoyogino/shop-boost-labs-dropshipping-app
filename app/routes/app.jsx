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

  // TEMPORARILY DISABLED (2026-08-28): billing.require() calls Shopify's
  // Billing API on every single /app/* page load. Shopify rejects that call
  // with a 403 -- "Apps without a public distribution cannot use the
  // Billing API" -- for any app not yet on Public distribution. Since this
  // check was wired in before Distribution was confirmed Public, it broke
  // every page of the app with "Application Error." Commenting it out here
  // so the app is usable again (screenshots, testing) while Distribution
  // gets sorted in the Partner Dashboard. RE-ENABLE by uncommenting below
  // once Distribution is confirmed Public -- billing won't actually charge
  // anyone until this is back on.
  //
  // await billing.require({
  //   plans: [USAGE_PLAN],
  //   onFailure: async () =>
  //     billing.request({
  //       plan: USAGE_PLAN,
  //       isTest: process.env.NODE_ENV !== 'production',
  //     }),
  // });

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
