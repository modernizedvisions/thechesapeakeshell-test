import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchHomeHeroConfig, fetchProducts } from '../lib/api';
import { GalleryImage, HeroConfig, Product } from '../lib/types';
import { useCartStore } from '../store/cartStore';
import { SocialSection } from '../components/SocialSection';
import { ContactForm } from '../components/ContactForm';
import HeroShowcase from '../components/HeroShowcase';
import HeroGalleryStrip from '../components/HeroGalleryStrip';
import HomeCategoryCard from '../components/HomeCategoryCard';

const normalizeType = (value: string) => value.toLowerCase().replace(/\s+/g, '-');

const CATEGORY_CONFIG = [
  { label: 'Ornaments', type: 'Ornaments', cta: 'All Ornaments ->', query: normalizeType('Ornaments') },
  { label: 'Jewelry Dishes', type: 'Ring Dish', cta: 'All Jewelry Dishes ->', query: normalizeType('Ring Dish') },
  { label: 'Decor', type: 'Decor', cta: 'All Decor ->', query: normalizeType('Decor') },
  { label: 'Wine Stoppers', type: 'Wine Stopper', cta: 'All Wine Stoppers ->', query: normalizeType('Wine Stopper') },
] as const;

export function HomePage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [heroConfig, setHeroConfig] = useState<HeroConfig>({ mainImage: null, gridImages: [] });
  const [isLoadingHero, setIsLoadingHero] = useState(true);

  const addItem = useCartStore((state) => state.addItem);
  const isOneOffInCart = useCartStore((state) => state.isOneOffInCart);
  const navigate = useNavigate();

  useEffect(() => {
    loadAllProducts();
    loadHeroImages();
  }, []);

  const loadAllProducts = async () => {
    try {
      const products = await fetchProducts({ visible: true });
      setAllProducts(products.filter((p) => !p.isSold));
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHeroImages = async () => {
    try {
      const config = await fetchHomeHeroConfig();
      setHeroConfig({
        mainImage: config.mainImage || null,
        gridImages: (config.gridImages || []).slice(0, 6),
      });
    } catch (error) {
      console.error('Error loading hero images:', error);
    } finally {
      setIsLoadingHero(false);
    }
  };

  const categoryCards = useMemo(() => {
    return CATEGORY_CONFIG
      .map((category) => ({
        ...category,
        product: allProducts.find((p) => p.type === category.type),
      }))
      .filter((item) => item.product) as Array<
        (typeof CATEGORY_CONFIG)[number] & { product: Product }
      >;
  }, [allProducts]);

  const handleAddToCart = (product: Product) => {
    if (!product.priceCents || !product.stripePriceId) return;
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

  const formatPrice = (priceCents?: number) => {
    if (!priceCents && priceCents !== 0) return '';
    return `$${(priceCents / 100).toFixed(2)}`;
  };

  return (
    <div className="bg-white">
      <HeroShowcase image={heroConfig.mainImage} isLoading={isLoadingHero} />

      <HeroGalleryStrip images={heroConfig.gridImages} isLoading={isLoadingHero} />

      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-serif font-semibold text-gray-900 mb-8 text-center">
            Shop by Category
          </h2>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 font-sans">Loading products...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {categoryCards.map((cat) => (
                <HomeCategoryCard
                  key={cat.type}
                  product={cat.product}
                  label={cat.label}
                  ctaLabel={cat.cta}
                  onView={() => navigate(`/product/${cat.product.id}`)}
                  onAddToCart={() => handleAddToCart(cat.product)}
                  onNavigate={() => navigate(`/shop?type=${encodeURIComponent(cat.query)}`)}
                  isCartDisabled={
                    !cat.product.priceCents ||
                    !cat.product.stripePriceId ||
                    (cat.product.oneoff && isOneOffInCart(cat.product.stripeProductId))
                  }
                  priceLabel={formatPrice(cat.product.priceCents)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <SocialSection />

      <ContactForm />
    </div>
  );
}
