import type { Product } from '../types';
import { mockProducts } from './mockData';

const PRODUCTS_API_PATH = '/api/products';

async function fetchProductsFromApi(): Promise<Product[] | null> {
  try {
    const response = await fetch(PRODUCTS_API_PATH, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Products API responded with ${response.status}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.products)) {
      throw new Error('Products API response missing products array');
    }

    return data.products as Product[];
  } catch (error) {
    console.error('Falling back to mock products', error);
    return null;
  }
}

// TODO: Replace these in-memory lookups with Cloudflare D1 queries.
// The website/admin is the source of truth; Stripe will only be used for payments.

export async function getActiveProducts(filters?: {
  type?: string;
  collection?: string;
  visible?: boolean;
}): Promise<Product[]> {
  const liveProducts = await fetchProductsFromApi();
  let products = liveProducts ?? [...mockProducts];

  if (filters?.visible !== undefined) {
    products = products.filter((p) => p.visible === filters.visible);
  }

  if (filters?.type) {
    products = products.filter((p) => p.type === filters.type);
  }

  if (filters?.collection) {
    products = products.filter((p) => p.collection === filters.collection);
  }

  return products;
}

export async function getProductById(productId: string): Promise<Product | null> {
  const product = mockProducts.find(
    (p) => p.id === productId || p.stripeProductId === productId
  );
  return product || null;
}

export async function getRelatedProducts(type: string, excludeProductId: string): Promise<Product[]> {
  return mockProducts.filter(
    (p) =>
      p.type === type &&
      p.id !== excludeProductId &&
      p.stripeProductId !== excludeProductId &&
      !p.isSold
  );
}

export async function getSoldProducts(): Promise<Product[]> {
  return mockProducts.filter((p) => p.isSold);
}
