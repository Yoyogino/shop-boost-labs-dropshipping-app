import {json} from '@remix-run/node';
import {useLoaderData} from '@remix-run/react';
import {Page, Layout, Card, Text, BlockStack, Button} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import prisma from '../db.server';

export const loader = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const importedCount = await prisma.importedProduct.count({
    where: {shop: session.shop},
  });

  return json({shop: session.shop, importedCount});
};

export default function Index() {
  const {shop, importedCount} = useLoaderData();

  return (
    <Page title="Shop Boost Labs Dropshipping App">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Welcome, {shop}
              </Text>
              <Text as="p">
                You've imported <b>{importedCount}</b> product
                {importedCount === 1 ? '' : 's'} through this app so far.
              </Text>
              <Button url="/app/import" variant="primary">
                Import products
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
