export type AdminOrderItem = {
  productId: string;
  productName: string | null;
  quantity: number;
  priceCents: number;
};

export type AdminOrder = {
  id: string;
  displayOrderId?: string | null;
  createdAt: string;
  totalCents: number;
  customerEmail: string | null;
  shippingName: string | null;
  customerName: string | null;
  shippingAddress: Record<string, any> | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  items: AdminOrderItem[];
};

export async function getAdminOrders(): Promise<AdminOrder[]> {
  const res = await fetch('/api/admin/orders', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const bodyText = await res.text();
  const preview = bodyText.slice(0, 500);

  if (import.meta.env.DEV) {
    console.debug('[admin orders] fetch response', { status: res.status, bodyPreview: preview });
  }

  if (!res.ok) {
    throw new Error(bodyText || `Failed to fetch admin orders (${res.status})`);
  }

  let data: any = {};
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    console.error('Failed to parse admin orders response', err);
    throw new Error('Failed to parse admin orders response');
  }

  const orders = Array.isArray(data.orders) ? (data.orders as AdminOrder[]) : [];
  if (import.meta.env.DEV) {
    console.debug('[admin orders] parsed orders', { count: orders.length });
  }
  return orders;
}
