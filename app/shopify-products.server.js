// Shared helper for creating a Shopify product with a single default variant,
// a price, and an image. Used by both the CSV import flow (app.import.jsx)
// and the "import directly from a supplier search result" flow
// (app.link-supplier.jsx), so the two stay in sync instead of drifting.
//
// Three separate mutations, not one -- confirmed 2026-08-28 against a live
// 500 error. Shopify removed `images`/`variants` from `ProductInput`;
// `productCreate` now only takes title/description/status and always
// creates one default variant automatically, which is what price and media
// get attached to afterward.
const CREATE_PRODUCT_MUTATION = `#graphql
  mutation CreateProduct($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
        variants(first: 1) {
          edges { node { id } }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const SET_VARIANT_PRICE_MUTATION = `#graphql
  mutation SetVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }
`;

const CREATE_MEDIA_MUTATION = `#graphql
  mutation CreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media { alt mediaContentType status }
      mediaUserErrors { field message }
    }
  }
`;

// Creates one Shopify product (as a draft, so the merchant can review before
// publishing) with an optional price on its default variant and an optional
// image. Returns { product, defaultVariantId, errors } -- errors is always
// an array (empty on full success); a null `product` means the create step
// itself failed, everything else is a partial-success warning (e.g. price
// set but image failed to attach).
export async function createShopifyProduct(admin, {title, description = '', price, imageUrl}) {
  const errors = [];

  const createResponse = await admin.graphql(CREATE_PRODUCT_MUTATION, {
    variables: {
      input: {
        title,
        descriptionHtml: description || '',
        status: 'DRAFT',
      },
    },
  });
  const createData = await createResponse.json();
  const createResult = createData.data?.productCreate;

  if (createResult?.userErrors?.length) {
    return {product: null, defaultVariantId: null, errors: createResult.userErrors.map((e) => e.message)};
  }

  const product = createResult?.product;
  if (!product) {
    return {product: null, defaultVariantId: null, errors: ['Product was not created.']};
  }

  const defaultVariantId = product.variants?.edges?.[0]?.node?.id;

  if (price && defaultVariantId) {
    const priceResponse = await admin.graphql(SET_VARIANT_PRICE_MUTATION, {
      variables: {
        productId: product.id,
        variants: [{id: defaultVariantId, price: String(price)}],
      },
    });
    const priceData = await priceResponse.json();
    const priceErrors = priceData.data?.productVariantsBulkUpdate?.userErrors;
    if (priceErrors?.length) {
      errors.push(`Price not set -- ${priceErrors.map((e) => e.message).join(', ')}`);
    }
  }

  if (imageUrl) {
    const mediaResponse = await admin.graphql(CREATE_MEDIA_MUTATION, {
      variables: {
        productId: product.id,
        media: [{originalSource: imageUrl, mediaContentType: 'IMAGE'}],
      },
    });
    const mediaData = await mediaResponse.json();
    const mediaErrors = mediaData.data?.productCreateMedia?.mediaUserErrors;
    if (mediaErrors?.length) {
      errors.push(`Image not attached -- ${mediaErrors.map((e) => e.message).join(', ')}`);
    }
  }

  return {product, defaultVariantId, errors};
}
