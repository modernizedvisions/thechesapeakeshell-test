import Stripe from 'stripe';

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; error?: string }>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

const createStripeClient = (secretKey: string) =>
  new Stripe(secretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

const cryptoProvider = Stripe.createSubtleCryptoProvider();

export const onRequestPost = async (context: {
  request: Request;
  env: { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string; DB: D1Database };
}) => {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe secrets are not configured');
    return new Response('Stripe is not configured', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider
    );
  } catch (error) {
    console.error('Stripe webhook signature verification failed', error);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const productId = session.metadata?.product_id;

      if (productId) {
        const result = await env.DB.prepare(
          `
          UPDATE products
          SET
            quantity_available = CASE
              WHEN quantity_available IS NULL THEN 0
              WHEN quantity_available > 0 THEN quantity_available - 1
              ELSE 0
            END,
            is_sold = CASE
              WHEN quantity_available IS NULL THEN 1
              WHEN quantity_available <= 1 THEN 1
              ELSE is_sold
            END
          WHERE id = ?;
        `
        )
          .bind(productId)
          .run();

        if (!result.success) {
          console.error('Failed to update product as sold', result.error);
        }
      } else {
        console.warn('Checkout session missing product_id metadata');
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Error handling Stripe webhook', error);
    return new Response('Webhook handling failed', { status: 500 });
  }
};
