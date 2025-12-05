import type { Product } from '../../src/lib/types';

type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
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
  is_active: number | null;
  created_at: string | null;
};

export async function onRequestGet(context: { env: { DB: D1Database }; request: Request }): Promise<Response> {
  try {
    const statement = context.env.DB.prepare(`
      SELECT id, name, slug, description, price_cents, category, image_url, is_active, created_at
      FROM products
      WHERE is_active = 1 OR is_active IS NULL
      ORDER BY created_at DESC;
    `);

    const { results } = await statement.all<ProductRow>();
    const products: Product[] = (results || []).map((row) => ({
      id: row.id,
      stripeProductId: row.id, // placeholder until Stripe price/product linkage is added
      stripePriceId: undefined,
      name: row.name ?? '',
      description: row.description ?? '',
      imageUrls: row.image_url ? [row.image_url] : [],
      imageUrl: row.image_url ?? '',
      thumbnailUrl: row.image_url ?? undefined,
      type: row.category ?? 'General',
      collection: row.category ?? undefined,
      oneoff: false,
      visible: row.is_active === null ? true : row.is_active === 1,
      isSold: false,
      priceCents: row.price_cents ?? undefined,
      soldAt: undefined,
    }));

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
