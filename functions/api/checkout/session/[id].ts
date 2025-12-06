import Stripe from 'stripe';

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

export const onRequestGet = async (context: {
  params: Record<string, string>;
  env: { STRIPE_SECRET_KEY?: string };
}) => {
  const { params, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not configured');
    return json({ error: 'Stripe is not configured' }, 500);
  }

  const sessionId = params?.id;
  if (!sessionId) {
    return json({ error: 'session id is required' }, 400);
  }

  try {
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: [
        'line_items.data.price.product',
        'payment_intent.payment_method',
      ],
    });

    const lineItems =
      session.line_items?.data.map((li) => ({
        productName:
          (typeof li.price?.product === 'object' && li.price?.product
            ? (li.price.product as Stripe.Product).name
            : undefined) ||
          (typeof li.price?.product === 'string' ? li.price.product : 'Item'),
        quantity: li.quantity ?? 0,
        lineTotal: li.amount_total ?? 0,
      })) ?? [];

    const cardLast4 =
      session.payment_intent && typeof session.payment_intent !== 'string'
        ? (session.payment_intent.payment_method as any)?.card?.last4 ?? null
        : null;

    return json({
      id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email ?? null,
      shipping: {
        name: session.shipping?.name ?? null,
        address: session.shipping?.address ?? null,
      },
      line_items: lineItems,
      card_last4: cardLast4,
    });
  } catch (error) {
    console.error('Failed to retrieve checkout session', error);
    return json({ error: 'Failed to fetch checkout session' }, 500);
  }
};
