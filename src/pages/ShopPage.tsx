import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchProducts } from '../lib/api';
import { Product } from '../lib/types';
import { ProductGrid } from '../components/ProductGrid';

const normalizeType = (value: string) => value.toLowerCase().replace(/\s+/g, '-');

export function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const classifications = ['Ring Dish', 'Wine Stopper', 'Decor', 'Ornaments'] as const;
  const [activeClass, setActiveClass] = useState<'All' | typeof classifications[number]>('All');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam) {
      const normalized = normalizeType(typeParam);
      const match = classifications.find((c) => normalizeType(c) === normalized);
      if (match) {
        setActiveClass(match);
      }
    }
  }, [searchParams]);

  const loadProducts = async () => {
    try {
      const allProducts = await fetchProducts({ visible: true });
      setProducts(allProducts.filter((p) => !p.isSold));
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    classifications.forEach((c) => {
      groups[c] = products.filter((p) => p.type === c);
    });
    return groups;
  }, [classifications, products]);

  const orderedSections = useMemo(() => {
    if (activeClass === 'All') return classifications;
    return [activeClass, ...classifications.filter((c) => c !== activeClass)];
  }, [activeClass, classifications]);

  return (
    <div className="py-12 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Shop</h1>

        <div className="flex flex-wrap gap-3 mb-10">
          {(['All', ...classifications] as const).map((label) => {
            const isActive = activeClass === label;
            return (
              <button
                key={label}
                onClick={() => {
                  setActiveClass(label);
                  if (label === 'All') {
                    searchParams.delete('type');
                    setSearchParams(searchParams, { replace: true });
                  } else {
                    searchParams.set('type', normalizeType(label));
                    setSearchParams(searchParams, { replace: true });
                  }
                }}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading products...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {orderedSections.map((classification) => {
              const items = groupedProducts[classification] || [];
              if (items.length === 0) return null;

              return (
                <section key={classification}>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">{classification}</h2>
                  <ProductGrid products={items} />
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
