// The core of the whole app: when a customer buys, place the matching
// supplier order automatically -- no DSers, no third-party app, no manual
// step for the merchant.
//
// Flow: Shopify fires this webhook on every new order -> for each line
// item, check SupplierLink for a matching Shopify variant -> if any are
// linked to CJ Dropshipping, place one CJ order covering all of them ->
// record the result in SupplierOrder so we never double-place and the
// merchant can see fulfillment status.
//
// NOT YET LIVE-TESTED end to end -- needs: the orders/create webhook
// registered in shopify.app.toml (added), the read_orders scope (added),
// and a real merchant with a CJ account + at least one SupplierLink row
// to actually exercise this against.
import {authenticate} from '../shopify.server';
import prisma from '../db.server';
import {createOrder} from '../suppliers/cj-dropshipping.server';

export const action = async ({request}) => {
  const {shop, topic, payload} = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const order = payload;
  const shopifyOrderId = String(order.id);

  // Already handled (webhook retried, or fired twice) -- don't double-place.
  const existing = await prisma.supplierOrder.findUnique({
    where: {
      shop_shopifyOrderId_provider: {
        shop,
        shopifyOrderId,
        provider: 'cj-dropshipping',
      },
    },
  });
  if (existing) {
    return new Response();
  }

  const variantIds = (order.line_items || []).map(
    (item) => `gid://shopify/ProductVariant/${item.variant_id}`,
  );

  const links = await prisma.supplierLink.findMany({
    where: {shop, shopifyVariantId: {in: variantIds}, provider: 'cj-dropshipping'},
  });

  // Nothing in this order came from CJ Dropshipping -- not every order
  // needs supplier fulfillment (e.g. the merchant's own non-dropshipped
  // products), so this is a normal outcome, not an error.
  if (links.length === 0) {
    return new Response();
  }

  const lineItemsByVariant = new Map(
    (order.line_items || []).map((item) => [
      `gid://shopify/ProductVariant/${item.variant_id}`,
      item,
    ]),
  );

  const supplierLineItems = links.map((link) => ({
    supplierVariantId: link.supplierVariantId,
    quantity: lineItemsByVariant.get(link.shopifyVariantId)?.quantity || 1,
  }));

  const shippingAddress = order.shipping_address
    ? {
        name: order.shipping_address.name,
        address1: order.shipping_address.address1,
        city: order.shipping_address.city,
        province: order.shipping_address.province_code,
        // CJ's API requires BOTH the full country name and the two-letter
        // code as separate fields -- confirmed 2026-08-27 after a real
        // order was rejected with "shippingCountry must be not empty"
        // (we were only sending the code).
        country: order.shipping_address.country,
        countryCode: order.shipping_address.country_code,
        zip: order.shipping_address.zip,
        phone: order.shipping_address.phone || '',
      }
    : null;

  // Shopify can and does deliver this webhook more than once for the same
  // order (confirmed 2026-08-27 -- two deliveries arrived ~8s apart for one
  // order). The findUnique check above catches most of that, but a second
  // delivery can still slip past it before the first delivery's write
  // finishes, and a plain .create() then crashes on the unique constraint
  // instead of failing gracefully. upsert() makes this safe either way --
  // whichever delivery writes last just overwrites with the same result.
  const recordResult = (data) =>
    prisma.supplierOrder.upsert({
      where: {
        shop_shopifyOrderId_provider: {shop, shopifyOrderId, provider: 'cj-dropshipping'},
      },
      create: {shop, shopifyOrderId, provider: 'cj-dropshipping', ...data},
      update: data,
    });

  if (!shippingAddress) {
    await recordResult({
      status: 'failed',
      errorMessage: 'Order has no shipping address -- cannot place a supplier order.',
    });
    return new Response();
  }

  try {
    const result = await createOrder(shop, {
      shopifyOrderNumber: String(order.order_number ?? order.name ?? shopifyOrderId),
      lineItems: supplierLineItems,
      shippingAddress,
    });

    await recordResult({
      status: 'placed',
      supplierOrderId: result?.orderId ? String(result.orderId) : null,
    });
  } catch (error) {
    // Deliberately not re-throwing: a 200 tells Shopify not to retry-storm
    // this webhook. Failure is recorded so the merchant can see and retry
    // manually -- silent failure would be worse than a visible one.
    await recordResult({
      status: 'failed',
      errorMessage: error.message,
      // CJ can still return a real orderId even on failure (e.g.
      // "Balance is insufficient" still reserves the order, unpaid) --
      // keep it so it's not lost.
      supplierOrderId: error.cjData?.orderId ? String(error.cjData.orderId) : null,
    });
  }

  return new Response();
};
