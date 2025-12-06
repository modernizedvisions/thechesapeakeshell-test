export interface EmbeddedCheckoutSession {
  clientSecret: string;
}

export interface CheckoutSessionInfo {
  id: string;
  amountTotal: number | null;
  currency: string | null;
  customerEmail: string | null;
  shipping: {
    name: string | null;
    address: Record<string, string | null> | null;
  } | null;
  lineItems: {
    productName: string;
    quantity: number;
    lineTotal: number;
  }[];
  cardLast4: string | null;
}

export async function createEmbeddedCheckoutSession(productId: string, quantity = 1): Promise<EmbeddedCheckoutSession> {
  const response = await fetch('/api/checkout/create-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ productId, quantity }),
  });

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    // ignore
  }
  console.log('create-session response', response.status, data);

  if (!response.ok) {
    const message = (data && data.error) || (await safeMessage(response));
    throw new Error(message || 'Unable to start checkout');
  }

  if (!data?.clientSecret) {
    throw new Error('Missing client secret from checkout session');
  }

  return { clientSecret: data.clientSecret as string };
}

export async function fetchCheckoutSession(sessionId: string): Promise<CheckoutSessionInfo | null> {
  const response = await fetch(`/api/checkout/session/${sessionId}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const message = await safeMessage(response);
    throw new Error(message || 'Unable to fetch checkout session');
  }

  const data = await response.json();
  return {
    id: data.id as string,
    amountTotal: data.amount_total ?? null,
    currency: data.currency ?? null,
    customerEmail: data.customer_email ?? null,
    shipping: data.shipping ?? null,
    lineItems: Array.isArray(data.line_items)
      ? data.line_items.map((li: any) => ({
          productName: li.productName ?? 'Item',
          quantity: li.quantity ?? 0,
          lineTotal: li.lineTotal ?? 0,
        }))
      : [],
    cardLast4: data.card_last4 ?? null,
  };
}

const safeMessage = async (response: Response): Promise<string | null> => {
  try {
    const data = await response.json();
    if (data?.error) return data.error as string;
  } catch {
    // ignore parse errors
  }
  return null;
};
