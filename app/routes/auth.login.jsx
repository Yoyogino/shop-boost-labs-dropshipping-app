import {json} from '@remix-run/node';
import {useLoaderData} from '@remix-run/react';
import {login} from '../shopify.server';
import {loginErrorMessage} from './auth.login/error.server';

export const loader = async ({request}) => {
  const errors = loginErrorMessage(await login(request));
  return json({errors, polarisTranslations: {}});
};

export const action = async ({request}) => {
  const errors = loginErrorMessage(await login(request));
  return json({errors});
};

export default function Auth() {
  const {errors} = useLoaderData();

  return (
    <div style={{padding: 40, fontFamily: 'sans-serif'}}>
      <h1>Shop Boost Labs Dropshipping App</h1>
      <form method="post">
        <label>
          Shop domain
          <input type="text" name="shop" placeholder="my-shop-name.myshopify.com" />
        </label>
        {errors?.shop && <p style={{color: 'red'}}>{errors.shop}</p>}
        <button type="submit">Log in</button>
      </form>
    </div>
  );
}
