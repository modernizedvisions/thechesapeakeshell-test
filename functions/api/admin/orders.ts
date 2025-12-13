type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; error?: string; meta?: { changes?: number } }>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type OrderRow = {
  id: string;
  display_order_id?: string | null;
  stripe_payment_intent_id: string | null;
  total_cents: number | null;
  customer_email: string | null;
  shipping_name: string | null;
  shipping_address_json: string | null;
  card_last4?: string | null;
  card_brand?: string | null;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_cents: number;
  product_name: string | null;
};

export const onRequestGet = async (context: { env: { DB: D1Database } }): Promise<Response> => {
  try {
    await ensureOrdersSchema(context.env.DB);
    let orderRows: OrderRow[] = [];
    // First try selecting card fields (may not exist in older schema).
    try {
      const ordersWithCardStmt = context.env.DB.prepare(
        `SELECT id, display_order_id, stripe_payment_intent_id, total_cents, customer_email, shipping_name, shipping_address_json, card_last4, card_brand, created_at
         FROM orders ORDER BY created_at DESC LIMIT 20;`
      );
      const res = await ordersWithCardStmt.all<OrderRow>();
      orderRows = res.results || [];
    } catch {
      const fallbackStmt = context.env.DB.prepare(
        `SELECT id, stripe_payment_intent_id, total_cents, customer_email, shipping_name, shipping_address_json, created_at
         FROM orders ORDER BY created_at DESC LIMIT 20;`
      );
      const res = await fallbackStmt.all<OrderRow>();
      orderRows = res.results || [];
    }

    const orderIds = (orderRows || []).map((o) => o.id);
    let itemsByOrder: Record<string, OrderItemRow[]> = {};

    if (orderIds.length) {
      const placeholders = orderIds.map(() => '?').join(',');
      const itemsStmt = context.env.DB.prepare(
        `
        SELECT oi.*, p.name AS product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id IN (${placeholders});
      `
      ).bind(...orderIds);
      const { results: itemRows } = await itemsStmt.all<OrderItemRow>();
      itemsByOrder = (itemRows || []).reduce((acc, item) => {
        acc[item.order_id] = acc[item.order_id] || [];
        acc[item.order_id].push(item);
        return acc;
      }, {} as Record<string, OrderItemRow[]>);
    }

    const orders = (orderRows || []).map((o) => ({
      id: o.id,
      displayOrderId: o.display_order_id ?? null,
      createdAt: o.created_at,
      totalCents: o.total_cents ?? 0,
      customerEmail: o.customer_email,
      shippingName: o.shipping_name,
      customerName: o.shipping_name,
      shippingAddress: o.shipping_address_json ? safeParseAddress(o.shipping_address_json) : null,
      cardLast4: o.card_last4 ?? null,
      cardBrand: o.card_brand ?? null,
      items: (itemsByOrder[o.id] || []).map((i) => ({
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        priceCents: i.price_cents,
      })),
    }));

    return new Response(JSON.stringify({ orders }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error fetching admin orders', err);
    return new Response(JSON.stringify({ error: 'Failed to load orders' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function safeParseAddress(jsonString: string | null): Record<string, string | null> | null {
  if (!jsonString) return null;
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string | null>;
    }
    return null;
  } catch {
    return null;
  }
}

async function ensureOrdersSchema(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS order_counters (
    year INTEGER PRIMARY KEY,
    counter INTEGER NOT NULL
  );`).run();

  const columns = await db.prepare(`PRAGMA table_info(orders);`).all<{ name: string }>();
  const hasDisplay = (columns.results || []).some((c) => c.name === 'display_order_id');
  if (!hasDisplay) {
    await db.prepare(`ALTER TABLE orders ADD COLUMN display_order_id TEXT;`).run();
  }

  await db
    .prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_display_order_id ON orders(display_order_id);`)
    .run();

  await backfillDisplayOrderIds(db);
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
