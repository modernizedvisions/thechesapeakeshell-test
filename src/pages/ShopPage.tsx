import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchCategories, fetchProducts } from '../lib/api';
import { Category, Product } from '../lib/types';
import { ProductGrid } from '../components/ProductGrid';

const BASE_CATEGORY_ORDER: Category[] = [
  { id: 'ornaments', name: 'Ornaments', slug: 'ornaments', showOnHomePage: true },
  { id: 'ring-dish', name: 'Ring Dishes', slug: 'ring-dish', showOnHomePage: true },
  { id: 'decor', name: 'Decor', slug: 'decor', showOnHomePage: true },
  { id: 'wine-stopper', name: 'Wine Stoppers', slug: 'wine-stopper', showOnHomePage: true },
];

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const orderCategorySummaries = (items: Category[]): Category[] => {
  const normalize = (value: string) => toSlug(value);
  const used = new Set<string>();
  const ordered: Category[] = [];

  BASE_CATEGORY_ORDER.forEach((base) => {
    const match = items.find(
      (item) => normalize(item.slug) === normalize(base.slug) || normalize(item.name) === normalize(base.name)
    );
    if (match) {
      const key = normalize(match.slug);
      if (!used.has(key)) {
        ordered.push(match);
        used.add(key);
      }
    }
  });

  const remaining = items
    .filter((item) => !used.has(normalize(item.slug)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...ordered, ...remaining];
};

const deriveCategoriesFromProducts = (items: Product[]): Category[] => {
  const names = new Map<string, string>();
  const addName = (name?: string | null) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const slug = toSlug(trimmed);
    if (!names.has(slug)) names.set(slug, trimmed);
  };

  items.forEach((product) => {
    addName(product.type);
    addName((product as any).category);
    if (Array.isArray(product.categories)) {
      product.categories.forEach((c) => addName(c));
    }
    if (Array.isArray((product as any).categories)) {
      (product as any).categories.forEach((c: unknown) => {
        if (typeof c === 'string') addName(c);
      });
    }
  });

  const derived = Array.from(names.entries()).map(
    ([slug, name]): Category => ({ id: slug, slug, name, showOnHomePage: true })
  );
  return orderCategorySummaries(derived);
};

const getProductCategoryNames = (product: Product): string[] => {
  const names = new Set<string>();
  const addName = (name?: string | null) => {
    const trimmed = (name || '').trim();
    if (trimmed) names.add(trimmed);
  };

  addName(product.type);
  addName((product as any).category);
  if (Array.isArray(product.categories)) {
    product.categories.forEach((c) => addName(c));
  }
  if (Array.isArray((product as any).categories)) {
    (product as any).categories.forEach((c: unknown) => {
      if (typeof c === 'string') addName(c);
    });
  }

  return Array.from(names);
};

const resolveCategorySlugForProduct = (
  product: Product,
  categoryList: Category[],
  fallbackSlug?: string
): string | null => {
  const lookup = new Map(categoryList.map((c) => [toSlug(c.slug), c.slug]));
  const candidateNames = getProductCategoryNames(product);

  for (const name of candidateNames) {
    const normalized = toSlug(name);
    const match = lookup.get(normalized);
    if (match) return match;
  }

  if (fallbackSlug) return fallbackSlug;
  if (candidateNames.length) return toSlug(candidateNames[0]);
  return null;
};

const CATEGORY_COPY: Record<string, { title: string; description: string }> = {
  ornaments: {
    title: 'ORNAMENTS',
    description: 'Hand-crafted coastal keepsakes for every season.',
  },
  'ring dishes': {
    title: 'RING DISHES',
    description: 'Functional coastal art designed for your jewelry & keepsakes.',
  },
  decor: {
    title: 'DECOR',
    description: 'Coastal artistry to brighten your space with shoreline charm.',
  },
  'wine stoppers': {
    title: 'WINE STOPPERS',
    description: 'Hand-crafted shell stoppers for your favorite bottles.',
  },
};

export function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryList = useMemo(
    () => (categories.length ? categories : deriveCategoriesFromProducts(products)),
    [categories, products]
  );

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam) {
      const normalized = toSlug(typeParam);
      const match = categoryList.find(
        (c) => toSlug(c.slug) === normalized || toSlug(c.name) === normalized
      );
      if (match) {
        setActiveCategorySlug(match.slug);
        return;
      }
    }
    setActiveCategorySlug('all');
  }, [searchParams, categoryList]);

  const loadProducts = async () => {
    try {
      const allProducts = await fetchProducts({ visible: true });
      const availableProducts = (allProducts || []).filter((p) => !p.isSold);
      setProducts(availableProducts);

      let apiCategories: Category[] = [];
      try {
        apiCategories = await fetchCategories();
      } catch (categoryError) {
        console.error('Error loading categories:', categoryError);
      }

      const derivedCategories = deriveCategoriesFromProducts(availableProducts);
      const orderedCategories = apiCategories.length
        ? orderCategorySummaries(apiCategories)
        : derivedCategories;
      setCategories(orderedCategories);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    if (!categoryList.length) return groups;

    categoryList.forEach((c) => {
      groups[c.slug] = [];
    });

    const fallbackSlug = categoryList[0]?.slug;

    products.forEach((product) => {
      const slug = resolveCategorySlugForProduct(product, categoryList, fallbackSlug);
      const key = slug || fallbackSlug;
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(product);
    });

    return groups;
  }, [categoryList, products]);

  const orderedSections = useMemo(() => {
    if (activeCategorySlug === 'all') return categoryList;
    const active = categoryList.find((c) => c.slug === activeCategorySlug);
    if (!active) return categoryList;
    return [active, ...categoryList.filter((c) => c.slug !== activeCategorySlug)];
  }, [activeCategorySlug, categoryList]);

  return (
    <div className="py-12 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mt-10 mb-6">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-wide text-gray-900">
            THE COLLECTION
          </h1>
          <p className="text-gray-600 text-lg mt-2">
            One-of-a-kind shell art, crafted with care on the Chesapeake Bay.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          {['all', ...categoryList.map((c) => c.slug)].map((slug) => {
            const isAll = slug === 'all';
            const label = isAll
              ? 'All'
              : categoryList.find((c) => c.slug === slug)?.name || slug;
            const isActive = activeCategorySlug === slug;
            return (
              <button
                key={slug}
                onClick={() => {
                  setActiveCategorySlug(slug);
                  if (isAll) {
                    searchParams.delete('type');
                    setSearchParams(searchParams, { replace: true });
                  } else {
                    searchParams.set('type', slug);
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
            {orderedSections.map((category) => {
              const items = groupedProducts[category.slug] || [];
              if (items.length === 0) return null;

              const copyKey = category.slug.toLowerCase();
              const copy =
                CATEGORY_COPY[copyKey] ||
                CATEGORY_COPY[(category.name || '').toLowerCase()] ||
                null;

              return (
                <section key={category.slug} className="mb-10">
                  <div className="text-center mb-4">
                    <h2 className="text-3xl font-semibold tracking-wide text-gray-900">
                      {copy?.title || category.name}
                    </h2>
                    {copy?.description && (
                      <p className="mt-1 text-sm text-slate-600">{copy.description}</p>
                    )}
                  </div>
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
