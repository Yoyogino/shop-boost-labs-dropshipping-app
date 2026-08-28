// The missing piece: lets a merchant search CJ Dropshipping's live catalog
// and link one of THEIR Shopify products/variants to a specific CJ
// product/variant. Creating that link is what the orders/create webhook
// (webhooks.orders.create.jsx) checks against -- no link, no auto-order.
//
// Three actions on one route, distinguished by `intent` (matches the
// pattern of this app's other forms):
//   - "search": query CJ's catalog by keyword
//   - "detail": load one CJ product's variants (need the vid, not just pid)
//   - "link": save the SupplierLink row
//
// NOT YET LIVE-TESTED — "search" and "detail" call the real CJ API and
// will fail with a clear error until a merchant has connected a CJ account
// on the Settings page (getAccessToken throws if none exists yet).
import {useState, useEffect} from 'react';
import {json} from '@remix-run/node';
import {useLoaderData, useFetcher} from '@remix-run/react';
import {
  Page,
  Layout,
  Card,
  Text,
  TextField,
  Button,
  Select,
  BlockStack,
  InlineStack,
  Banner,
  Badge,
  Divider,
  EmptyState,
} from '@shopify/polaris';
import {authenticate} from '../shopify.server';
import prisma from '../db.server';
import {searchProducts, getProductDetail} from '../suppliers/cj-dropshipping.server';

const PRODUCTS_QUERY = `#graphql
  query MerchantProducts {
    products(first: 50, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          variants(first: 25) {
            edges { node { id title sku } }
          }
        }
      }
    }
  }
`;

export const loader = async ({request}) => {
  const {admin, session} = await authenticate.admin(request);

  const credential = await prisma.supplierCredential.findUnique({
    where: {shop_provider: {shop: session.shop, provider: 'cj-dropshipping'}},
  });

  const productsResponse = await admin.graphql(PRODUCTS_QUERY);
  const productsData = await productsResponse.json();
  const products = productsData.data.products.edges.map(({node}) => ({
    id: node.id,
    title: node.title,
    variants: node.variants.edges.map(({node: v}) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
    })),
  }));

  const links = await prisma.supplierLink.findMany({where: {shop: session.shop}});

  return json({
    cjConnected: Boolean(credential),
    products,
    linkedVariantIds: links.map((l) => l.shopifyVariantId),
  });
};

export const action = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'search') {
    const keyword = formData.get('keyword');
    try {
      // searchProducts already returns a flat array of real products --
      // confirmed 2026-08-27 against a live response, see cj-dropshipping.server.js.
      const results = await searchProducts(session.shop, {keyword, pageSize: 10});
      return json({intent, results});
    } catch (error) {
      return json({intent, error: error.message}, {status: 400});
    }
  }

  if (intent === 'detail') {
    const pid = formData.get('pid');
    try {
      const data = await getProductDetail(session.shop, pid);
      return json({intent, product: data});
    } catch (error) {
      return json({intent, error: error.message}, {status: 400});
    }
  }

  if (intent === 'link') {
    const shopifyProductId = formData.get('shopifyProductId');
    const shopifyVariantId = formData.get('shopifyVariantId');
    const supplierProductId = formData.get('supplierProductId');
    const supplierVariantId = formData.get('supplierVariantId');
    const supplierSku = formData.get('supplierSku') || null;

    if (!shopifyVariantId || !supplierVariantId) {
      return json({intent, error: 'Pick both a Shopify variant and a CJ variant.'}, {status: 400});
    }

    await prisma.supplierLink.upsert({
      where: {shop_shopifyVariantId: {shop: session.shop, shopifyVariantId}},
      create: {
        shop: session.shop,
        shopifyProductId,
        shopifyVariantId,
        provider: 'cj-dropshipping',
        supplierProductId,
        supplierVariantId,
        supplierSku,
      },
      update: {
        provider: 'cj-dropshipping',
        supplierProductId,
        supplierVariantId,
        supplierSku,
      },
    });

    return json({intent, ok: true, shopifyVariantId});
  }

  return json({error: 'Unknown action.'}, {status: 400});
};

