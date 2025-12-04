export interface Product {
  id: string;
  stripeProductId: string;
  name: string;
  description: string;
  imageUrls: string[];
  imageUrl: string;
  thumbnailUrl?: string;
  type: string;
  collection?: string;
  oneoff: boolean;
  visible: boolean;
  isSold: boolean;
  stripePriceId?: string;
  priceCents?: number;
  soldAt?: string;
}

export interface CartItem {
  stripeProductId: string;
  stripePriceId: string;
  name: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
  oneoff: boolean;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
}

export interface Order {
  id: string;
  customer: Customer;
  items: CartItem[];
  totalCents: number;
  status: 'paid' | 'pending' | 'canceled';
  createdAt: string;
}

export interface GalleryImage {
  id: string;
  imageUrl: string;
  hidden: boolean;
  title?: string;
  createdAt?: string;
}

// Reuse gallery image shape for home hero assets so admin tooling can share behavior.
export interface HeroImage extends GalleryImage {}

export interface HeroConfig {
  mainImage?: HeroImage | null;
  gridImages: HeroImage[]; // capped at 6 in UI
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number; // 1–5
  comment: string;
  createdAt: string; // ISO date
}
