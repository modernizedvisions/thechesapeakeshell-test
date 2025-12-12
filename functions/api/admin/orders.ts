type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
  bind(...values: unknown[]): D1PreparedStatement;
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
