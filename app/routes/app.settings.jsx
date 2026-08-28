// Lets a merchant link their OWN CJ Dropshipping account by pasting their
// API key (format: CJUserNum@api@xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx, from
// their CJ Dropshipping account settings). We don't validate against CJ's
// live API here yet -- that happens the first time an order actually needs
// to go out, via getAccessToken() in app/suppliers/cj-dropshipping.server.js.
// A "Test connection" action is a natural next addition once we can verify
// this against a real key.
import {useState} from 'react';
import {json} from '@remix-run/node';
import {useActionData, useLoaderData, useNavigation, Form} from '@remix-run/react';
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  TextField,
  Banner,
} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import prisma from '../db.server';

export const loader = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const credential = await prisma.supplierCredential.findUnique({
    where: {shop_provider: {shop: session.shop, provider: 'cj-dropshipping'}},
  });

  return json({
    connected: Boolean(credential),
    // Never send the real key back to the client -- just enough to show it's set.
    apiKeyPreview: credential ? `${credential.apiKey.slice(0, 10)}…` : null,
  });
};

export const action = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const formData = await request.formData();
  const apiKey = formData.get('apiKey');

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.includes('@api@')) {
    return json(
      {error: 'That doesn\'t look like a CJ Dropshipping API key (expected format: CJUserNum@api@...).'},
      {status: 400},
    );
  }

  await prisma.supplierCredential.upsert({
    where: {shop_provider: {shop: session.shop, provider: 'cj-dropshipping'}},
    create: {shop: session.shop, provider: 'cj-dropshipping', apiKey},
    // Clear cached tokens on key change so the next call re-authenticates.
    update: {
      apiKey,
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: null,
      refreshTokenExpiresAt: null,
    },
  });

  return json({ok: true});
};

export default function Settings() {
  const {connected, apiKeyPreview} = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // Polaris's TextField is a controlled component -- without value/onChange
  // wired up, it renders but silently rejects all typing. That was the bug:
  // this field was missing both, so the input looked normal but nothing
  // could ever be typed into it.
  const [apiKey, setApiKey] = useState('');

  return (
    <Page title="Supplier settings" backAction={{url: '/app'}}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                CJ Dropshipping
              </Text>
              <Text as="p">
                Link your own CJ Dropshipping account so orders placed through this app are
                fulfilled automatically and paid for from your own CJ balance. Shop Boost Labs
                never sees or holds your supplier payment.
              </Text>

              {connected && (
                <Banner tone="success" title="Connected">
                  API key on file: {apiKeyPreview}
                </Banner>
              )}

              {actionData?.ok && (
                <Banner tone="success" title="Saved" />
              )}
              {actionData?.error && (
                <Banner tone="critical" title={actionData.error} />
              )}

              <Form method="post">
                <TextField
                  label="CJ Dropshipping API key"
                  name="apiKey"
                  value={apiKey}
                  onChange={setApiKey}
                  placeholder="CJUserNum@api@..."
                  autoComplete="off"
                  helpText="Found in your CJ Dropshipping account under API settings."
                />
                <div style={{marginTop: 16}}>
                  <Button submit variant="primary" loading={isSubmitting}>
                    {connected ? 'Update key' : 'Connect'}
                  </Button>
                </div>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
