import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import {
  fetchProductById,
  fetchRelatedProducts,
  fetchReviewsForProduct,
} from '../lib/api';
import { Product, Review } from '../lib/types';
import { useCartStore } from '../store/cartStore';

export function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const isOneOffInCart = useCartStore((state) => state.isOneOffInCart);

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const relatedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!productId) return;
      setLoadingProduct(true);
      const found = await fetchProductById(productId);
      setProduct(found);
      setLoadingProduct(false);

      if (found) {
        setLoadingRelated(true);
        fetchRelatedProducts(found.type, found.id).then((items) => {
          setRelated(items);
          setLoadingRelated(false);
        });

        setLoadingReviews(true);
        fetchReviewsForProduct(found.id).then((r) => {
          setReviews(r);
          setLoadingReviews(false);
        });
      }
    };
    load();
  }, [productId]);

  const images = useMemo(() => {
    if (!product) return [];
    if (product.imageUrls && product.imageUrls.length > 0) return product.imageUrls;
    return product.imageUrl ? [product.imageUrl] : [];
  }, [product]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [productId]);

  const handlePrev = () => {
    if (!images.length) return;
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (!images.length) return;
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleAddToCart = () => {
    if (!product || !product.priceCents || !product.stripePriceId) return;
    if (product.oneoff && isOneOffInCart(product.stripeProductId)) return;
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

  const formatPrice = (priceCents?: number) =>
    priceCents || priceCents === 0 ? `$${(priceCents / 100).toFixed(2)}` : '';

  if (!loadingProduct && !product) {
    return (
      <div className="py-16 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="text-3xl font-semibold text-gray-900">Product not found</h1>
          <Link to="/shop" className="text-gray-700 underline">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <section className="py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div>
              <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {loadingProduct ? (
                  <div className="w-full h-full animate-pulse bg-gray-200" />
                ) : images.length ? (
                  <>
                    <img
                      src={images[currentIndex]}
                      alt={product?.name || 'Product'}
                      className="w-full h-full object-cover"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={handlePrev}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur rounded-full p-2 shadow hover:bg-white"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleNext}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur rounded-full p-2 shadow hover:bg-white"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto">
                {images.map((url, idx) => (
                  <button
                    key={url}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-20 h-20 rounded-md overflow-hidden border ${
                      idx === currentIndex ? 'border-gray-900' : 'border-gray-200'
                    }`}
                  >
                    <img src={url} alt={`${product?.name}-thumb-${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-gray-900">
                {loadingProduct ? 'Loading...' : product?.name}
              </h1>
              {product?.type && (
                <p className="text-sm uppercase tracking-wide text-gray-500">{product.type}</p>
              )}
              {product?.priceCents && (
                <p className="text-2xl font-bold text-gray-900">{formatPrice(product.priceCents)}</p>
              )}
              {product?.oneoff && (
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                  One-of-a-kind
                </span>
              )}
              <p className="text-gray-700 leading-relaxed">
                {product?.description}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddToCart}
                  disabled={
                    !product ||
                    !product.priceCents ||
                    !product.stripePriceId ||
                    (product.oneoff && isOneOffInCart(product.stripeProductId))
                  }
                  className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(!loadingRelated && related.length > 0) && (
        <section className="py-10 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-900">
                More from this collection
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => relatedRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
                  className="p-2 rounded-full border border-gray-300 bg-white hover:border-gray-400"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => relatedRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
                  className="p-2 rounded-full border border-gray-300 bg-white hover:border-gray-400"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              ref={relatedRef}
              className="flex gap-4 overflow-x-auto pb-2"
            >
              {related.map((item) => (
                <div
                  key={item.id}
                  className="w-64 flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                    {item.priceCents && (
                      <p className="text-sm font-bold text-gray-900">{formatPrice(item.priceCents)}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/product/${item.id}`)}
                        className="flex-1 bg-gray-900 text-white py-2 rounded-md text-sm hover:bg-gray-800 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          if (!item.priceCents || !item.stripePriceId) return;
                          if (item.oneoff && isOneOffInCart(item.stripeProductId)) return;
                          addItem({
                            stripeProductId: item.stripeProductId,
                            stripePriceId: item.stripePriceId,
                            name: item.name,
                            priceCents: item.priceCents,
                            quantity: 1,
                            imageUrl: item.thumbnailUrl || item.imageUrl,
                            oneoff: item.oneoff,
                          });
                        }}
                        disabled={
                          !item.priceCents ||
                          !item.stripePriceId ||
                          (item.oneoff && isOneOffInCart(item.stripeProductId))
                        }
                        className="flex-1 flex items-center justify-center bg-white border border-gray-300 text-gray-700 py-2 rounded-md hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Reviews</h2>
            <button
              onClick={() => console.info('TODO: open write review form')}
              className="text-sm text-gray-700 underline"
            >
              Write a Review
            </button>
          </div>
          {loadingReviews ? (
            <p className="text-gray-500">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="text-gray-500">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 border border-gray-200 rounded-lg bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-gray-900">{review.author}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-yellow-500 text-sm mb-2">
                    {'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}
                  </div>
                  <p className="text-gray-700">{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
