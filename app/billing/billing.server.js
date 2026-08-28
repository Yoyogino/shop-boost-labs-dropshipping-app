// Shop Boost Labs' own revenue: 5% of the value of any order line item
// that's a product imported through this app (CSV import today, more
// import sources later). Completely separate from CJ Dropshipping payment
// -- merchants pay CJ out of their own CJ balance for supplier orders; this
// is what Shop Boost Labs itself earns, charged via Shopify's usage-based
// billing (see USAGE_PLAN in app/shopify.server.js: $100/mo cap, 14-day
// free trial, decided 2026-08-28).
//
// Triggers on ANY order containing an imported product -- not just orders
// that got auto-fulfilled through CJ. A merchant who imports a product via
// CSV but fulfills it themselves still owes the 5% on that sale.
import prisma from '../db.server';

const USAGE_FEE_RATE = 0.05;

const ACTIVE_USAGE_LINE_ITEM_QUERY = `#graphql
  query ActiveUsageLineItem {
    currentAppInstallation {
      activeSubscriptions {
        id
        status
        lineItems {
          id
          plan {
            pricingDetails {
              __typename
              ... on AppUsagePricing {
                cappedAmount { amount currencyCode }
              }
            }
          }
        }
      }
    }
  }
`;

const APP_USAGE_RECORD_CREATE_MUTATION = `#graphql
  mutation AppUsageRecordCreate($subscriptionLineItemId: ID!, $description: String!, $price: MoneyInput!) {
    appUsageRecordCreate(subscriptionLineItemId: $subscriptionLineItemId, description: $description, price: $price) {
      appUsageRecord { id }
      userErrors { field message }
    }
  }
`;

async function findActiveUsageLineItemId(admin) {
  const response = await admin.graphql(ACTIVE_USAGE_LINE_ITEM_QUERY);
  const data = await response.json();
  const subscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];

  for (const sub of subscriptions) {
    if (sub.status !== 'ACTIVE') continue;
    const usageLineItem = (sub.lineItems || []).find(
      (li) => li.plan?.pricingDetails?.__typename === 'AppUsagePricing',
    );
    if (usageLineItem) return usageLineItem.id;
  }
  return null;
}

// Called from the orders/create webhook for every order. `admin` is the
// authenticated GraphQL client for this shop -- authenticate.webhook()
// provides it via the shop's stored offline session, same as any other
// follow-up API call after a webhook fires.
export async function chargeForImportedProducts(admin, shop, order) {
  const shopifyOrderId = String(order.id);

  const productIds = (order.line_items || [])
    .filter((item) => item.product_id)
    .map((item) => `gid://shopify/Product/${item.product_id}`);

  if (productIds.length === 0) {
    return {status: 'no_imported_products'};
  }

  const importedLinks = await prisma.importedProduct.findMany({
    where: {shop, shopifyProductId: {in: productIds}},
    select: {shopifyProductId: true},
  });
  const importedProductIds = new Set(importedLinks.map((l) => l.shopifyProductId));

  const importedRevenue = (order.line_items || [])
    .filter(
      (item) =>
        item.product_id && importedProductIds.has(`gid://shopify/Product/${item.product_id}`),
    )
    .reduce((sum, item) => sum + parseFloat(item.price || '0') * (item.quantity || 1), 0);

  if (importedRevenue <= 0) {
    return {status: 'no_imported_products'};
  }

  const amountCharged = Math.round(importedRevenue * USAGE_FEE_RATE * 100) / 100;

  // Claim this order BEFORE calling Shopify's billing API, using create()
  // rather than upsert(). Unlike SupplierOrder (where a retry should
  // overwrite a failed attempt), this must never run twice for the same
  // order -- a duplicate webhook delivery must not double-charge real
  // money. If a row already exists, the unique constraint throws and we
  // stop here, full stop -- no retry, no overwrite.
  let charge;
  try {
    charge = await prisma.usageCharge.create({
      data: {shop, shopifyOrderId, importedRevenue, amountCharged, status: 'pending'},
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return {status: 'already_processed'};
    }
    throw error;
  }

  if (!admin) {
    await prisma.usageCharge.update({
      where: {id: charge.id},
      data: {status: 'failed', errorMessage: 'No admin API client available in webhook context.'},
    });
    return {status: 'failed'};
  }

  const subscriptionLineItemId = await findActiveUsageLineItemId(admin);
  if (!subscriptionLineItemId) {
    // Shouldn't normally happen -- app.jsx's loader requires an active
    // subscription before a merchant can use the app at all -- but a
    // cancelled subscription between then and now is possible.
    await prisma.usageCharge.update({
      where: {id: charge.id},
      data: {status: 'no_active_subscription'},
    });
    return {status: 'no_active_subscription'};
  }

  const response = await admin.graphql(APP_USAGE_RECORD_CREATE_MUTATION, {
    variables: {
      subscriptionLineItemId,
      description: `5% fee on imported-product sales -- order ${order.name || shopifyOrderId}`,
      // NOTE: always charged in USD, matching the plan's currencyCode in
      // shopify.server.js. Doesn't convert if the merchant's store
      // currency differs -- fine for now (dev store is USD), worth
      // revisiting before this matters for a non-USD merchant.
      price: {amount: amountCharged.toFixed(2), currencyCode: 'USD'},
    },
  });
  const data = await response.json();
  const result = data.data?.appUsageRecordCreate;

  if (result?.userErrors?.length) {
    await prisma.usageCharge.update({
      where: {id: charge.id},
      data: {status: 'failed', errorMessage: result.userErrors.map((e) => e.message).join(', ')},
    });
    return {status: 'failed'};
  }

  await prisma.usageCharge.update({
    where: {id: charge.id},
    data: {status: 'charged', shopifyUsageRecordId: result?.appUsageRecord?.id || null},
  });
  return {status: 'charged', amountCharged};
}
