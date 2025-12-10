type D1PreparedStatement = {
  run(): Promise<{ success: boolean; error?: string }>;
  bind(...values: unknown[]): D1PreparedStatement;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

interface MessageInput {
  name?: string;
  email?: string;
  message?: string;
  imageUrl?: string | null;
}

export async function onRequestPost(context: { env: { DB: D1Database }; request: Request }): Promise<Response> {
  try {
    await ensureMessagesSchema(context.env.DB);
    const body = (await context.request.json().catch(() => null)) as MessageInput | null;
    const name = body?.name?.trim() || '';
    const email = body?.email?.trim() || '';
    const message = body?.message?.trim() || '';
    if (!name || !email || !message) {
      return jsonResponse({ error: 'Name, email, and message are required.' }, 400);
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const insert = context.env.DB.prepare(
      `INSERT INTO messages (id, name, email, message, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, name, email, message, body?.imageUrl || null, createdAt);

    const result = await insert.run();
    if (!result.success) {
      console.error('Failed to insert message', result.error);
      return jsonResponse({ error: 'Failed to save message' }, 500);
    }

    // TODO: Hook up outbound email/notifications when available.
    return jsonResponse({ success: true, id, createdAt });
  } catch (err) {
    console.error('Error handling message submission', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
}

async function ensureMessagesSchema(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    message TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`).run();
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}
