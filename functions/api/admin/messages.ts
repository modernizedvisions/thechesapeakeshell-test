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
};

export async function onRequestGet(context: { env: { DB: D1Database } }): Promise<Response> {
  try {
    await ensureMessagesSchema(context.env.DB);
    const statement = context.env.DB.prepare(`
      SELECT id, name, email, message, image_url, created_at
      FROM messages
      ORDER BY created_at DESC
    `);
    const { results } = await statement.all<MessageRow>();
    const messages = (results || []).map((row) => ({
      id: row.id,
      name: row.name ?? '',
      email: row.email ?? '',
      message: row.message ?? '',
      imageUrl: row.image_url,
      createdAt: row.created_at,
    }));

    return jsonResponse({ messages });
  } catch (err) {
    console.error('Failed to fetch messages', err);
    return jsonResponse({ error: 'Failed to fetch messages' }, 500);
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
