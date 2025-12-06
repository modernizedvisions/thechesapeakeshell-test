import type { Product } from '../types';
import {
  addLocalProduct,
  deleteLocalProduct,
  getLocalProducts,
  updateLocalProduct,
} from './localProducts';

export type AdminProductInput = {
  name: string;
  description: string;
  priceCents: number;
  category: Product['type'];
  imageUrl: string;
  imageUrls?: string[];
  quantityAvailable?: number;
  isOneOff?: boolean;
  isActive?: boolean;
  stripePriceId?: string;
  stripeProductId?: string;
  collection?: string;
};

export type AdminProductUpdateInput = Partial<AdminProductInput>;

const ADMIN_PRODUCTS_PATH = '/api/admin/products';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const message = await safeMessage(response);
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return response.json();
};

const safeMessage = async (response: Response): Promise<string | null> => {
  try {
    const data = await response.json();
    if (data?.error) return data.error;
    return null;
  } catch {
    return null;
  }
};

export async function fetchAdminProducts(): Promise<Product[]> {
  try {
    const response = await fetch(ADMIN_PRODUCTS_PATH, { headers: { Accept: 'application/json' } });
    const data = await handleResponse(response);
    return Array.isArray(data.products) ? (data.products as Product[]) : [];
  } catch (error) {
    console.error('Admin products API unavailable', error);
    throw error;
  }
}

export async function createAdminProduct(input: AdminProductInput): Promise<Product | null> {
  try {
    const response = await fetch(ADMIN_PRODUCTS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await handleResponse(response);
    return data.product ?? null;
  } catch (error) {
    console.error('Create product failed against API', error);
    throw error;
  }
}

export async function updateAdminProduct(id: string, input: AdminProductUpdateInput): Promise<Product | null> {
  try {
    const response = await fetch(`${ADMIN_PRODUCTS_PATH}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await handleResponse(response);
    return data.product ?? null;
  } catch (error) {
    console.error('Update product failed against API', error);
    throw error;
  }
}

export async function deleteAdminProduct(id: string): Promise<void> {
  try {
    const response = await fetch(`${ADMIN_PRODUCTS_PATH}/${id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    await handleResponse(response);
  } catch (error) {
    console.error('Delete product failed against API', error);
    throw error;
  }
}
