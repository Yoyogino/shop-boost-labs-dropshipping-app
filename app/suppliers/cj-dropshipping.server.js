// CJ Dropshipping API client (API v2.0).
//
// Endpoints and auth flow verified against CJ's own docs on 2026-08-27:
// https://developers.cjdropshipping.cn/en/api/api2/api/auth.html
// https://developers.cjdropshipping.cn/en/api/api2/api/product.html
// https://developers.cjdropshipping.cn/en/api/api2/api/shopping.html
//
// Design: each merchant links their OWN CJ Dropshipping account (their own
// apiKey, stored in SupplierCredential). CJ orders are placed using that
// merchant's own access token, in "balance payment" mode, so orders draw
// from THEIR CJ balance. Shop Boost Labs never sees or fronts payment for
// supplier orders -- same model as DSers linking a merchant's own
// AliExpress account.
//
// NOT YET LIVE-TESTED: written against CJ's documented request/response
// shapes, but this session has no real CJ API key to test an actual call
// against. Test with a real merchant's key before relying on this for
// production order placement.

import prisma from '../db.server';

const BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

async function cjFetch(path, {method = 'GET', accessToken, body, query} = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? {'CJ-Access-Token': accessToken} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.result === false) {
    // Log the raw error body -- CJ's error responses have surprised us on
    // every other endpoint so far, and error.message alone (below) can
    // easily hide the actually-useful detail.
    console.log(`CJ API error response from ${path}:`, JSON.stringify(data, null, 2));
    const message = data?.message || `CJ API error (${response.status}) calling ${path}`;
    const err = new Error(message);
    // "Balance is insufficient" (and possibly other error codes) still
    // include a real orderId/shipmentOrderId in data.data -- CJ actually
    // reserved the order, it's just unpaid. Carry that through so callers
    // can record it instead of losing it.
    err.cjData = data?.data ?? null;
    throw err;
  }

  return data;
}

// Returns a valid access token for this shop's CJ account, fetching or
// refreshing one as needed. Tokens are cached in SupplierCredential so we
// don't re-authenticate on every call (CJ tokens are valid 15 days).
export async function getAccessToken(shop) {
  const credential = await prisma.supplierCredential.findUnique({
    where: {shop_provider: {shop, provider: 'cj-dropshipping'}},
  });

  if (!credential) {
    throw new Error(
      `No CJ Dropshipping account linked for ${shop} yet -- add an API key in Settings first.`,
    );
  }

  const now = new Date();

  // Still valid -- reuse it.
  if (credential.accessToken && credential.accessTokenExpiresAt > now) {
    return credential.accessToken;
  }

  // Expired access token, but refresh token still good.
  if (credential.refreshToken && credential.refreshTokenExpiresAt > now) {
    const data = await cjFetch('/authentication/refreshAccessToken', {
      method: 'POST',
      body: {refreshToken: credential.refreshToken},
    });
    return persistTokens(shop, data.data);
  }

  // No valid token at all -- authenticate from scratch with the stored API key.
  const data = await cjFetch('/authentication/getAccessToken', {
    method: 'POST',
    body: {apiKey: credential.apiKey},
  });
  return persistTokens(shop, data.data);
}

async function persistTokens(shop, tokenData) {
  await prisma.supplierCredential.update({
    where: {shop_provider: {shop, provider: 'cj-dropshipping'}},
    data: {
      accessToken: tokenData.accessToken,
      accessTokenExpiresAt: new Date(tokenData.accessTokenExpiryDate),
      refreshToken: tokenData.refreshToken,
      refreshTokenExpiresAt: new Date(tokenData.refreshTokenExpiryDate),
    },
  });
  return tokenData.accessToken;
}

// Live product search -- this is what Layer 1 (real catalog data) would
// call instead of a static idea list.
//
// FIXED 2026-08-30: this was silently searching nothing. listV2's real query
// params are `keyWord` (capital W), `page`, and `size` -- confirmed against
// CJ's own docs (https://developers.cjdropshipping.cn/en/api/api2/api/product.html).
// The old code sent `keyword`/`pageNum`/`pageSize`, none of which CJ
// recognizes, so CJ silently ignored all of them and returned its default
// (unfiltered/trending) product listing every time -- which is exactly why
// searching "phone case" was returning completely unrelated products.
export async function searchProducts(shop, {keyword, pageNum = 1, pageSize = 20} = {}) {
  const accessToken = await getAccessToken(shop);
  const data = await cjFetch('/product/listV2', {
    accessToken,
    query: {keyWord: keyword, page: pageNum, size: pageSize},
  });
  // Confirmed against a real response (2026-08-27): CJ nests the actual
  // products two levels deep -- data.content is an array with ONE element
  // (a search-result group) whose .productList is the real array of
  // products. Flatten it here so every caller just gets a plain array.
  return data.data?.content?.[0]?.productList || [];
}

export async function getProductDetail(shop, pid) {
  const accessToken = await getAccessToken(shop);
  const data = await cjFetch('/product/query', {accessToken, query: {pid}});
  return data.data;
}

export async function getVariantStock(shop, vid) {
  const accessToken = await getAccessToken(shop);
  const data = await cjFetch('/product/stock/queryByVid', {accessToken, query: {vid}});
  return data.data;
}

// Places a real order with CJ Dropshipping, paid from the merchant's own
// CJ balance (balance payment mode -- no redirect-to-pay flow, no Shop
// Boost Labs payment involved). Called from the orders/create webhook.
//
// `lineItems` is an array of {supplierVariantId, quantity}. `shippingAddress`
// matches the Shopify order's shipping_address shape closely enough that
// callers can pass it through with minimal reshaping -- see webhook route.
export async function createOrder(shop, {shopifyOrderNumber, lineItems, shippingAddress, logisticName}) {
  const accessToken = await getAccessToken(shop);

  const body = {
    orderNumber: shopifyOrderNumber,
    // Confirmed 2026-08-27 against a real rejected order: CJ requires BOTH
    // of these as separate fields, not just the code.
    shippingCountry: shippingAddress.country,
    shippingCountryCode: shippingAddress.countryCode,
    shippingProvince: shippingAddress.province,
    shippingCity: shippingAddress.city,
    shippingAddress: shippingAddress.address1,
    shippingZip: shippingAddress.zip,
    shippingCustomerName: shippingAddress.name,
    shippingPhone: shippingAddress.phone,
    logisticName: logisticName || 'CJPacket Ordinary',
    fromCountryCode: 'CN',
    payType: 2, // balance payment -- draws from the merchant's own CJ balance
    products: lineItems.map((item) => ({
      vid: item.supplierVariantId,
      quantity: item.quantity,
    })),
  };

  // TEMP DEBUG (remove once we've confirmed this against a real order --
  // same as we did for search/detail) -- this is the one CJ call still
  // untested against a live response.
  console.log('CJ createOrder request body:', JSON.stringify(body, null, 2));

  const data = await cjFetch('/shopping/order/createOrderV2', {
    method: 'POST',
    accessToken,
    body,
  });

  console.log('CJ createOrder raw response:', JSON.stringify(data, null, 2));

  return data.data; // includes CJ orderId, shipment info, pricing breakdown
}
