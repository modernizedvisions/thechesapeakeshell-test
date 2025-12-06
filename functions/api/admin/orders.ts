type D1PreparedStatement = {
  all<T>(): Promise<{ results: T[] }>;
  bind(...values: unknown[]): D1PreparedStatement;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type OrderRow = {
  id: string;
  stripe_payment_intent_id: string | null;
  total_cents: number | null;
  customer_email: string | null;
  shipping_name: string | null;
  shipping_address_json: string | null;
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
    const ordersStmt = context.env.DB.prepare(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 20;`
    );
    const { results: orderRows } = await ordersStmt.all<OrderRow>();

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
      createdAt: o.created_at,
      totalCents: o.total_cents ?? 0,
      customerEmail: o.customer_email,
      shippingName: o.shipping_name,
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
