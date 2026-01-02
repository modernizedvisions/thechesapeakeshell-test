import type { Product } from '../../src/lib/types';

type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; error?: string }>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type ProductRow = {
  id: string;
  name: string | null;
  slug?: string | null;
  description: string | null;
  price_cents: number | null;
  category: string | null;
  image_url: string | null;
  image_urls_json?: string | null;
  is_active: number | null;
  is_one_off?: number | null;
  is_sold?: number | null;
  quantity_available?: number | null;
  stripe_price_id?: string | null;
  stripe_product_id?: string | null;
  collection?: string | null;
  created_at: string | null;
};

type CustomOrderRow = {
  id: string;
  display_custom_order_id?: string | null;
  description?: string | null;
  image_url?: string | null;
  paid_at?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export async function onRequestGet(context: { env: { DB: D1Database }; request: Request }): Promise<Response> {
  try {
    await ensureProductSchema(context.env.DB);

    const url = new URL(context.request.url);
    const filter = url.searchParams.get('filter');

    const isSoldFilter = filter === 'sold';

    const statement = isSoldFilter
      ? context.env.DB.prepare(`
          SELECT id, name, slug, description, price_cents, category, image_url, image_urls_json, is_active,
                 is_one_off, is_sold, quantity_available, stripe_price_id, stripe_product_id, collection, created_at
          FROM products
          WHERE (is_sold = 1 OR quantity_available = 0)
          ORDER BY created_at DESC;
        `)
      : context.env.DB.prepare(`
          SELECT id, name, slug, description, price_cents, category, image_url, image_urls_json, is_active,
                 is_one_off, is_sold, quantity_available, stripe_price_id, stripe_product_id, collection, created_at
          FROM products
          WHERE (is_active = 1 OR is_active IS NULL)
            AND (is_sold IS NULL OR is_sold = 0)
            AND (quantity_available IS NULL OR quantity_available > 0)
          ORDER BY created_at DESC;
        `);

    const { results } = await statement.all<ProductRow>();
    const products: Product[] = (results || []).map((row) => {
      const extraImages = row.image_urls_json ? safeParseJsonArray(row.image_urls_json) : [];
      const primaryImage = row.image_url || extraImages[0] || '';

      return {
        id: row.id,
        stripeProductId: row.stripe_product_id || row.id, // placeholder until Stripe linkage is added
        stripePriceId: row.stripe_price_id || undefined,
        name: row.name ?? '',
        description: row.description ?? '',
        imageUrls: primaryImage ? [primaryImage, ...extraImages.filter((url) => url !== primaryImage)] : extraImages,
        imageUrl: primaryImage,
        thumbnailUrl: primaryImage || undefined,
        type: row.category ?? 'General',
        category: row.category ?? undefined,
        categories: row.category ? [row.category] : undefined,
        collection: row.collection ?? row.category ?? undefined,
        oneoff: row.is_one_off === null ? true : row.is_one_off === 1,
        visible: row.is_active === null ? true : row.is_active === 1,
        isSold: row.is_sold === 1,
        priceCents: row.price_cents ?? undefined,
        soldAt: undefined,
        quantityAvailable: row.quantity_available ?? undefined,
        slug: row.slug ?? undefined,
      };
    });

    if (isSoldFilter) {
      try {
        const { results: customResults } = await context.env.DB.prepare(
          `
          SELECT id, display_custom_order_id, description, image_url, paid_at, status, created_at
          FROM custom_orders
          WHERE status = 'paid'
          ORDER BY datetime(paid_at) DESC, datetime(created_at) DESC;
        `
        ).all<CustomOrderRow>();
        const customOrders = (customResults || []).map((row) => {
          const displayId = row.display_custom_order_id || row.id;
          const name = displayId ? `Custom Order ${displayId}` : 'Custom Order';
          const imageUrl = row.image_url || '';
          return {
            id: `custom_order:${row.id}`,
            name,
            description: row.description || '',
            imageUrls: imageUrl ? [imageUrl] : [],
            imageUrl,
            thumbnailUrl: imageUrl || undefined,
            type: 'Custom',
            category: 'Custom',
            categories: ['Custom'],
            collection: 'Custom Orders',
            oneoff: true,
            visible: true,
            isSold: true,
            priceCents: undefined,
            soldAt: row.paid_at || row.created_at || undefined,
            quantityAvailable: 0,
            stripeProductId: undefined,
            stripePriceId: undefined,
            slug: undefined,
          } as Product;
        });
        products.push(...customOrders);
      } catch (error) {
        console.error('Failed to load custom orders for sold list', error);
      }
      products.sort((a, b) => {
        const aTime = a.soldAt ? new Date(a.soldAt).getTime() : 0;
        const bTime = b.soldAt ? new Date(b.soldAt).getTime() : 0;
        return bTime - aTime;
      });
    }

    return new Response(JSON.stringify({ products }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to load products from D1', error);
    return new Response(JSON.stringify({ error: 'Failed to load products' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

const safeParseJsonArray = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const REQUIRED_PRODUCT_COLUMNS: Record<string, string> = {
  image_urls_json: 'image_urls_json TEXT',
  is_one_off: 'is_one_off INTEGER DEFAULT 1',
  is_sold: 'is_sold INTEGER DEFAULT 0',
  quantity_available: 'quantity_available INTEGER DEFAULT 1',
  stripe_price_id: 'stripe_price_id TEXT',
  stripe_product_id: 'stripe_product_id TEXT',
  collection: 'collection TEXT',
};

const createProductsTable = `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT,
    slug TEXT,
    description TEXT,
    price_cents INTEGER,
    category TEXT,
    image_url TEXT,
    image_urls_json TEXT,
    is_active INTEGER DEFAULT 1,
    is_one_off INTEGER DEFAULT 1,
    is_sold INTEGER DEFAULT 0,
    quantity_available INTEGER DEFAULT 1,
    stripe_price_id TEXT,
    stripe_product_id TEXT,
    collection TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

async function ensureProductSchema(db: D1Database) {
  await db.prepare(createProductsTable).run();

  for (const [name, ddl] of Object.entries(REQUIRED_PRODUCT_COLUMNS)) {
    try {
      await db.prepare(`ALTER TABLE products ADD COLUMN ${ddl};`).run();
    } catch (error) {
      const message = (error as Error)?.message || '';
      if (!/duplicate column|already exists/i.test(message)) {
        console.error(`Failed to add column ${name}`, error);
      }
    }
  }
}
