import Stripe from 'stripe';

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type ProductRow = {
  id: string;
  name: string | null;
  slug?: string | null;
  description: string | null;
  price_cents: number | null;
  category: string | null;
  image_url: string | null;
  image_urls_json?: string | null;
  is_active: number | null;
  is_one_off?: number | null;
  is_sold?: number | null;
  quantity_available?: number | null;
  stripe_price_id?: string | null;
  stripe_product_id?: string | null;
  collection?: string | null;
  created_at: string | null;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createStripeClient = (secretKey: string) =>
  new Stripe(secretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

const normalizeOrigin = (request: Request) => {
  const url = new URL(request.url);
  const originHeader = request.headers.get('origin');
  const origin = originHeader && originHeader.startsWith('http') ? originHeader : `${url.protocol}//${url.host}`;
  return origin.replace(/\/$/, '');
};

export const onRequestPost = async (context: {
  request: Request;
  env: { DB: D1Database; STRIPE_SECRET_KEY?: string; VITE_PUBLIC_SITE_URL?: string };
}) => {
  const { request, env } = context;
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY is not configured');
    return json({ error: 'Stripe is not configured' }, 500);
  }
  console.log('Stripe secret present?', !!stripeSecretKey);

  try {
    const body = (await request.json()) as { productId?: string; quantity?: number };
    const productId = body.productId?.trim();
    const requestedQuantity = Math.max(1, Number(body.quantity || 1));

    if (!productId) {
      return json({ error: 'productId is required' }, 400);
    }

    const product = await env.DB.prepare(
      `
      SELECT id, name, slug, description, price_cents, category, image_url, image_urls_json, is_active,
             is_one_off, is_sold, quantity_available, stripe_price_id, stripe_product_id, collection, created_at
      FROM products
      WHERE id = ? OR stripe_product_id = ?
      LIMIT 1;
    `
    )
      .bind(productId, productId)
      .first<ProductRow>();

    console.log('create-session productId', productId);
    console.log('create-session product row', product);

    if (!product) {
      return json({ error: 'Product not found' }, 404);
    }

    if (product.is_active === 0) {
      return json({ error: 'Product is inactive' }, 400);
    }

    if (product.is_sold === 1) {
      return json({ error: 'Product is already sold' }, 400);
    }

    if (product.price_cents === null || product.price_cents === undefined) {
      return json({ error: 'Product is missing a price' }, 400);
    }

    if (!product.stripe_price_id) {
      return json({ error: 'This product has no Stripe price configured.' }, 400);
    }

    if (product.quantity_available !== null && product.quantity_available !== undefined && product.quantity_available <= 0) {
      return json({ error: 'Product is sold out' }, 400);
    }

    const quantity =
      product.is_one_off === 1
        ? 1
        : Math.min(requestedQuantity, product.quantity_available ?? requestedQuantity);

    if (product.quantity_available !== null && product.quantity_available !== undefined && quantity > product.quantity_available) {
      return json({ error: 'Requested quantity exceeds available inventory' }, 400);
    }

    const stripe = createStripeClient(stripeSecretKey);
    const baseUrl = env.VITE_PUBLIC_SITE_URL || normalizeOrigin(request);
    if (!baseUrl) {
      console.error('Missing VITE_PUBLIC_SITE_URL in env');
      return json({ error: 'Server configuration error: missing site URL' }, 500);
    }

    const priceId = product.stripe_price_id;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        ui_mode: 'embedded',
        line_items: [
          {
            price: priceId,
            quantity,
          },
        ],
        return_url: `${baseUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        metadata: {
          product_id: product.id,
          product_slug: product.slug || '',
        },
        consent_collection: {
          promotions: 'auto',
        },
        shipping_address_collection: {
          allowed_countries: ['US', 'CA'],
        },
      });

      if (!session.client_secret) {
        console.error('Stripe did not return a client_secret', session.id);
        return json({ error: 'Unable to create checkout session' }, 500);
      }

      return json({ clientSecret: session.client_secret, sessionId: session.id });
    } catch (stripeError: any) {
      console.error('Stripe checkout session error:', stripeError?.message || stripeError, stripeError?.raw);
      const message =
        stripeError?.raw?.message ||
        stripeError?.message ||
        'Failed to create checkout session';
      return json({ error: message }, 500);
    }
  } catch (error) {
    console.error('Error creating embedded checkout session', error);
    return json({ error: 'Failed to create checkout session' }, 500);
  }
};
