import type { CartItem, Order } from '../types';
import { mockOrders, mockProducts } from './mockData';

// TODO: Replace with Cloudflare D1 reads/writes. The website/admin owns the catalog and order state.

export async function getOrders(): Promise<Order[]> {
  return mockOrders;
}

export async function validateCart(items: CartItem[]): Promise<{
  availableItems: CartItem[];
  unavailableItems: CartItem[];
}> {
  const unavailableItems = items.filter((item) => {
    const product = mockProducts.find((p) => p.stripeProductId === item.stripeProductId);

    if (!product) return true;
    if (item.quantity <= 0) return true;
    if (product.isSold) return true;
    if (product.oneoff && item.quantity > 1) return true;

    return false;
  });

  const availableItems = items.filter(
    (item) => !unavailableItems.some((u) => u.stripeProductId === item.stripeProductId)
  );

  return { availableItems, unavailableItems };
}
