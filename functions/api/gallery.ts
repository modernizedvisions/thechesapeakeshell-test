type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; error?: string }>;
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type GalleryRow = {
  id: string;
  image_url: string | null;
  alt_text?: string | null;
  is_active?: number | null;
  position?: number | null;
  created_at?: string | null;
};

const createGalleryTable = `
  CREATE TABLE IF NOT EXISTS gallery_images (
    id TEXT PRIMARY KEY,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    is_active INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

export async function onRequestGet(context: { env: { DB: D1Database } }): Promise<Response> {
  try {
    await ensureGallerySchema(context.env.DB);
    const { results } = await context.env.DB
      .prepare(
        `SELECT id, image_url, alt_text, is_active, position, created_at
         FROM gallery_images
         ORDER BY position ASC, created_at ASC;`
      )
      .all<GalleryRow>();

    const images = (results || []).map(mapRowToImage).filter(Boolean);

    return new Response(JSON.stringify({ images }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Failed to load gallery images', error);
    return new Response(JSON.stringify({ error: 'Failed to load gallery images' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPut(context: { env: { DB: D1Database }; request: Request }): Promise<Response> {
  try {
    await ensureGallerySchema(context.env.DB);
    const body = await context.request.json();
    const images = Array.isArray(body?.images) ? body.images : [];

    // Overwrite-all approach keeps ordering simple for now.
    await context.env.DB.prepare(`DELETE FROM gallery_images;`).run();

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img?.imageUrl) continue;
      const id = img.id || crypto.randomUUID();
      await context.env.DB
        .prepare(
          `INSERT INTO gallery_images (id, image_url, alt_text, is_active, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`
        )
        .bind(
          id,
          img.imageUrl,
          img.alt || img.title || null,
          img.hidden ? 0 : 1,
          Number.isFinite(img.position) ? img.position : i,
          img.createdAt || new Date().toISOString()
        )
        .run();
    }

    const refreshed = await context.env.DB
      .prepare(
        `SELECT id, image_url, alt_text, is_active, position, created_at
         FROM gallery_images
         ORDER BY position ASC, created_at ASC;`
      )
      .all<GalleryRow>();

    const savedImages = (refreshed.results || []).map(mapRowToImage).filter(Boolean);

    return new Response(JSON.stringify({ images: savedImages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Failed to save gallery images', error);
    return new Response(JSON.stringify({ error: 'Failed to save gallery images' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function mapRowToImage(row: GalleryRow | null | undefined) {
  if (!row?.id || !row.image_url) return null;
  return {
    id: row.id,
    imageUrl: row.image_url,
    alt: row.alt_text || undefined,
    title: row.alt_text || undefined,
    hidden: row.is_active === 0,
    position: row.position ?? 0,
    createdAt: row.created_at || undefined,
  };
}

async function ensureGallerySchema(db: D1Database) {
  await db.prepare(createGalleryTable).run();
}
