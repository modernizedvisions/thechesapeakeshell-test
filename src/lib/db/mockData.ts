import type { GalleryImage, HeroConfig, Order, Product, Review } from '../types';

export const mockProducts: Product[] = [
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

export const mockOrders: Order[] = [
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

export const mockReviews: Review[] = [
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

export const defaultGalleryImages: GalleryImage[] = [
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

export const defaultHomeHeroConfig: HeroConfig = {
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

export const GALLERY_STORAGE_KEY = 'artist-gallery-images';
export const HOME_HERO_STORAGE_KEY = 'home-hero-images'; // reuse existing key for backward compatibility
