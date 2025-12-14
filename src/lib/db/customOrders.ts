export type AdminCustomOrder = {
  id: string;
  displayCustomOrderId: string;
  customerName: string;
  customerEmail: string;
  description: string;
  amount: number | null;
  status: 'pending' | 'paid';
  paymentLink: string | null;
  createdAt: string | null;
};

const ADMIN_CUSTOM_ORDERS_PATH = '/api/admin/custom-orders';

export async function getAdminCustomOrders(): Promise<AdminCustomOrder[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const url = `${ADMIN_CUSTOM_ORDERS_PATH}?ts=${Date.now()}`;

  if (import.meta.env.DEV) {
    console.debug('[admin custom orders] fetching', { url });
  }

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  const bodyText = await res.text();
  const preview = bodyText.slice(0, 500);

  if (import.meta.env.DEV) {
    console.debug('[admin custom orders] fetch response', { status: res.status, bodyPreview: preview });
  }

  if (!res.ok) {
    throw new Error(bodyText || `Failed to fetch admin custom orders (${res.status})`);
  }

  let data: any = {};
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    console.error('Failed to parse admin custom orders response', err);
    throw new Error('Failed to parse admin custom orders response');
  }

  const orders = Array.isArray(data.orders) ? (data.orders as AdminCustomOrder[]) : [];
  if (import.meta.env.DEV) {
    console.debug('[admin custom orders] parsed orders', { count: orders.length, sample: orders.slice(0, 2), raw: data });
    if (orders.length === 0) {
      console.debug('[admin custom orders] empty orders array returned from /api/admin/custom-orders');
    }
  }
  return orders;
}

export async function createAdminCustomOrder(payload: {
  customerName: string;
  customerEmail: string;
  description: string;
  amount?: number;
  messageId?: string | null;
}): Promise<{ id: string; displayId: string; createdAt: string }> {
  const res = await fetch(ADMIN_CUSTOM_ORDERS_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data && (data.error || data.detail)) ||
      `Failed to create custom order (${res.status})`;
    throw new Error(message);
  }

  return {
    id: data.id as string,
    displayId: data.displayId as string,
    createdAt: data.createdAt as string,
  };
}

export async function updateAdminCustomOrder(
  id: string,
  patch: Partial<{
    customerName: string;
    customerEmail: string;
    description: string;
    amount: number | null;
    status: 'pending' | 'paid';
    paymentLink: string | null;
    messageId: string | null;
  }>
): Promise<void> {
  const res = await fetch(`${ADMIN_CUSTOM_ORDERS_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      (data && (data.error || data.detail)) ||
      `Failed to update custom order (${res.status})`;
    throw new Error(message);
  }
}
