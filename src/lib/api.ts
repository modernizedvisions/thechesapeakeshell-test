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
} from './db/content';
import { getOrders, validateCart as validateCartFromDb } from './db/orders';
import { getReviewsForProduct } from './db/reviews';
import { createEmbeddedCheckoutSession, fetchCheckoutSession } from './payments/checkout';
import { sendContactEmail } from './contact';
import { verifyAdminPassword } from './auth';

// Aggregates the mock data layer and stubs so the UI can continue working while we
// prepare for Cloudflare D1 + Stripe with the site/admin as the source of truth.

export const fetchProducts = getActiveProducts;
export const fetchProductById = getProductById;
export const fetchRelatedProducts = getRelatedProducts;
export const fetchOrders = getOrders;
export const fetchSoldProducts = getSoldProducts;
export const adminFetchProducts = fetchAdminProducts;
export const adminCreateProduct = createAdminProduct;
export const adminUpdateProduct = updateAdminProduct;
export const adminDeleteProduct = deleteAdminProduct;
export const fetchGalleryImages = getGalleryImages;
export const saveGalleryImages = persistGalleryImages;
export const fetchHomeHeroConfig = getHomeHeroConfig;
export const saveHomeHeroConfig = persistHomeHeroConfig;
export const fetchReviewsForProduct = getReviewsForProduct;
export const validateCart = validateCartFromDb;

export { createEmbeddedCheckoutSession, fetchCheckoutSession, sendContactEmail, verifyAdminPassword };
