import Stripe from 'stripe';
import { sendEmail } from '../../_lib/email';

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; error?: string; meta?: { changes?: number } }>;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type Env = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  DB: D1Database;
  EMAIL_OWNER_TO?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  PUBLIC_SITE_URL?: string;
};

const createStripeClient = (secretKey: string) =>
  new Stripe(secretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

const cryptoProvider = Stripe.createSubtleCryptoProvider();

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
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

  console.log('[stripe webhook] received event', { type: event.type, id: event.id });

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionSummary = event.data.object as Stripe.Checkout.Session;
      console.log('[stripe webhook] checkout.session.completed', { sessionId: sessionSummary.id });
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

      const invoiceId = session.metadata?.invoiceId;

      if (invoiceId) {
        await handleCustomInvoicePayment({
          db: env.DB,
          env,
          session,
          paymentIntentId,
          amountTotal: session.amount_total ?? 0,
          currency: session.currency || 'usd',
          customerEmail,
        });
      } else if (productId) {
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

      console.log('[stripe webhook] inserting order', {
        sessionId: session.id,
        paymentIntentId,
        hasLineItems: !!session.line_items?.data?.length,
      });
      await assertOrdersTables(env.DB);
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
        console.log('[stripe webhook] order insert fallback', {
          orderId,
          displayOrderId,
          success: fallbackResult.success,
          error: fallbackResult.error,
        });
      }

      console.log('[stripe webhook] order insert result', {
        orderId,
        displayOrderId,
        success: orderInsertSucceeded,
        error: insertWithCard.error,
      });

      if (!orderInsertSucceeded) {
        throw new Error(`Order insert failed for session ${session.id}`);
      }

      const lineItems = session.line_items?.data || [];
      if (lineItems.length) {
        for (const line of lineItems) {
          const itemId = crypto.randomUUID();
          const qty = line.quantity ?? 1;
          const priceCents = line.price?.unit_amount ?? 0;
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
        console.log('[stripe webhook] inserted order and items', { orderId, displayOrderId, items: lineItems.length });
      } else {
        if (productId) {
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
            console.log('[stripe webhook] inserted order with fallback item', { orderId, displayOrderId, productId });
          }
        } else {
          console.warn('[stripe webhook] no line items available to insert for session', { sessionId: session.id });
        }
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Error handling Stripe webhook', error);
    return new Response('Webhook handling failed', { status: 500 });
  }
};

async function ensureOrdersSchema(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    display_order_id TEXT,
    order_type TEXT,
    stripe_payment_intent_id TEXT,
    total_cents INTEGER,
    currency TEXT,
    customer_email TEXT,
    shipping_name TEXT,
    shipping_address_json TEXT,
    card_last4 TEXT,
    card_brand TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    price_cents INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS order_counters (
    year INTEGER PRIMARY KEY,
    counter INTEGER NOT NULL
  );`).run();

  const columns = await db.prepare(`PRAGMA table_info(orders);`).all<{ name: string }>();
  const columnNames = (columns.results || []).map((c) => c.name);
  const addColumnIfMissing = async (name: string, ddl: string) => {
    if (!columnNames.includes(name)) {
      await db.prepare(ddl).run();
    }
  };

  await addColumnIfMissing('display_order_id', `ALTER TABLE orders ADD COLUMN display_order_id TEXT;`);
  await addColumnIfMissing('order_type', `ALTER TABLE orders ADD COLUMN order_type TEXT;`);
  await addColumnIfMissing('currency', `ALTER TABLE orders ADD COLUMN currency TEXT;`);
  await addColumnIfMissing('description', `ALTER TABLE orders ADD COLUMN description TEXT;`);

  await db
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_display_order_id ON orders(display_order_id);`
    )
    .run();

  await backfillDisplayOrderIds(db);
}

async function generateDisplayOrderId(db: D1Database): Promise<string> {
  const yearFull = new Date().getFullYear();
  const yy = yearFull % 100;
  let counter = 1;
  try {
    const counterRow = await db
      .prepare(
        `INSERT INTO order_counters (year, counter)
         VALUES (?, 1)
         ON CONFLICT(year) DO UPDATE SET counter = counter + 1
         RETURNING counter;`
      )
      .bind(yearFull)
      .first<{ counter: number }>();

    if (!counterRow || typeof counterRow.counter !== 'number') {
      throw new Error('counter missing');
    }
    counter = counterRow.counter;
  } catch (err) {
    console.error('[stripe webhook] counter upsert failed, falling back', err);
    const existing = await db
      .prepare(`SELECT counter FROM order_counters WHERE year = ?`)
      .bind(yearFull)
      .first<{ counter: number }>();
    counter = existing?.counter ? existing.counter + 1 : 1;
    const res = existing
      ? await db.prepare(`UPDATE order_counters SET counter = ? WHERE year = ?`).bind(counter, yearFull).run()
      : await db.prepare(`INSERT INTO order_counters (year, counter) VALUES (?, ?)`).bind(yearFull, counter).run();
    if (!res.success) {
      throw new Error('Failed to update order counter');
    }
  }

  const padded = String(counter).padStart(3, '0');
  return `${yy}-${padded}`;
}

