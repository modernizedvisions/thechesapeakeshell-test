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
  display_custom_order_id?: string | null;
  customer_name: string | null;
  customer_email: string | null;
  description: string | null;
  amount: number | null;
  message_id: string | null;
  status: string | null;
  payment_link: string | null;
  created_at: string | null;
};

type CustomOrderPayload = {
  customerName: string;
  customerEmail: string;
  description: string;
  amount?: number;
  messageId?: string | null;
  status?: 'pending' | 'paid';
  paymentLink?: string | null;
};

export async function onRequestGet(context: { env: { DB: D1Database } }): Promise<Response> {
  try {
    await ensureCustomOrdersSchema(context.env.DB);
    console.log('[custom-orders] ensured schema');
    const statement = context.env.DB.prepare(`
      SELECT id, display_custom_order_id, customer_name, customer_email, description, amount, message_id, status, payment_link, created_at
      FROM custom_orders
      ORDER BY created_at DESC
    `);
    const { results } = await statement.all<CustomOrderRow>();
    const orders = (results || []).map(mapRow);
    console.log('[custom-orders] fetched orders', { count: orders.length });
    return jsonResponse({ orders });
  } catch (err) {
    console.error('Failed to fetch custom orders', err);
    return jsonResponse({ error: 'Failed to fetch custom orders' }, 500);
  }
}

export async function onRequestPost(context: { env: { DB: D1Database }; request: Request }): Promise<Response> {
  try {
    await ensureCustomOrdersSchema(context.env.DB);
    console.log('[custom-orders] ensured schema (post)');
    const body = (await context.request.json().catch(() => null)) as Partial<CustomOrderPayload> | null;
    if (!body || !body.customerName || !body.customerEmail || !body.description) {
      return jsonResponse({ error: 'customerName, customerEmail, and description are required.' }, 400);
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const status = body.status === 'paid' ? 'paid' : 'pending';
    const displayId = await generateDisplayCustomOrderId(context.env.DB);

    const stmt = context.env.DB.prepare(`
      INSERT INTO custom_orders (id, display_custom_order_id, customer_name, customer_email, description, amount, message_id, status, payment_link, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      displayId,
      body.customerName.trim(),
      body.customerEmail.trim(),
      body.description.trim(),
      body.amount ?? null,
      body.messageId ?? null,
      status,
      body.paymentLink ?? null,
      createdAt
    );

    const result = await stmt.run();
    if (!result.success) {
      console.error('Failed to insert custom order', result.error);
      return jsonResponse({ error: 'Failed to create custom order' }, 500);
    }

    // TODO: Add Stripe payment link creation when wiring payments.
    return jsonResponse({ success: true, id, displayId, createdAt });
  } catch (err) {
    console.error('Failed to create custom order', err);
    return jsonResponse({ error: 'Failed to create custom order' }, 500);
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS custom_order_counters (
    year INTEGER PRIMARY KEY,
    counter INTEGER NOT NULL
  );`).run();

  const columns = await db.prepare(`PRAGMA table_info(custom_orders);`).all<{ name: string }>();
  const hasDisplayId = (columns.results || []).some((col) => col.name === 'display_custom_order_id');
  if (!hasDisplayId) {
    await db.prepare(`ALTER TABLE custom_orders ADD COLUMN display_custom_order_id TEXT;`).run();
  }

  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_orders_display_id ON custom_orders(display_custom_order_id);`
  ).run();

  await backfillDisplayCustomOrderIds(db);
}

function mapRow(row: CustomOrderRow) {
  return {
    id: row.id,
    displayCustomOrderId: row.display_custom_order_id ?? '',
    customerName: row.customer_name ?? '',
    customerEmail: row.customer_email ?? '',
    description: row.description ?? '',
    amount: row.amount ?? null,
    messageId: row.message_id ?? null,
    status: (row.status as 'pending' | 'paid') ?? 'pending',
    paymentLink: row.payment_link ?? null,
    createdAt: row.created_at ?? null,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

async function generateDisplayCustomOrderId(db: D1Database): Promise<string> {
  const year = new Date().getFullYear() % 100;
  await db.prepare('BEGIN IMMEDIATE TRANSACTION;').run();
  try {
    const existing = await db.prepare(`SELECT counter FROM custom_order_counters WHERE year = ?`).bind(year).first<{ counter: number }>();
    let counter = 1;
    if (existing?.counter) {
      counter = existing.counter + 1;
      await db.prepare(`UPDATE custom_order_counters SET counter = ? WHERE year = ?`).bind(counter, year).run();
    } else {
      await db.prepare(`INSERT INTO custom_order_counters (year, counter) VALUES (?, ?)`).bind(year, counter).run();
    }
    await db.prepare('COMMIT;').run();
    const padded = String(counter).padStart(3, '0');
    return `CO-${year}-${padded}`;
  } catch (error) {
    console.error('Failed to generate display custom order id', error);
    await db.prepare('ROLLBACK;').run();
    throw error;
  }
}

async function backfillDisplayCustomOrderIds(db: D1Database) {
  const missing = await db
    .prepare(
      `SELECT id, created_at FROM custom_orders WHERE display_custom_order_id IS NULL OR display_custom_order_id = '' ORDER BY datetime(created_at) ASC`
    )
    .all<{ id: string; created_at: string }>();

  const rows = missing.results || [];
  if (!rows.length) return;

  const countersByYear = new Map<number, number>();
  const existingCounters = await db.prepare(`SELECT year, counter FROM custom_order_counters`).all<{ year: number; counter: number }>();
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
      const displayId = `CO-${year}-${padded}`;

      await db
        .prepare(`UPDATE custom_orders SET display_custom_order_id = ? WHERE id = ?`)
        .bind(displayId, row.id)
        .run();
    }

    for (const [year, counter] of countersByYear.entries()) {
      const existing = await db.prepare(`SELECT counter FROM custom_order_counters WHERE year = ?`).bind(year).first<{ counter: number }>();
      if (existing) {
        await db.prepare(`UPDATE custom_order_counters SET counter = ? WHERE year = ?`).bind(counter, year).run();
      } else {
        await db.prepare(`INSERT INTO custom_order_counters (year, counter) VALUES (?, ?)`).bind(year, counter).run();
      }
    }

    await db.prepare('COMMIT;').run();
  } catch (error) {
    console.error('Failed to backfill display custom order ids', error);
    await db.prepare('ROLLBACK;').run();
    throw error;
  }
}
