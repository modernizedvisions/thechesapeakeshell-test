import {
  getActiveProducts,
  getProductById,
  getRelatedProducts,
  getSoldProducts,
} from './db/products';
import {
  fetchAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
} from './db/adminProducts';
import {
  getGalleryImages,
  getHomeHeroConfig,
  saveGalleryImages as persistGalleryImages,
  saveHomeHeroConfig as persistHomeHeroConfig,
  fetchShopCategoryTiles as loadShopCategoryTiles,
  saveShopCategoryTiles as persistShopCategoryTiles,
} from './db/content';
import { getAdminOrders } from './db/orders';
import { getReviewsForProduct } from './db/reviews';
import { createEmbeddedCheckoutSession, fetchCheckoutSession } from './payments/checkout';
import { sendContactEmail } from './contact';
import { verifyAdminPassword } from './auth';
import type { Category } from './types';

// Aggregates the mock data layer and stubs so the UI can continue working while we
// prepare for Cloudflare D1 + Stripe with the site/admin as the source of truth.

export const fetchProducts = getActiveProducts;
export const fetchProductById = getProductById;
export const fetchRelatedProducts = getRelatedProducts;
export const fetchOrders = getAdminOrders;
export const fetchSoldProducts = getSoldProducts;
export const adminFetchProducts = fetchAdminProducts;
export const adminCreateProduct = createAdminProduct;
export const adminUpdateProduct = updateAdminProduct;
export const adminDeleteProduct = deleteAdminProduct;
export const fetchGalleryImages = getGalleryImages;
export const saveGalleryImages = persistGalleryImages;
export const fetchHomeHeroConfig = getHomeHeroConfig;
export const saveHomeHeroConfig = persistHomeHeroConfig;
export const fetchShopCategoryTiles = loadShopCategoryTiles;
export const saveShopCategoryTiles = persistShopCategoryTiles;
export const fetchReviewsForProduct = getReviewsForProduct;
// validateCart is no longer exported here (orders/cart validation will be wired separately if needed)

export { createEmbeddedCheckoutSession, fetchCheckoutSession, sendContactEmail, verifyAdminPassword };

export async function fetchCategories(): Promise<Category[]> {
  try {
    const response = await fetch('/api/categories', { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`Categories API responded with ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.categories) ? (data.categories as Category[]) : [];
  } catch (error) {
    console.error('Failed to load categories from API', error);
    return [];
  }
}

const ADMIN_CATEGORIES_PATH = '/api/admin/categories';

export async function adminFetchCategories(): Promise<Category[]> {
  const response = await fetch(ADMIN_CATEGORIES_PATH, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Admin categories fetch failed: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.categories) ? (data.categories as Category[]) : [];
}

export async function adminCreateCategory(name: string): Promise<Category | null> {
  const response = await fetch(ADMIN_CATEGORIES_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`Create category failed: ${response.status}`);
  const data = await response.json();
  return (data as any).category ?? null;
}

export async function adminUpdateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
  const response = await fetch(`${ADMIN_CATEGORIES_PATH}?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error(`Update category failed: ${response.status}`);
  const data = await response.json();
  return (data as any).category ?? null;
}

export async function adminDeleteCategory(id: string): Promise<void> {
  const response = await fetch(`${ADMIN_CATEGORIES_PATH}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Delete category failed: ${response.status}`);
}
