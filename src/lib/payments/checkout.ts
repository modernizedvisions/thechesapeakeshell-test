export interface EmbeddedCheckoutSession {
  clientSecret: string;
}

export interface CheckoutSessionInfo {
  id: string;
  status: string | null;
  paymentStatus: string | null;
  amountTotal: number | null;
  currency: string | null;
  metadata?: Record<string, string>;
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
    status: (data.status as string) ?? null,
    paymentStatus: (data.paymentStatus as string) ?? null,
    amountTotal: data.amountTotal ?? null,
    currency: data.currency ?? null,
    metadata: data.metadata as Record<string, string> | undefined,
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
