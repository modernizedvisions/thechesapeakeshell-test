import { useNavigate } from 'react-router-dom';
import { Product } from '../lib/types';
import { useCartStore } from '../store/cartStore';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isOneOffInCart = useCartStore((state) => state.isOneOffInCart);
  const navigate = useNavigate();

  const isDisabled = product.oneoff && isOneOffInCart(product.stripeProductId);

  const handleAddToCart = () => {
    if (isDisabled || !product.priceCents || !product.stripePriceId) return;

    addItem({
      stripeProductId: product.stripeProductId,
      stripePriceId: product.stripePriceId,
      name: product.name,
      priceCents: product.priceCents,
      quantity: 1,
      imageUrl: product.thumbnailUrl || product.imageUrl,
      oneoff: product.oneoff,
    });
  };

  return (
    <div className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-square overflow-hidden bg-gray-100">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
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
        {product.oneoff && (
          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded mb-2">
            One-of-a-kind
          </span>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/product/${product.id}`)}
            className="flex-1 bg-white border border-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium hover:border-gray-400 transition-colors"
          >
            View
          </button>
          <button
            onClick={handleAddToCart}
            disabled={isDisabled || !product.priceCents || !product.stripePriceId}
            className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDisabled ? 'Already in Cart' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
