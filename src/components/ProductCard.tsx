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
    if (isDisabled || !product.priceCents || !product.stripePriceId || isSold) return;

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

  return (
    <div className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-square overflow-hidden bg-gray-100">
        {product.imageUrl || product.imageUrls?.[0] ? (
          <img
            src={product.imageUrl || product.imageUrls?.[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No image
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-gray-900 mb-1">{product.name}</h3>
        {product.priceCents && (
          <p className="text-lg font-bold text-gray-900 mb-2">
            ${(product.priceCents / 100).toFixed(2)}
          </p>
        )}
        <div className="flex flex-wrap gap-2 mb-2">
          {product.oneoff && (
            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
              One-of-a-kind
            </span>
          )}
          {isSold && (
            <span className="inline-block px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
              Sold
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/product/${product.id}`)}
            className="flex-1 bg-white border border-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium hover:border-gray-400 transition-colors"
          >
            View
          </button>
          <button
            onClick={() => navigate(`/checkout?productId=${product.id}`)}
            disabled={!isPurchaseReady}
            className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSold ? 'Sold' : 'Buy Now'}
          </button>
        </div>
        {!isSold && (
          <button
            onClick={handleAddToCart}
            disabled={isDisabled || !isPurchaseReady}
            className="mt-2 w-full bg-white border border-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDisabled ? 'Already in Cart' : 'Add to Cart'}
          </button>
        )}
      </div>
    </div>
  );
}