export default function LinkSupplier() {
  const {cjConnected, products, linkedVariantIds: initialLinkedIds} = useLoaderData();
  const searchFetcher = useFetcher();
  const detailFetcher = useFetcher();
  const linkFetcher = useFetcher();

  const [keyword, setKeyword] = useState('');
  const [selectedCjProduct, setSelectedCjProduct] = useState(null);
  const [linkedVariantIds, setLinkedVariantIds] = useState(initialLinkedIds);

  const searchResults = searchFetcher.data?.results || [];
  const searchError = searchFetcher.data?.error;
  const productDetail = detailFetcher.data?.product;
  const detailError = detailFetcher.data?.error;

  if (!cjConnected) {
    return (
      <Page title="Link products to a supplier" backAction={{url: '/app'}}>
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="Connect CJ Dropshipping first"
                action={{content: 'Go to Supplier settings', url: '/app/settings'}}
                image=""
              >
                <p>You need to link your CJ Dropshipping account before you can search its catalog.</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const allShopifyVariants = products.flatMap((p) =>
    p.variants.map((v) => ({...v, productId: p.id, productTitle: p.title})),
  );

  return (
    <Page title="Link products to a supplier" backAction={{url: '/app'}}>
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                1. Search CJ Dropshipping
              </Text>
              <searchFetcher.Form method="post">
                <input type="hidden" name="intent" value="search" />
                <TextField
                  label="Keyword"
                  labelHidden
                  name="keyword"
                  placeholder="e.g. phone case, yoga mat"
                  value={keyword}
                  onChange={setKeyword}
                  autoComplete="off"
                />
                <div style={{marginTop: 12}}>
                  <Button submit loading={searchFetcher.state !== 'idle'}>
                    Search
                  </Button>
                </div>
              </searchFetcher.Form>

              {searchError && <Banner tone="critical">{searchError}</Banner>}

              <BlockStack gap="200">
                {searchResults.map((product) => (
                  <Card key={product.id} background="bg-surface-secondary">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text as="span" fontWeight="semibold">
                          {product.nameEn}
                        </Text>
                        <Text as="span" tone="subdued">
                          ${product.sellPrice || '—'}
                        </Text>
                      </BlockStack>
                      <Button
                        onClick={() => {
                          setSelectedCjProduct(product);
                          detailFetcher.submit(
                            {intent: 'detail', pid: product.id},
                            {method: 'post'},
                          );
                        }}
                      >
                        View variants
                      </Button>
                    </InlineStack>
                  </Card>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                2. Link a variant
              </Text>

              {!selectedCjProduct && (
                <Text tone="subdued" as="p">
                  Search and pick a CJ product on the left first.
                </Text>
              )}

              {detailError && <Banner tone="critical">{detailError}</Banner>}

              {productDetail && (
                <LinkForm
                  cjProduct={productDetail}
                  shopifyVariants={allShopifyVariants}
                  linkedVariantIds={linkedVariantIds}
                  linkFetcher={linkFetcher}
                  onLinked={(variantId) =>
                    setLinkedVariantIds((ids) => [...ids, variantId])
                  }
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function LinkForm({cjProduct, shopifyVariants, linkedVariantIds, linkFetcher, onLinked}) {
  const cjVariants = cjProduct.variants || cjProduct.variantList || [];
  const [cjVariantId, setCjVariantId] = useState(cjVariants[0]?.vid || '');
  const [shopifyVariantId, setShopifyVariantId] = useState('');

  const justLinked = linkFetcher.data?.ok && linkFetcher.data?.shopifyVariantId === shopifyVariantId;

  // Only mark it linked in the parent's list once the save actually
  // succeeds -- not optimistically on click, which could show "linked"
  // even if the request failed.
  useEffect(() => {
    if (linkFetcher.data?.ok) {
      onLinked(linkFetcher.data.shopifyVariantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkFetcher.data]);

  return (
    <BlockStack gap="300">
      <Text as="p" fontWeight="semibold">
        {/* Confirmed 2026-08-27: the detail endpoint uses productNameEn,
            NOT nameEn (that's only the search endpoint's field) -- keeping
            both here since we're calling this with whatever the detail
            fetcher returned. */}
        {cjProduct.productNameEn || cjProduct.nameEn}
      </Text>

      <Select
        label="CJ variant"
        options={cjVariants.map((v) => ({
          label: `${v.variantNameEn || v.variantKey || v.vid} — $${v.variantSellPrice || v.price || '—'}`,
          value: v.vid,
        }))}
        value={cjVariantId}
        onChange={setCjVariantId}
      />

      <Divider />

      <Select
        label="Your Shopify product/variant"
        placeholder="Choose one"
        options={shopifyVariants.map((v) => ({
          label: `${v.productTitle} — ${v.title}${v.sku ? ` (${v.sku})` : ''}${
            linkedVariantIds.includes(v.id) ? ' [already linked]' : ''
          }`,
          value: v.id,
        }))}
        value={shopifyVariantId}
        onChange={setShopifyVariantId}
      />

      {justLinked && <Banner tone="success">Linked. Orders for this variant will now auto-fulfill through CJ.</Banner>}
      {linkFetcher.data?.error && <Banner tone="critical">{linkFetcher.data.error}</Banner>}

      <Button
        variant="primary"
        disabled={!shopifyVariantId || !cjVariantId}
        loading={linkFetcher.state !== 'idle'}
        onClick={() => {
          const shopifyVariant = shopifyVariants.find((v) => v.id === shopifyVariantId);
          const cjVariant = cjVariants.find((v) => v.vid === cjVariantId);
          linkFetcher.submit(
            {
              intent: 'link',
              shopifyProductId: shopifyVariant?.productId || '',
              shopifyVariantId,
              // Confirmed 2026-08-27: detail endpoint returns "pid".
              supplierProductId: cjProduct.pid || cjProduct.id,
              supplierVariantId: cjVariantId,
              supplierSku: cjVariant?.variantSku || '',
            },
            {method: 'post'},
          );
        }}
      >
        Link this variant
      </Button>
    </BlockStack>
  );
}
