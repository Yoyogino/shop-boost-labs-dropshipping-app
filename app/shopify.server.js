import '@shopify/shopify-app-remix/adapters/node';
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from '@shopify/shopify-app-remix/server';
import {PrismaSessionStorage} from '@shopify/shopify-app-session-storage-prisma';
import prisma from './db.server';

// Shop Boost Labs' own revenue model: usage-based billing, 5% of the value
// of any order containing a product imported through this app. This is
// separate from CJ Dropshipping payment entirely -- merchants pay their own
// CJ balance for supplier orders (see app/suppliers/cj-dropshipping.server.js);
// this plan is what Shop Boost Labs itself earns. $100/mo capped amount and
// a 14-day free trial, decided 2026-08-28. See app/billing/billing.server.js
// for where usage records actually get created (from the orders/create webhook).
export const USAGE_PLAN = 'Shop Boost Labs Usage Plan';

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(','),
  appUrl: process.env.SHOPIFY_APP_URL || '',
  authPathPrefix: '/auth',
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    [USAGE_PLAN]: {
      lineItems: [
        {
          amount: 100,
          currencyCode: 'USD',
          interval: BillingInterval.Usage,
          usageTerms: '5% of the value of each order containing a product imported through this app',
        },
      ],
      trialDays: 14,
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? {customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN]}
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
