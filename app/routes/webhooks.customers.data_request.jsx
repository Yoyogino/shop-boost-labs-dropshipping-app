// Mandatory GDPR compliance webhook (2026-08-28): Shopify sends this when a
// customer asks a merchant what data the merchant's apps hold on them. This
// app never stores customer-identifiable data of its own -- orders are only
// referenced by shopifyOrderId (see SupplierOrder/UsageCharge in
// schema.prisma), and the shipping address used to place a CJ Dropshipping
// order is passed straight through at request time, never persisted here.
// So there's nothing to compile or return; this just has to acknowledge
// receipt within Shopify's required window. authenticate.webhook() verifies
// the HMAC signature and throws on an invalid one, same as the other
// webhook routes.
import {authenticate} from '../shopify.server';

export const action = async ({request}) => {
  const {shop, topic, payload} = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`, {
    customerId: payload?.customer?.id,
    ordersRequested: payload?.orders_requested,
  });

  // No customer-identifiable data is stored by this app -- nothing further
  // to do here beyond acknowledging the request.
  return new Response();
};
