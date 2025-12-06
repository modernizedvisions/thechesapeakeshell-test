import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BannerMessage } from '../components/BannerMessage';
import { fetchCheckoutSession } from '../lib/api';

type SessionStatus = 'loading' | 'success' | 'pending' | 'failed';

export function CheckoutReturnPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (!sessionId) {
        setError('Missing checkout session.');
        setStatus('failed');
        return;
      }

      try {
        const session = await fetchCheckoutSession(sessionId);
        if (isCancelled) return;

        if (session?.metadata?.product_id) {
          setProductId(session.metadata.product_id);
        }

        const paymentStatus = session?.paymentStatus || session?.status;
        if (paymentStatus === 'paid' || paymentStatus === 'complete') {
          setStatus('success');
        } else if (paymentStatus === 'processing' || paymentStatus === 'open') {
          setStatus('pending');
        } else {
          setStatus('failed');
        }
      } catch (err) {
        if (isCancelled) return;
        const message = err instanceof Error ? err.message : 'Unable to verify your payment.';
        setError(message);
        setStatus('failed');
      }
    };

    load();
    return () => {
      isCancelled = true;
    };
  }, [sessionId]);

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="text-center text-gray-600">Confirming your payment...</div>
      );
    }

    if (status === 'success') {
      return (
        <>
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">Thank you!</h1>
          <p className="text-gray-600 text-center mb-6">
            Your payment was successful. We&apos;ll prepare your piece for delivery.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/shop"
              className="bg-gray-900 text-white px-5 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Continue Shopping
            </Link>
            {productId && (
              <Link
                to={`/product/${productId}`}
                className="bg-white border border-gray-300 text-gray-800 px-5 py-3 rounded-lg font-medium hover:border-gray-400 transition-colors"
              >
                View Product
              </Link>
            )}
          </div>
        </>
      );
    }

    if (status === 'pending') {
      return (
        <>
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">Payment Processing</h1>
          <p className="text-gray-600 text-center mb-6">
            We&apos;re finalizing your payment. You can safely close this tab; we&apos;ll email you once it completes.
          </p>
          <div className="flex justify-center">
            <Link
              to="/shop"
              className="bg-gray-900 text-white px-5 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Back to Shop
            </Link>
          </div>
        </>
      );
    }

    return (
      <>
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">Payment Failed</h1>
        <p className="text-gray-600 text-center mb-6">
          We couldn&apos;t confirm your payment. Please try again or use a different card.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to={productId ? `/checkout?productId=${productId}` : '/shop'}
            className="bg-gray-900 text-white px-5 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Retry Checkout
          </Link>
          <Link
            to="/shop"
            className="bg-white border border-gray-300 text-gray-800 px-5 py-3 rounded-lg font-medium hover:border-gray-400 transition-colors"
          >
            Back to Shop
          </Link>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {error && <BannerMessage message={error} type="error" />}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
