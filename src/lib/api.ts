import type { CartItem, GalleryImage, HeroConfig, HeroImage, Order, Product, Review } from './types';

// In production, these functions would call Cloudflare Worker endpoints that query
// Cloudflare D1 and Stripe. Here we use in-memory data to keep the app functional.

const mockProducts: Product[] = [
  {
    id: 'p1',
    stripeProductId: 'prod_demo_shell1',
    stripePriceId: 'price_demo_shell1',
    name: 'Ocean Glass Shell',
    description: 'Handcrafted glass shell with coastal blues.',
    imageUrls: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    type: 'Ring Dish',
    collection: 'Ocean',
    oneoff: false,
    visible: true,
    isSold: false,
    priceCents: 18500,
  },
  {
    id: 'p2',
    stripeProductId: 'prod_demo_shell2',
    stripePriceId: 'price_demo_shell2',
    name: 'Aurora Shell',
    description: 'Iridescent gradients inspired by aurora skies.',
    imageUrls: [
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80',
    type: 'Decor',
    collection: 'Luxe',
    oneoff: true,
    visible: true,
    isSold: false,
    priceCents: 26500,
  },
  {
    id: 'p3',
    stripeProductId: 'prod_demo_shell3',
    stripePriceId: 'price_demo_shell3',
    name: 'Sold Shell',
    description: 'A cherished piece already in a new home.',
    imageUrls: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    type: 'Ornaments',
    collection: 'Heritage',
    oneoff: true,
    visible: true,
    isSold: true,
    priceCents: 21000,
    soldAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: 'p4',
    stripeProductId: 'prod_demo_shell4',
    stripePriceId: 'price_demo_shell4',
    name: 'Sunrise Shell',
    description: 'Warm tones with subtle metallic flecks.',
    imageUrls: [
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80',
    type: 'Wine Stopper',
    collection: 'Sunrise',
    oneoff: false,
    visible: true,
    isSold: false,
    priceCents: 19500,
  },
];

const mockOrders: Order[] = [
  {
    id: 'o1',
    customer: { id: 'c1', name: 'Alex Rivers', email: 'alex@example.com' },
    items: [
      {
        stripeProductId: 'prod_demo_shell1',
        stripePriceId: 'price_demo_shell1',
        name: 'Ocean Glass Shell',
        priceCents: 18500,
        quantity: 1,
        imageUrl: mockProducts[0].imageUrl,
        oneoff: false,
      },
    ],
    totalCents: 18500,
    status: 'paid',
    createdAt: new Date().toISOString(),
  },
];

const mockReviews: Review[] = [
  {
    id: 'r1',
    productId: 'p1',
    author: 'Alex Rivers',
    rating: 5,
    comment: 'Stunning craftsmanship and colors. Looks even better in person!',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'r2',
    productId: 'p2',
    author: 'Jamie Lee',
    rating: 4,
    comment: 'Beautiful gradients. Shipping was fast.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: 'r3',
    productId: 'p1',
    author: 'Taylor Morgan',
    rating: 5,
    comment: 'Bought as a gift and it was a huge hit.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
];

export async function fetchProducts(filters?: {
  type?: string;
  collection?: string;
  visible?: boolean;
}): Promise<Product[]> {
  let products = [...mockProducts];

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

// TODO: Wire fetchProductById to real backend (Cloudflare Worker + D1, populated from Stripe webhooks).
export async function fetchProductById(productId: string): Promise<Product | null> {
  const product = mockProducts.find(
    (p) => p.id === productId || p.stripeProductId === productId
  );
  return product || null;
}

export async function validateCart(items: CartItem[]): Promise<{
  availableItems: CartItem[];
  unavailableItems: CartItem[];
}> {
  // In production, this would call a Cloudflare Worker to check D1 inventory and reservations.
  const unavailableItems = items.filter(
    (item) => item.name.toLowerCase() === 'sold shell' || item.quantity <= 0
  );
  const availableItems = items.filter(
    (item) => !unavailableItems.some((u) => u.stripeProductId === item.stripeProductId)
  );

  return { availableItems, unavailableItems };
}

export async function createEmbeddedCheckoutSession(items: CartItem[]): Promise<{
  stripeClientSecret: string;
  reservedUntil: string;
}> {
  // In production, this function will call a Cloudflare Worker endpoint,
  // which will query D1 to validate inventory state and create a real
  // Stripe Embedded Checkout session.
  const reservedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  return {
    stripeClientSecret: 'demo_client_secret',
    reservedUntil,
  };
}

// TODO: Wire fetchRelatedProducts to real backend (Cloudflare Worker + D1, populated from Stripe webhooks).
export async function fetchRelatedProducts(type: string, excludeProductId: string): Promise<Product[]> {
  return mockProducts.filter(
    (p) =>
      p.type === type &&
      p.id !== excludeProductId &&
      p.stripeProductId !== excludeProductId &&
      !p.isSold
  );
}

export async function sendContactEmail(data: { name: string; email: string; message: string }) {
  // In production, this would call /api/send-contact-email on a Worker using Resend.
  console.info('Mock sendContactEmail', data);
  return { success: true };
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  // In production, this would call /api/verify-admin-password on a Worker.
  return password === 'admin123';
}

export async function fetchOrders(): Promise<Order[]> {
  // In production, fetch orders from D1 through a Worker endpoint.
  return mockOrders;
}

export async function fetchSoldProducts(): Promise<Product[]> {
  return mockProducts.filter((p) => p.isSold);
}

const GALLERY_STORAGE_KEY = 'artist-gallery-images';
const HOME_HERO_STORAGE_KEY = 'home-hero-images'; // reuse existing key for backward compatibility

const defaultGalleryImages: GalleryImage[] = [
  {
    id: 'g1',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/fbcb1a181312/original',
    hidden: false,
  },
  {
    id: 'g2',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/2ebd792370e4/original',
    hidden: false,
  },
  {
    id: 'g3',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/b8100aac5e68/original',
    hidden: false,
  },
  {
    id: 'g4',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/31411a9ecd08/original',
    hidden: false,
  },
  {
    id: 'g5',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/0d594a4c3a71/original',
    hidden: false,
  },
  {
    id: 'g6',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/b06dfd242cbe/original',
    hidden: false,
  },
  {
    id: 'g7',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/2a80e1ff05b2/original',
    hidden: false,
  },
  {
    id: 'g8',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/f8aa6f90acbc/original',
    hidden: false,
  },
  {
    id: 'g9',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/d655de7033af/original',
    hidden: false,
  },
  {
    id: 'g10',
    imageUrl: 'https://files.reimage.dev/modernizedvisions/d8ce04834f3c/original',
    hidden: false,
  },
];

const defaultHomeHeroConfig: HeroConfig = {
  mainImage: {
    id: 'hero-main',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    hidden: false,
  },
  gridImages: [
    {
      id: 'hero1',
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
      hidden: false,
    },
    {
      id: 'hero2',
      imageUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
      hidden: false,
    },
    {
      id: 'hero3',
      imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80',
      hidden: false,
    },
  ],
};

export async function fetchGalleryImages(): Promise<GalleryImage[]> {
  // In production, call a Cloudflare Worker endpoint backed by D1 (gallery_images table).
  try {
    const stored = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as GalleryImage[];
    }
  } catch (err) {
    console.warn('Gallery storage read failed, using defaults.', err);
  }
  return defaultGalleryImages;
}

export async function saveGalleryImages(images: GalleryImage[]): Promise<void> {
  // In production, persist via Worker -> D1. Here we keep it in localStorage.
  localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(images));
}

export async function fetchHomeHeroConfig(): Promise<HeroConfig> {
  try {
    const stored = localStorage.getItem(HOME_HERO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Backward compatibility: previously stored as an array of images.
      if (Array.isArray(parsed)) {
        return {
          mainImage: parsed[0] ? parsed[0] : null,
          gridImages: parsed.slice(0, 6),
        };
      }

      const config = parsed as HeroConfig;
      return {
        mainImage: config.mainImage || null,
        gridImages: Array.isArray(config.gridImages) ? config.gridImages.slice(0, 6) : [],
      };
    }
  } catch (err) {
    console.warn('Home hero storage read failed, using defaults.', err);
  }
  return defaultHomeHeroConfig;
}

export async function saveHomeHeroConfig(config: HeroConfig): Promise<void> {
  const safeConfig: HeroConfig = {
    mainImage: config.mainImage || null,
    gridImages: (config.gridImages || []).slice(0, 6),
  };
  localStorage.setItem(HOME_HERO_STORAGE_KEY, JSON.stringify(safeConfig));
}

// TODO: Wire fetchReviewsForProduct to real reviews storage.
export async function fetchReviewsForProduct(productId: string): Promise<Review[]> {
  return mockReviews.filter((review) => review.productId === productId);
}
