import { ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../lib/types';
import { useCartStore } from '../store/cartStore';
import { useUIStore } from '../store/uiStore';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isOneOffInCart = useCartStore((state) => state.isOneOffInCart);
  const setCartDrawerOpen = useUIStore((state) => state.setCartDrawerOpen);
  const navigate = useNavigate();

  const isDisabled = product.oneoff && isOneOffInCart(product.id);
  const isSold = product.isSold || (product.quantityAvailable !== undefined && product.quantityAvailable <= 0);
  const isPurchaseReady = !!product.priceCents && !isSold;

  const handleAddToCart = () => {
    if (!product.priceCents || isSold) return;
    if (product.oneoff && isOneOffInCart(product.id)) return;

    addItem({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      quantity: 1,
      imageUrl: product.thumbnailUrl || product.imageUrl,
      oneoff: product.oneoff,
      stripeProductId: product.stripeProductId ?? null,
      stripePriceId: product.stripePriceId ?? null,
    });
    setCartDrawerOpen(true);
  };

  const priceLabel = product.priceCents ? `$${(product.priceCents / 100).toFixed(2)}` : '';

  return (
    <div className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-square overflow-hidden bg-gray-100">
        {product.imageUrl || product.imageUrls?.[0] ? (
          <img
            src={product.imageUrl || product.imageUrls?.[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No image
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-medium text-slate-900 truncate">{product.name}</h3>
          <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">{priceLabel}</span>
        </div>

        {isSold && (
          <div className="mb-2">
            <span className="inline-block px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
              Sold
            </span>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-0">
          <button
            onClick={() => navigate(`/product/${product.id}`)}
            className="w-full bg-white border border-gray-300 text-gray-800 py-2 px-4 rounded-l-lg font-medium hover:border-gray-400 transition-colors"
          >
            View
          </button>
          <button
            onClick={handleAddToCart}
            disabled={isDisabled || !isPurchaseReady}
            className="inline-flex items-center justify-center bg-white border border-gray-300 py-2 px-4 rounded-r-lg font-medium hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add to Cart"
          >
            <ShoppingCart className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
