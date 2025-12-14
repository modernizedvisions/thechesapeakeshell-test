import Stripe from 'stripe';
import { sendEmail } from '../../../../_lib/email';

type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; error?: string; meta?: { changes?: number } }>;
  bind(...values: unknown[]): D1PreparedStatement;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type CustomOrderRow = {
  id: string;
  display_custom_order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_email1?: string | null;
  description: string | null;
  amount: number | null;
  payment_link?: string | null;
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      pragma: 'no-cache',
      expires: '0',
    },
  });

const createStripeClient = (secretKey: string) =>
  new Stripe(secretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

export async function onRequestPost(context: {
  env: {
    DB: D1Database;
    STRIPE_SECRET_KEY?: string;
    PUBLIC_SITE_URL?: string;
    VITE_PUBLIC_SITE_URL?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    RESEND_REPLY_TO?: string;
    EMAIL_FROM?: string;
  };
  params: Record<string, string>;
}) {
  const { env, params } = context;
  const id = params?.id;

  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Failed to send payment link', detail: 'Missing STRIPE_SECRET_KEY' }, 500);
  }
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);

  const hasResend = !!env.RESEND_API_KEY;
  const fromEmail = env.RESEND_FROM_EMAIL || env.EMAIL_FROM;
  if (!hasResend) {
    return jsonResponse({ error: 'Failed to send payment link', detail: 'Missing RESEND_API_KEY' }, 500);
  }
  if (!fromEmail) {
    return jsonResponse({ error: 'Failed to send payment link', detail: 'Missing RESEND_FROM_EMAIL/EMAIL_FROM' }, 500);
  }

  try {
    await ensureCustomOrdersSchema(env.DB);
    const columns = await getCustomOrdersColumns(env.DB);
    const emailCol = columns.emailCol;

    const order = await env.DB.prepare(
      `SELECT id, display_custom_order_id, customer_name, ${emailCol ? `${emailCol} AS customer_email` : 'NULL AS customer_email'}, description, amount, payment_link
       FROM custom_orders WHERE id = ?`
    )
      .bind(id)
      .first<CustomOrderRow>();

    if (!order) return jsonResponse({ error: 'Not found' }, 404);
    const amount = order.amount ?? 0;
    if (!amount || amount <= 0) {
      return jsonResponse({ error: 'Custom order amount is missing or zero' }, 400);
    }
    const customerEmail = order.customer_email || order.customer_email1;
    if (!customerEmail) {
      return jsonResponse({ error: 'Custom order missing customer email' }, 400);
    }

    const baseUrl = resolveSiteUrl(env);
    if (!baseUrl) {
      return jsonResponse({ error: 'Missing PUBLIC_SITE_URL' }, 500);
    }

    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const shippingCents = 500;
    const displayId = order.display_custom_order_id || order.id;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Custom Order ${displayId}`,
              description: order.description || undefined,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Shipping' },
            unit_amount: shippingCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/admin?customOrderPaid=1&co=${encodeURIComponent(displayId)}`,
      cancel_url: `${baseUrl}/admin?customOrderCanceled=1&co=${encodeURIComponent(displayId)}`,
      metadata: {
        customOrderId: order.id,
        customOrderDisplayId: displayId,
        source: 'custom_order',
        kind: 'custom_order',
      },
    });

    if (!session.url) {
      console.error('[custom-orders send-link] session missing url', { sessionId: session.id });
      return jsonResponse({ error: 'Failed to create payment link', detail: 'No session URL returned' }, 500);
    }

    const update = await env.DB.prepare(
      `UPDATE custom_orders SET payment_link = ?, stripe_session_id = ? WHERE id = ?`
    )
      .bind(session.url, session.id, id)
      .run();
    if (!update.success) {
      console.error('[custom-orders send-link] failed to save link', update.error);
      return jsonResponse({ error: 'Failed to save payment link', detail: update.error || 'unknown error' }, 500);
    }

    const emailResult = await sendEmail(
      {
        to: customerEmail,
        subject: `Payment link for ${displayId}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p style="margin: 0 0 12px;">Hello${order.customer_name ? ` ${order.customer_name}` : ''},</p>
            <p style="margin: 0 0 12px;">Here is your payment link for custom order <strong>${displayId}</strong>.</p>
            <p style="margin: 0 0 12px;">Amount: <strong>$${(amount / 100).toFixed(2)}</strong> (shipping $${(shippingCents / 100).toFixed(2)} included at checkout)</p>
            <p style="margin: 0 0 12px;">Description: ${order.description || 'Custom order'}</p>
            <p style="margin: 0 0 12px;"><a href="${session.url}" style="color:#0f172a;">Pay securely via Stripe</a></p>
            <p style="margin: 0;">Thank you!</p>
          </div>
        `,
        text: `Payment link for custom order ${displayId}\nAmount: $${(amount / 100).toFixed(
          2
        )}\nDescription: ${order.description || 'Custom order'}\nPay: ${session.url}`,
      },
      env
    );

    if (!emailResult.ok) {
      console.error('[custom-orders send-link] email send failed', emailResult.error);
    }

    console.log('[custom-orders send-link] done', {
      customOrderId: order.id,
      displayId,
      sessionId: session.id,
      emailOk: emailResult.ok,
    });

    return jsonResponse({ success: true, paymentLink: session.url, sessionId: session.id, emailOk: emailResult.ok });
  } catch (err) {
    console.error('[custom-orders send-link] unexpected error', err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: 'Failed to send payment link', detail: message }, 500);
  }
}

async function ensureCustomOrdersSchema(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS custom_orders (
    id TEXT PRIMARY KEY,
    display_custom_order_id TEXT,
    customer_name TEXT,
    customer_email TEXT,
    description TEXT,
    amount INTEGER,
    message_id TEXT,
    status TEXT DEFAULT 'pending',
    payment_link TEXT,
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS custom_order_counters (
    year INTEGER PRIMARY KEY,
    counter INTEGER NOT NULL
  );`).run();

  const columns = await db.prepare(`PRAGMA table_info(custom_orders);`).all<{ name: string }>();
  const names = (columns.results || []).map((c) => c.name);
  if (!names.includes('display_custom_order_id')) {
    await db.prepare(`ALTER TABLE custom_orders ADD COLUMN display_custom_order_id TEXT;`).run();
  }
  if (!names.includes('stripe_session_id')) {
    await db.prepare(`ALTER TABLE custom_orders ADD COLUMN stripe_session_id TEXT;`).run();
  }
  if (!names.includes('stripe_payment_intent_id')) {
    await db.prepare(`ALTER TABLE custom_orders ADD COLUMN stripe_payment_intent_id TEXT;`).run();
  }

  await db
    .prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_orders_display_id ON custom_orders(display_custom_order_id);`)
    .run();
}

async function getCustomOrdersColumns(db: D1Database) {
  const { results } = await db.prepare(`PRAGMA table_info(custom_orders);`).all<{ name: string }>();
  const allColumns = (results || []).map((c) => c.name);
  const emailCol = allColumns.includes('customer_email')
    ? 'customer_email'
    : allColumns.includes('customer_email1')
    ? 'customer_email1'
    : null;
  return { allColumns, emailCol };
}

function resolveSiteUrl(env: {
  PUBLIC_SITE_URL?: string;
  VITE_PUBLIC_SITE_URL?: string;
}) {
  const raw = env.PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL || '';
  return raw ? raw.replace(/\/+$/, '') : '';
}
