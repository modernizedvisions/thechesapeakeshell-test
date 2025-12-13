import Stripe from 'stripe';

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; error?: string; meta?: { changes?: number } }>;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
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
      const stripeClient = createStripeClient(env.STRIPE_SECRET_KEY);
      const session = await stripeClient.checkout.sessions.retrieve(sessionSummary.id, {
        expand: [
          'line_items.data.price.product',
          'payment_intent.payment_method',
          'payment_intent.charges.data.payment_method_details',
          'payment_intent.shipping',
        ],
      });

      const paymentIntent =
        session.payment_intent && typeof session.payment_intent !== 'string'
          ? session.payment_intent
          : null;
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null;

      const customerEmail = session.customer_details?.email || paymentIntent?.receipt_email || null;
      const shippingDetails = (session.shipping_details as Stripe.Checkout.Session.ShippingDetails | null) || paymentIntent?.shipping || null;
      const shippingName =
        shippingDetails?.name ||
        session.customer_details?.name ||
        null;
      const shippingAddress = shippingDetails?.address || null;

      const firstCharge = paymentIntent?.charges?.data?.[0];
      console.log(
        'PI first charge method details (safe)',
        JSON.stringify(
          firstCharge?.payment_method_details
            ? {
                type: firstCharge.payment_method_details.type,
                card:
                  firstCharge.payment_method_details.type === 'card'
                    ? {
                        brand: (firstCharge.payment_method_details as any).card?.brand ?? null,
                        last4: (firstCharge.payment_method_details as any).card?.last4 ?? null,
                      }
                    : undefined,
                us_bank_account:
                  firstCharge.payment_method_details.type === 'us_bank_account'
                    ? {
                        bank_name: (firstCharge.payment_method_details as any).us_bank_account?.bank_name ?? null,
                        last4: (firstCharge.payment_method_details as any).us_bank_account?.last4 ?? null,
                      }
                    : undefined,
              }
            : null,
          null,
          2
        )
      );

      let cardLast4: string | null = null;
      let cardBrand: string | null = null;

      if (paymentIntent?.charges?.data?.length) {
        const charge = paymentIntent.charges.data[0];
        const pmd = charge.payment_method_details as any;

        if (pmd?.card) {
          cardLast4 = pmd.card.last4 ?? null;
          cardBrand = pmd.card.brand ?? null;
        } else if (pmd?.link?.card) {
          // Link payment backed by a card
          cardLast4 = pmd.link.card.last4 ?? null;
          cardBrand = pmd.link.card.brand ?? null;
        } else if (pmd?.us_bank_account) {
          cardLast4 = pmd.us_bank_account.last4 ?? null;
          cardBrand = pmd.us_bank_account.bank_name ?? 'us_bank_account';
        }
      }

      if (!cardLast4 && paymentIntent?.payment_method && typeof paymentIntent.payment_method !== 'string') {
        const pm = paymentIntent.payment_method as Stripe.PaymentMethod;
        if (pm.card) {
          cardLast4 = pm.card.last4 ?? null;
          cardBrand = pm.card.brand ?? null;
        }
      }

      console.log('checkout.session.completed summary', {
        sessionId: session.id,
        email: customerEmail,
        shippingName,
        hasShippingAddress: !!shippingAddress,
        cardLast4,
        cardBrand,
      });

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
      } else {
        console.warn('Checkout session missing product_id metadata');
      }

      // Insert order + order_items (best effort; do not throw).
      try {
        await ensureOrdersSchema(env.DB);
        const orderId = crypto.randomUUID();
        const displayOrderId = await generateDisplayOrderId(env.DB);
        const insertWithCard = await env.DB.prepare(
          `
            INSERT INTO orders (
              id, display_order_id, stripe_payment_intent_id, total_cents, customer_email, shipping_name, shipping_address_json, card_last4, card_brand
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
          `
        )
          .bind(
            orderId,
            displayOrderId,
            paymentIntentId,
            session.amount_total ?? 0,
            customerEmail,
            shippingName,
            JSON.stringify(shippingAddress ?? null),
            cardLast4,
            cardBrand
          )
          .run();

        let orderInsertSucceeded = insertWithCard.success;

        if (!insertWithCard.success && insertWithCard.error?.includes('no such column')) {
          // Fallback for older schema without card fields.
          const fallbackResult = await env.DB.prepare(
            `
              INSERT INTO orders (
                id, display_order_id, stripe_payment_intent_id, total_cents, customer_email, shipping_name, shipping_address_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?);
            `
          )
            .bind(
              orderId,
              displayOrderId,
              paymentIntentId,
              session.amount_total ?? 0,
              customerEmail,
              shippingName,
              JSON.stringify(shippingAddress ?? null)
            )
            .run();
          orderInsertSucceeded = fallbackResult.success;
          if (!fallbackResult.success) {
            console.error('Failed to insert order into D1 (fallback)', fallbackResult.error);
          }
        } else if (!insertWithCard.success) {
          console.error('Failed to insert order into D1', insertWithCard.error);
        }

        if (orderInsertSucceeded) {
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
              const resolvedProductId = productIdFromPrice || productId || line.price?.id || 'unknown';

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
          } else if (productId) {
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
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Error handling Stripe webhook', error);
    return new Response('Webhook handling failed', { status: 500 });
  }
};

