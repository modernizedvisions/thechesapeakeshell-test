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
      const sessionSummary = event.data.object as Stripe.Checkout.Session;
      const session = await createStripeClient(env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(
        sessionSummary.id,
        {
          expand: ['line_items.data.price.product'],
        }
      );

      const productId = session.metadata?.product_id;
      const quantityFromMeta = session.metadata?.quantity ? Number(session.metadata.quantity) : 1;

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

        // Insert order + order_items (best effort; do not throw).
        try {
          const orderId = crypto.randomUUID();
          const orderResult = await env.DB.prepare(
            `
            INSERT INTO orders (
              id, stripe_payment_intent_id, total_cents, customer_email, shipping_name, shipping_address_json
            ) VALUES (?, ?, ?, ?, ?, ?);
          `
          )
            .bind(
              orderId,
              session.payment_intent?.toString() || null,
              session.amount_total ?? 0,
              session.customer_details?.email || null,
              session.shipping_details?.name || null,
              JSON.stringify(session.shipping_details?.address ?? null)
            )
            .run();

          if (!orderResult.success) {
            console.error('Failed to insert order into D1', orderResult.error);
          } else {
            const lineItems = session.line_items?.data || [];
            if (lineItems.length) {
              for (const line of lineItems) {
                const itemId = crypto.randomUUID();
                const qty = line.quantity ?? 1;
                const priceCents = line.price?.unit_amount ?? 0;
                // Prefer the product id from the price.product if present; fall back to metadata.product_id.
                const productIdFromPrice =
                  typeof line.price?.product === 'string'
                    ? line.price.product
                    : (line.price?.product as Stripe.Product | undefined)?.id;
                const resolvedProductId = productIdFromPrice || productId;

                const itemResult = await env.DB.prepare(
                  `
                  INSERT INTO order_items (id, order_id, product_id, quantity, price_cents)
                  VALUES (?, ?, ?, ?, ?);
                `
                )
                  .bind(itemId, orderId, resolvedProductId, qty, priceCents)
                  .run();

                if (!itemResult.success) {
                  console.error('Failed to insert order_items into D1', itemResult.error);
                }
              }
              console.log('Inserted order and items', { orderId, items: lineItems.length });
            } else {
              // Fallback: insert a single item using metadata product/quantity if no line_items were returned.
              const itemId = crypto.randomUUID();
              const itemResult = await env.DB.prepare(
                `
                INSERT INTO order_items (id, order_id, product_id, quantity, price_cents)
                VALUES (?, ?, ?, ?, ?);
              `
              )
                .bind(
                  itemId,
                  orderId,
                  productId,
                  quantityFromMeta || 1,
                  session.amount_subtotal && quantityFromMeta > 0
                    ? Math.floor(session.amount_subtotal / (quantityFromMeta || 1))
                    : 0
                )
                .run();

              if (!itemResult.success) {
                console.error('Failed to insert order_items into D1 (fallback)', itemResult.error);
              } else {
                console.log('Inserted order and fallback item', { orderId, productId });
              }
            }
          }
        } catch (orderErr) {
          console.error('Failed to persist order/order_items in D1', orderErr);
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
