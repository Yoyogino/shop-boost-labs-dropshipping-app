// Mandatory GDPR compliance webhook (2026-08-28): sent ~48 hours after a
// shop uninstalls the app, requiring full deletion of that shop's data.
// Unlike the two customers/* webhooks, this app DOES hold shop-scoped data
// worth deleting -- every model in schema.prisma keys off `shop`. Sessions
// are already cleared on app/uninstalled (see webhooks.app.uninstalled.jsx),
// but that only removes the session/access token, not the app's own
// business records, so this clears everything else: imported products, the
// merchant's own CJ Dropshipping credential, supplier links, usage-billing
// records, and supplier order records.
import {authenticate} from '../shopify.server';
import prisma from '../db.server';

export const action = async ({request}) => {
  const {shop, topic} = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop} -- deleting all shop data`);

  await Promise.all([
    prisma.session.deleteMany({where: {shop}}),
    prisma.importedProduct.deleteMany({where: {shop}}),
    prisma.supplierCredential.deleteMany({where: {shop}}),
    prisma.supplierLink.deleteMany({where: {shop}}),
    prisma.usageCharge.deleteMany({where: {shop}}),
    prisma.supplierOrder.deleteMany({where: {shop}}),
  ]);

  return new Response();
};
