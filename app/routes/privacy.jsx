// Public privacy policy page for the App Store listing's "Privacy policy URL"
// field. Deliberately a plain, unauthenticated route (like _index.jsx) --
// Shopify and anyone else needs to be able to load this without installing
// the app or being logged into a store. Content describes what this app
// actually does with data, based on the real code (SupplierCredential,
// ImportedProduct, SupplierLink, SupplierOrder, UsageCharge models and the
// orders/create webhook) -- not generic boilerplate. Added 2026-08-28.
//
// NOTE: this is a plain-language draft, not legal advice -- worth a lawyer's
// eyes before real merchants rely on it, especially once merchant volume
// grows past the dev-testing stage.
export default function Privacy() {
  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        maxWidth: '760px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        lineHeight: 1.6,
        color: '#1a1a1a',
      }}
    >
      <h1>Privacy Policy — Shop Boost Labs Dropshipping App</h1>
      <p>
        <em>Last updated: August 28, 2026</em>
      </p>

      <p>
        This app ("ShopBoost Dropshiping app", operated by Shop Boost Labs) helps merchants
        automatically fulfill orders through CJ Dropshipping and charges a usage fee on sales of
        imported products. This page explains what data the app collects, why, and what happens
        to it.
      </p>

      <h2>Information we collect</h2>
      <p>When you install this app on your Shopify store, we collect and store:</p>
      <ul>
        <li>
          Your store's domain and an access token issued by Shopify during installation, so the
          app can make API calls on your behalf.
        </li>
        <li>
          The CJ Dropshipping API key you enter in the app's Supplier settings, so the app can
          place orders with CJ Dropshipping using your own CJ account and balance.
        </li>
        <li>
          Product and variant information for items you import (via CSV) or link to a CJ
          Dropshipping product, so the app knows which orders need automatic fulfillment.
        </li>
        <li>
          Order information from your store's <code>orders/create</code> webhook, limited to what
          is needed to place a matching supplier order and calculate the app's usage fee: line
          items, quantities, prices, and the shipping address (name, street address, city,
          province, country, postal code, and phone number).
        </li>
        <li>
          Records of supplier orders placed and usage fees charged, so you and we can see
          fulfillment and billing history.
        </li>
      </ul>
      <p>We do not collect payment card numbers, passwords, or government ID numbers.</p>

      <h2>How we use this information</h2>
      <ul>
        <li>To automatically place a matching order with CJ Dropshipping when a customer buys an imported product.</li>
        <li>To calculate and charge the app's usage-based fee (5% of the value of orders containing an imported product) through Shopify's Billing API.</li>
        <li>To show you fulfillment and billing status inside the app.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Shipping and order details needed to fulfill an order are sent to CJ Dropshipping, using
        your own CJ Dropshipping account. Usage fee charges are processed by Shopify through its
        Billing API. We do not sell or share your data with anyone else.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We keep this data for as long as the app is installed on your store, so it can keep
        working correctly and so you can see fulfillment/billing history. When you uninstall the
        app, your session is removed immediately. If you would like your other stored data (CJ
        credentials, supplier links, order and billing records) deleted sooner, contact us using
        the information below and we will remove it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of the data we hold about your store, or request that it be
        deleted, at any time by contacting us below.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about this policy or your data can be sent to{' '}
        <a href="mailto:shopboostlabs8@gmail.com">shopboostlabs8@gmail.com</a>.
      </p>
    </div>
  );
}