async function ensureOrdersSchema(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS order_counters (
    year INTEGER PRIMARY KEY,
    counter INTEGER NOT NULL
  );`).run();

  // Add display_order_id column if missing
  const columns = await db.prepare(`PRAGMA table_info(orders);`).all<{ name: string }>();
  const hasDisplay = (columns.results || []).some((c) => c.name === 'display_order_id');
  if (!hasDisplay) {
    await db.prepare(`ALTER TABLE orders ADD COLUMN display_order_id TEXT;`).run();
  }

  await db
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_display_order_id ON orders(display_order_id);`
    )
    .run();

  await backfillDisplayOrderIds(db);
}

async function generateDisplayOrderId(db: D1Database): Promise<string> {
  const year = new Date().getFullYear() % 100;
  await db.prepare('BEGIN IMMEDIATE TRANSACTION;').run();
  try {
    const existing = await db
      .prepare(`SELECT counter FROM order_counters WHERE year = ?`)
      .bind(year)
      .first<{ counter: number }>();
    let counter = 1;
    if (existing?.counter) {
      counter = existing.counter + 1;
      await db.prepare(`UPDATE order_counters SET counter = ? WHERE year = ?`).bind(counter, year).run();
    } else {
      await db.prepare(`INSERT INTO order_counters (year, counter) VALUES (?, ?)`).bind(year, counter).run();
    }
    await db.prepare('COMMIT;').run();
    const padded = String(counter).padStart(3, '0');
    return `${year}-${padded}`;
  } catch (error) {
    console.error('Failed to generate display order id', error);
    await db.prepare('ROLLBACK;').run();
    throw error;
  }
}

async function backfillDisplayOrderIds(db: D1Database) {
  const missing = await db
    .prepare(
      `SELECT id, created_at FROM orders WHERE display_order_id IS NULL OR display_order_id = '' ORDER BY datetime(created_at) ASC`
    )
    .all<{ id: string; created_at: string }>();

  const rows = missing.results || [];
  if (!rows.length) return;

  const countersByYear = new Map<number, number>();
  const existingCounters = await db.prepare(`SELECT year, counter FROM order_counters`).all<{ year: number; counter: number }>();
  (existingCounters.results || []).forEach((row) => countersByYear.set(row.year, row.counter));

  await db.prepare('BEGIN IMMEDIATE TRANSACTION;').run();
  try {
    for (const row of rows) {
      const yearFull = row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear();
      const year = yearFull % 100;
      const current = countersByYear.get(year) ?? 0;
      const next = current + 1;
      countersByYear.set(year, next);
      const padded = String(next).padStart(3, '0');
      const displayId = `${year}-${padded}`;

      await db.prepare(`UPDATE orders SET display_order_id = ? WHERE id = ?`).bind(displayId, row.id).run();
    }

    for (const [year, counter] of countersByYear.entries()) {
      const existing = await db
        .prepare(`SELECT counter FROM order_counters WHERE year = ?`)
        .bind(year)
        .first<{ counter: number }>();
      if (existing) {
        await db.prepare(`UPDATE order_counters SET counter = ? WHERE year = ?`).bind(counter, year).run();
      } else {
        await db.prepare(`INSERT INTO order_counters (year, counter) VALUES (?, ?)`).bind(year, counter).run();
      }
    }

    await db.prepare('COMMIT;').run();
  } catch (error) {
    console.error('Failed to backfill display order ids', error);
    await db.prepare('ROLLBACK;').run();
    throw error;
  }
}
