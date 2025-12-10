type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; error?: string }>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type MessageRow = {
  id: string;
  name: string | null;
  email: string | null;
  message: string | null;
  image_url: string | null;
  created_at: string | null;
  status?: string | null;
};

export async function onRequestGet(context: { env: { DB: D1Database } }): Promise<Response> {
  try {
    await ensureMessagesSchema(context.env.DB);
    const statement = context.env.DB.prepare(`
      SELECT id, name, email, message, image_url, created_at, status
      FROM messages
      ORDER BY created_at DESC
    `);
    const { results } = await statement.all<MessageRow>();
    const messages = (results || []).map((row) => ({
      id: row.id,
      name: row.name ?? '',
      email: row.email ?? '',
      message: row.message ?? '',
      imageUrl: row.image_url ?? null,
      createdAt: row.created_at ?? '',
      status: row.status ?? 'new',
    }));

    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Failed to fetch messages', err);
    return new Response(JSON.stringify({ error: 'Failed to load messages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}

async function ensureMessagesSchema(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    message TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'new',
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
