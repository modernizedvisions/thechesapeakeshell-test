import { defaultShopCategoryTiles } from '../../src/lib/db/mockData';

type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; error?: string; meta?: { changes?: number } }>;
  first<T>(): Promise<T | null>;
  bind(...values: unknown[]): D1PreparedStatement;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type CategoryRow = {
  id: string;
  name: string | null;
  slug: string | null;
  image_url?: string | null;
  hero_image_url?: string | null;
  show_on_homepage?: number | null;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  heroImageUrl?: string;
  showOnHomePage: boolean;
};

const BASE_CATEGORY_ORDER = [
  { name: 'Ring Dishes', slug: 'ring-dish' },
  { name: 'Ornaments', slug: 'ornament' },
  { name: 'Decor', slug: 'decor' },
  { name: 'Wine Stoppers', slug: 'wine-stopper' },
];

const createCategoriesTable = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    image_url TEXT,
    hero_image_url TEXT,
    show_on_homepage INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

const REQUIRED_CATEGORY_COLUMNS: Record<string, string> = {
  show_on_homepage: 'show_on_homepage INTEGER DEFAULT 0',
  slug: 'slug TEXT',
  hero_image_url: 'hero_image_url TEXT',
};

export async function onRequestGet(context: { env: { DB: D1Database } }): Promise<Response> {
  try {
    await ensureCategorySchema(context.env.DB);
    await seedDefaultCategories(context.env.DB);

    const { results } = await context.env.DB
      .prepare(`SELECT id, name, slug, image_url, hero_image_url, show_on_homepage FROM categories`)
      .all<CategoryRow>();

    const categories = orderCategories(
      (results || []).map(mapRowToCategory).filter((c): c is Category => Boolean(c))
    );

    return new Response(JSON.stringify({ categories }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to load categories', error);
    return new Response(JSON.stringify({ error: 'Failed to load categories' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

const mapRowToCategory = (row: CategoryRow): Category | null => {
  if (!row || !row.id || !row.name || !row.slug) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.image_url || undefined,
    heroImageUrl: row.hero_image_url || undefined,
    showOnHomePage: row.show_on_homepage === 1,
  };
};

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const orderCategories = (items: Category[]): Category[] => {
  const normalize = (value: string) => toSlug(value);
  const used = new Set<string>();
  const ordered: Category[] = [];

  BASE_CATEGORY_ORDER.forEach((base) => {
    const match = items.find(
      (item) => normalize(item.slug) === normalize(base.slug) || normalize(item.name) === normalize(base.name)
    );
    if (match) {
      const key = normalize(match.slug);
      if (!used.has(key)) {
        ordered.push(match);
        used.add(key);
      }
    }
  });

  const remaining = items
    .filter((item) => !used.has(normalize(item.slug)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...ordered, ...remaining];
};

async function seedDefaultCategories(db: D1Database) {
  const existing = await db.prepare('SELECT COUNT(*) as count FROM categories').first<{ count: number | string }>();
  const count = typeof existing?.count === 'number' ? existing.count : Number(existing?.count ?? 0);
  if (count > 0) return;

  for (const tile of defaultShopCategoryTiles) {
    const id = tile.id || tile.categorySlug || crypto.randomUUID();
    const name = tile.label;
    const slug = tile.categorySlug || toSlug(tile.label);
    const imageUrl = tile.imageUrl || null;
    await db
      .prepare(
        `INSERT OR IGNORE INTO categories (id, name, slug, image_url, hero_image_url, show_on_homepage) VALUES (?, ?, ?, ?, ?, ?);`
      )
      .bind(id, name, slug, imageUrl, imageUrl, 1)
      .run();
  }
}

async function ensureCategorySchema(db: D1Database) {
  await db.prepare(createCategoriesTable).run();

  for (const ddl of Object.values(REQUIRED_CATEGORY_COLUMNS)) {
    try {
      await db.prepare(`ALTER TABLE categories ADD COLUMN ${ddl};`).run();
    } catch (error) {
      const message = (error as Error)?.message || '';
      if (!/duplicate column|already exists/i.test(message)) {
        console.error('Failed to add column to categories', error);
      }
    }
  }

  // Backfill missing slugs/show_on_homepage values for existing rows if any
  const { results } = await db
    .prepare(`SELECT id, name FROM categories WHERE slug IS NULL OR slug = ''`)
    .all<{ id: string; name: string | null }>();
  if (results && results.length) {
    for (const row of results) {
      if (!row?.id || !row?.name) continue;
      const slug = toSlug(row.name);
      await db.prepare(`UPDATE categories SET slug = ? WHERE id = ?;`).bind(slug, row.id).run();
    }
  }
  await db.prepare(`UPDATE categories SET show_on_homepage = 0 WHERE show_on_homepage IS NULL;`).run();
  await db
    .prepare(
      `UPDATE categories SET hero_image_url = image_url WHERE (hero_image_url IS NULL OR hero_image_url = '') AND image_url IS NOT NULL;`
    )
    .run();
}