async function assertOrdersTables(db: D1Database) {
  const tables = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('orders','order_items','order_counters');`
    )
    .all<{ name: string }>();
  const existing = new Set((tables.results || []).map((t) => t.name));
  const missing = ['orders', 'order_items', 'order_counters'].filter((t) => !existing.has(t));
  if (missing.length) {
    const message = `Missing required tables: ${missing.join(', ')}`;
    console.error('[stripe webhook] schema missing', message);
    throw new Error(message);
  }
}

async function handleCustomInvoicePayment(args: {
  db: D1Database;
  env: Env;
  session: Stripe.Checkout.Session;
  paymentIntentId: string | null;
  amountTotal: number;
  currency: string;
  customerEmail: string | null;
}) {
  const { db, env, session, paymentIntentId, amountTotal, currency, customerEmail } = args;
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  // Update invoice status
  const now = new Date().toISOString();
  const update = await db
    .prepare(
      `UPDATE custom_invoices
       SET status = 'paid',
           paid_at = ?,
           stripe_payment_intent_id = ?
       WHERE id = ?;`
    )
    .bind(now, paymentIntentId, invoiceId)
    .run();

  if (!update.success) {
    console.error('[webhooks] Failed to mark custom invoice paid', update.error);
  }

  // Insert order record (must succeed to return 200)
  await assertOrdersTables(db);
  const orderId = crypto.randomUUID();
  const displayOrderId = await generateDisplayOrderId(db);
  const description = session.metadata?.description || 'Custom invoice payment';
  const amountCents = amountTotal ?? 0;
  const email = customerEmail || session.customer_details?.email || null;

  let inserted = await db
    .prepare(
      `INSERT INTO orders (
        id, display_order_id, order_type, stripe_payment_intent_id, total_cents, currency, customer_email, shipping_name, shipping_address_json, card_last4, card_brand, description
      ) VALUES (?, ?, 'custom', ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?);`
    )
    .bind(orderId, displayOrderId, paymentIntentId, amountCents, currency, email, description)
    .run();

  if (!inserted.success && inserted.error?.includes('no such column')) {
    inserted = await db
      .prepare(
        `INSERT INTO orders (
          id, display_order_id, stripe_payment_intent_id, total_cents, customer_email
        ) VALUES (?, ?, ?, ?, ?);`
      )
      .bind(orderId, displayOrderId, paymentIntentId, amountCents, email)
      .run();
  }

  if (!inserted.success) {
    throw new Error('[webhooks] Failed to insert custom order record');
  }

  // Send emails (best effort)
  const invoiceAmount = formatAmount(amountTotal, currency);
  const invoiceLink = env.PUBLIC_SITE_URL
    ? `${env.PUBLIC_SITE_URL.replace(/\/+$/, '')}/invoice/${invoiceId}`
    : `/invoice/${invoiceId}`;

  if (customerEmail) {
    await sendEmail(
      {
        to: customerEmail,
        subject: 'Payment received — The Chesapeake Shell',
        html: `
          <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; padding: 12px; line-height: 1.5;">
            <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700;">Thank you for your payment</h2>
            <p style="margin: 0 0 8px;">We received your payment for invoice ${invoiceId}.</p>
            <p style="margin: 0 0 12px; font-weight: 600;">Amount: ${invoiceAmount}</p>
            <p style="margin: 0 0 12px;">You can revisit your invoice here: <a href="${invoiceLink}" style="color:#0f172a;">${invoiceLink}</a></p>
          </div>
        `,
        text: `Thank you for your payment.\nInvoice: ${invoiceId}\nAmount: ${invoiceAmount}\nView invoice: ${invoiceLink}`,
      },
      env
    );
  }

  if (env.EMAIL_OWNER_TO) {
    await sendEmail(
      {
        to: env.EMAIL_OWNER_TO,
        subject: `Custom invoice paid — ${invoiceId}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; padding: 12px; line-height: 1.5;">
            <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700;">Custom invoice paid</h2>
            <p style="margin: 0 0 8px;">Invoice ID: ${invoiceId}</p>
            <p style="margin: 0 0 8px;">Customer: ${customerEmail || 'Unknown'}</p>
            <p style="margin: 0 0 12px; font-weight: 600;">Amount: ${invoiceAmount}</p>
            <p style="margin: 0 0 12px;">Link: <a href="${invoiceLink}" style="color:#0f172a;">${invoiceLink}</a></p>
          </div>
        `,
        text: `Custom invoice paid\nInvoice: ${invoiceId}\nCustomer: ${customerEmail || 'Unknown'}\nAmount: ${invoiceAmount}\nLink: ${invoiceLink}`,
      },
      env
    );
  }
}

function formatAmount(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format((amountCents || 0) / 100);
  } catch {
    return `$${((amountCents || 0) / 100).toFixed(2)} ${currency}`;
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
