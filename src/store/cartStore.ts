import { create } from 'zustand';
import { CartItem } from '../lib/types';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (stripeProductId: string) => void;
  updateQuantity: (stripeProductId: string, quantity: number) => void;
  clearCart: () => void;
  isOneOffInCart: (stripeProductId: string) => boolean;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

const CART_STORAGE_KEY = 'artist-cart';

const loadCartFromStorage = (): CartItem[] => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading cart from storage:', error);
    return [];
  }
};

const saveCartToStorage = (items: CartItem[]) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: loadCartFromStorage(),

  addItem: (item: CartItem) => {
    set((state) => {
      if (item.oneoff && state.items.some(i => i.stripeProductId === item.stripeProductId)) {
        return state;
      }

      const existingIndex = state.items.findIndex(
        i => i.stripeProductId === item.stripeProductId
      );

      let newItems: CartItem[];

      if (existingIndex >= 0) {
        newItems = [...state.items];
        if (!item.oneoff) {
          newItems[existingIndex] = {
            ...newItems[existingIndex],
            quantity: newItems[existingIndex].quantity + item.quantity,
          };
        }
      } else {
        newItems = [...state.items, item];
      }

      saveCartToStorage(newItems);
      return { items: newItems };
    });
  },

  removeItem: (stripeProductId: string) => {
    set((state) => {
      const newItems = state.items.filter(i => i.stripeProductId !== stripeProductId);
      saveCartToStorage(newItems);
      return { items: newItems };
    });
  },

  updateQuantity: (stripeProductId: string, quantity: number) => {
    set((state) => {
      const item = state.items.find(i => i.stripeProductId === stripeProductId);

      if (item?.oneoff) {
        return state;
      }

      if (quantity <= 0) {
        const newItems = state.items.filter(i => i.stripeProductId !== stripeProductId);
        saveCartToStorage(newItems);
        return { items: newItems };
      }

      const newItems = state.items.map(i =>
        i.stripeProductId === stripeProductId
          ? { ...i, quantity }
          : i
      );

      saveCartToStorage(newItems);
      return { items: newItems };
    });
  },

  clearCart: () => {
    saveCartToStorage([]);
    set({ items: [] });
  },

  isOneOffInCart: (stripeProductId: string) => {
    const items = get().items;
    return items.some(item => item.stripeProductId === stripeProductId && item.oneoff);
  },

  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },

  getSubtotal: () => {
    return get().items.reduce((total, item) => total + (item.priceCents * item.quantity), 0);
  },
}));
