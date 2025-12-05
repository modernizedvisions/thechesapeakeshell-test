import type { CartItem } from '../types';

export interface EmbeddedCheckoutSession {
  stripeClientSecret: string;
  reservedUntil: string;
}

// TODO: Move to a Cloudflare Worker that checks D1 inventory and creates a Stripe Embedded Checkout session.
export async function createEmbeddedCheckoutSession(items: CartItem[]): Promise<EmbeddedCheckoutSession> {
  // Using a mock response keeps the UI behavior intact until Workers + D1 + Stripe are wired up.
  const reservedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  return {
    stripeClientSecret: 'demo_client_secret',
    reservedUntil,
  };
}
