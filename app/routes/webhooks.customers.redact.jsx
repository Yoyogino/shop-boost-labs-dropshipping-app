// Mandatory GDPR compliance webhook (2026-08-28): sent ~10 days after a
// customer asks a merchant to delete their data. Same situation as
// customers/data_request -- this app doesn't store anything keyed to an
// individual customer (no Customer model in schema.prisma; shipping details
// are passed through to CJ Dropshipping at order time, not persisted here),
// so there's nothing app-side to redact. Acknowledge and move on.
import {authenticate} from '../shopify.server';

export const action = async ({request}) => {
  const {shop, topic, payload} = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`, {
    customerId: payload?.customer?.id,
  });

  // No customer-identifiable data is stored by this app -- nothing to redact.
  return new Response();
};
