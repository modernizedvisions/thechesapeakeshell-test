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
  const res = await fetch('/api/admin/orders');
  if (!res.ok) {
    console.error('Failed to fetch admin orders', await res.text());
    throw new Error('Failed to fetch admin orders');
  }
  const data = await res.json();
  return Array.isArray(data.orders) ? (data.orders as AdminOrder[]) : [];
}
