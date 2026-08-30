import {useState} from 'react';
import {json} from '@remix-run/node';
import {useActionData, useNavigation, Form} from '@remix-run/react';
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  TextField,
  Banner,
  List,
} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import prisma from '../db.server';
import {createShopifyProduct} from '../shopify-products.server';

// Expected CSV columns: title,price,description,imageUrl
// This is the safe, legitimate starting point for "import" — no scraping,
// no third-party ToS risk. Real supplier API integrations (CJ Dropshipping,
// Printful, etc.) plug into this same action later.
function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  const [header, ...rows] = lines;
  const columns = header.split(',').map((c) => c.trim().toLowerCase());

  return rows.map((row) => {
    const cells = row.split(',').map((c) => c.trim());
    const record = {};
    columns.forEach((col, i) => {
      record[col] = cells[i] ?? '';
    });
    return record;
  });
}

export const action = async ({request}) => {
  const {admin, session} = await authenticate.admin(request);
  const formData = await request.formData();
  const csvText = formData.get('csvText');

  if (!csvText || typeof csvText !== 'string') {
    return json({error: 'Paste some CSV data first.'}, {status: 400});
  }

  const rows = parseCsv(csvText);
  const imported = [];
  const errors = [];

  for (const row of rows) {
    if (!row.title) continue;

    const {product, errors: rowErrors} = await createShopifyProduct(admin, {
      title: row.title,
      description: row.description,
      price: row.price,
      imageUrl: row.imageurl,
    });

    if (!product) {
      errors.push(`${row.title}: ${rowErrors.join(', ') || 'product was not created.'}`);
      continue;
    }

    rowErrors.forEach((message) => errors.push(`${row.title}: ${message}`));

    await prisma.importedProduct.create({
      data: {
        shop: session.shop,
        shopifyProductId: product.id,
        sourceType: 'csv',
      },
    });
    imported.push(product.title);
  }

  return json({imported, errors});
};

export default function ImportPage() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const [csvText, setCsvText] = useState(
    'title,price,description,imageUrl\nExample Product,19.99,A great product,https://example.com/image.jpg',
  );
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Page title="Import products" backAction={{url: '/app'}}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="p">
                Paste product data as CSV (columns: <code>title, price, description, imageUrl</code>).
                Products are created as drafts in your store so you can review before publishing.
              </Text>

              <Form method="post">
                <TextField
                  label="CSV data"
                  name="csvText"
                  value={csvText}
                  onChange={setCsvText}
                  multiline={8}
                  autoComplete="off"
                />
                <div style={{marginTop: 16}}>
                  <Button submit variant="primary" loading={isSubmitting}>
                    Import products
                  </Button>
                </div>
              </Form>

              {actionData?.imported?.length > 0 && (
                <Banner tone="success" title={`Imported ${actionData.imported.length} product(s)`}>
                  <List>
                    {actionData.imported.map((title) => (
                      <List.Item key={title}>{title}</List.Item>
                    ))}
                  </List>
                </Banner>
              )}

              {actionData?.errors?.length > 0 && (
                <Banner tone="critical" title="Some rows failed">
                  <List>
                    {actionData.errors.map((err) => (
                      <List.Item key={err}>{err}</List.Item>
                    ))}
                  </List>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
