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
      expand: ['line_items'],
    });

    return json({
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
    });
  } catch (error) {
    console.error('Failed to retrieve checkout session', error);
    return json({ error: 'Failed to fetch checkout session' }, 500);
  }
};
