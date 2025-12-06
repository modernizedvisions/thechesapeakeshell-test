import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe, type EmbeddedCheckout } from '@stripe/stripe-js';
import { BannerMessage } from '../components/BannerMessage';
import { createEmbeddedCheckoutSession, fetchProductById } from '../lib/api';
import type { Product } from '../lib/types';
import { useCartStore } from '../store/cartStore';

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cartItems = useCartStore((state) => state.items);
  const stripeContainerRef = useRef<HTMLDivElement | null>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMountingStripe, setIsMountingStripe] = useState(false);
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

  const productIdFromUrl = searchParams.get('productId');
  const fallbackCartProduct = cartItems[0]?.productId;
  const targetProductId = useMemo(() => productIdFromUrl || fallbackCartProduct || null, [productIdFromUrl, fallbackCartProduct]);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (!targetProductId) {
        setError('No product selected for checkout.');
        setLoading(false);
        return;
      }

      if (!publishableKey) {
        console.error('VITE_STRIPE_PUBLISHABLE_KEY is missing on the client');
        setError('Stripe is not configured');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('checkout: targetProductId', targetProductId);
        const found = await fetchProductById(targetProductId);
        console.log('checkout: fetched product', found);

        if (!found) {
          throw new Error('Product not found.');
        }
        if (found.isSold) {
          throw new Error('This piece has already been sold.');
        }
        if (!found.priceCents) {
          throw new Error('This product is missing pricing details.');
        }
        if (!found.stripePriceId) {
          throw new Error('This product has no Stripe price configured.');
        }

        if (isCancelled) return;
        setProduct(found);

        const session = await createEmbeddedCheckoutSession(found.id, 1);
        console.log('checkout: session response', session);
        if (isCancelled) return;
        setClientSecret(session.clientSecret);
      } catch (err) {
        if (isCancelled) return;
        const message = err instanceof Error ? err.message : 'Unable to start checkout.';
        setError(message);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    load();
    return () => {
      isCancelled = true;
    };
  }, [targetProductId]);

  useEffect(() => {
    if (!clientSecret) return;
    if (!publishableKey) return;

    let checkout: EmbeddedCheckout | null = null;
    let isCancelled = false;

    const mount = async () => {
      try {
        setIsMountingStripe(true);
        const stripe = await loadStripe(publishableKey);
        if (!stripe) throw new Error('Failed to load Stripe.');

        if (isCancelled) return;

        checkout = await stripe.initEmbeddedCheckout({ clientSecret });
        checkout.mount('#embedded-checkout');
      } catch (err) {
        if (isCancelled) return;
        const message = err instanceof Error ? err.message : 'Unable to load checkout.';
        setError(message);
      } finally {
        if (!isCancelled) setIsMountingStripe(false);
      }
    };

    mount();
    return () => {
      isCancelled = true;
      checkout?.destroy();
    };
  }, [clientSecret]);

  const priceDisplay = useMemo(() => {
    if (!product?.priceCents) return '';
    return `$${(product.priceCents / 100).toFixed(2)}`;
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-600">Preparing your checkout...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Chesapeake Shell</p>
            <h1 className="text-3xl font-bold text-gray-900">Secure Checkout</h1>
            <p className="text-gray-600 mt-1">Complete your purchase safely and securely.</p>
          </div>
          <button
            onClick={() => navigate('/shop')}
            className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium hover:border-gray-400 transition-colors"
          >
            Back to Shop
          </button>
        </div>

        {error && <BannerMessage message={error} type="error" />}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {product?.thumbnailUrl || product?.imageUrl ? (
                  <img
                    src={product.thumbnailUrl || product.imageUrl}
                    alt={product?.name || 'Product'}
                    className="w-16 h-16 rounded-md object-cover bg-gray-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-gray-100" />
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{product?.collection || product?.type || 'Artwork'}</p>
                  <h2 className="text-base font-semibold text-gray-900">{product?.name || 'Loading...'}</h2>
                  {product?.priceCents != null && (
                    <p className="text-sm font-semibold text-gray-900">{priceDisplay}</p>
                  )}
                </div>
              </div>
              {product?.oneoff && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                  One-of-a-kind
                </span>
              )}
              {product?.description && (
                <p className="text-xs text-gray-600 leading-snug line-clamp-3">{product.description}</p>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
                {isMountingStripe && <p className="text-sm text-gray-500">Loading Stripe…</p>}
              </div>
              <div
                id="embedded-checkout"
                ref={stripeContainerRef}
                className="rounded-lg border border-dashed border-gray-200 min-h-[360px]"
              />
              <p className="text-xs text-gray-500">
                Secure payment is handled by Stripe. You’ll receive a confirmation as soon as the purchase completes.
              </p>
            </div>
          </div>
        </div>

        {!product && !error && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center mt-6">
            <p className="text-gray-700">Select a product to begin checkout.</p>
            <Link to="/shop" className="text-gray-900 font-semibold underline">
              Back to Shop
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
