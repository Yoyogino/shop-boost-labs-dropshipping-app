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

const CREATE_PRODUCT_MUTATION = `#graphql
  mutation CreateProduct($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

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

    const response = await admin.graphql(CREATE_PRODUCT_MUTATION, {
      variables: {
        input: {
          title: row.title,
          descriptionHtml: row.description || '',
          images: row.imageurl ? [{src: row.imageurl}] : undefined,
          variants: row.price ? [{price: row.price}] : undefined,
          status: 'DRAFT',
        },
      },
    });

    const data = await response.json();
    const result = data.data?.productCreate;

    if (result?.userErrors?.length) {
      errors.push(`${row.title}: ${result.userErrors.map((e) => e.message).join(', ')}`);
      continue;
    }

    if (result?.product) {
      await prisma.importedProduct.create({
        data: {
          shop: session.shop,
          shopifyProductId: result.product.id,
          sourceType: 'csv',
        },
      });
      imported.push(result.product.title);
    }
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
