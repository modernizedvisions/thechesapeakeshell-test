import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BannerMessage } from '../components/BannerMessage';
import { createEmbeddedCheckoutSession, validateCart } from '../lib/api';
import { useCartStore } from '../store/cartStore';
import { useUIStore } from '../store/uiStore';

export function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const setOpenCartOnLoad = useUIStore((state) => state.setOpenCartOnLoad);
  const navigate = useNavigate();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [reservedUntil, setReservedUntil] = useState<Date | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [unavailableItems, setUnavailableItems] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [availableItems, setAvailableItems] = useState(items);

  useEffect(() => {
    if (hasValidated) return;
    setHasValidated(true);

    const runValidation = async () => {
      if (items.length === 0) {
        setIsValidating(false);
        return;
      }

      const result = await validateCart(items);

      if (result.unavailableItems.length > 0) {
        setUnavailableItems(result.unavailableItems.map((item) => item.name));
        result.unavailableItems.forEach((item) => removeItem(item.stripeProductId));
      }

      const remainingItems = items.filter((item) =>
        result.availableItems.some((available) => available.stripeProductId === item.stripeProductId)
      );

      setAvailableItems(remainingItems);

      if (remainingItems.length === 0) {
        setIsValidating(false);
        return;
      }

      const session = await createEmbeddedCheckoutSession(remainingItems);
      const expiresAt = new Date(session.reservedUntil);
      setClientSecret(session.stripeClientSecret);
      setReservedUntil(expiresAt);
      setTimeRemaining(expiresAt.getTime() - Date.now());
      setIsValidating(false);
    };

    runValidation();
  }, [hasValidated, items, removeItem]);

  useEffect(() => {
    if (!reservedUntil) return;

    const timer = setInterval(() => {
      const diff = reservedUntil.getTime() - Date.now();
      if (diff <= 0) {
        setIsExpired(true);
        setClientSecret(null);
        setTimeRemaining(0);
        clearInterval(timer);
      } else {
        setTimeRemaining(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [reservedUntil]);

  const handleBackToHome = () => {
    setOpenCartOnLoad(true);
    navigate('/');
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const unavailableMessage = useMemo(() => {
    if (unavailableItems.length === 0) return null;
    return `Sorry, some items were already sold and were removed from your cart: ${unavailableItems.join(', ')}`;
  }, [unavailableItems]);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Validating your cart...</p>
      </div>
    );
  }

  if (availableItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          {unavailableMessage && (
            <BannerMessage message={unavailableMessage} type="warning" />
          )}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            All items in your cart have been sold.
          </h2>
          <p className="text-gray-600 mb-6">
            Please explore the collection and add new items to continue.
          </p>
          <button
            onClick={handleBackToHome}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Checkout Session Expired
          </h2>
          <p className="text-gray-600 mb-6">
            Your cart is still saved.
          </p>
          <button
            onClick={handleBackToHome}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Checkout</h1>

        {unavailableMessage && (
          <BannerMessage message={unavailableMessage} type="warning" />
        )}

        {reservedUntil && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Time remaining: <span className="font-bold">{formatTime(timeRemaining)}</span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Your items are reserved for 10 minutes
            </p>
          </div>
        )}

        {clientSecret && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-dashed border-gray-200">
            <p className="font-semibold text-gray-900 mb-2">Embedded Checkout Placeholder</p>
            <p className="text-sm text-gray-600">
              clientSecret: <span className="font-mono break-all">{clientSecret}</span>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              In production, this mounts Stripe Embedded Checkout via a Cloudflare Worker session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
