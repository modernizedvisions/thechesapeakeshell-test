import { useEffect, useState } from 'react';
import { fetchGalleryImages, fetchSoldProducts } from '../lib/api';
import { GalleryImage, Product } from '../lib/types';

export function GalleryPage() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [soldProducts, setSoldProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [gallery, sold] = await Promise.all([fetchGalleryImages(), fetchSoldProducts()]);
      setGalleryImages(gallery.filter((img) => !img.hidden));
      setSoldProducts(sold);
    } catch (error) {
      console.error('Error loading gallery data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-12 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-center text-3xl md:text-4xl font-semibold uppercase tracking-wide text-slate-900 mb-2">
          Gallery
        </h1>
        <p className="text-center text-slate-600 text-sm md:text-base mb-10">
          Explore our collection of art pieces and sold works.
        </p>
        <div className="mt-8"></div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading gallery...</p>
          </div>
        ) : (
          <>
            <section className="mb-12">
              {galleryImages.length === 0 ? (
                <div className="text-gray-500">No images yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {galleryImages.map((item) => (
                    <div key={item.id} className="relative group cursor-pointer">
                      <div
                        className="aspect-square overflow-hidden rounded-lg bg-gray-100"
                        onClick={() => setSelectedImage(item.imageUrl)}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.title || 'Gallery item'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      {item.title && (
                        <div className="mt-2">
                          <h3 className="font-medium text-gray-900">{item.title}</h3>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sold Products</h2>
              {soldProducts.length === 0 ? (
                <div className="text-gray-500">No sold products yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {soldProducts.map((item) => (
                    <div key={item.id} className="relative group cursor-pointer">
                      <div
                        className="aspect-square overflow-hidden rounded-lg bg-gray-100"
                        onClick={() => setSelectedImage(item.imageUrl)}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No image
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <span className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold">
                            SOLD
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <h3 className="font-medium text-gray-900">{item.name}</h3>
                        {item.collection && (
                          <p className="text-sm text-gray-600">{item.collection}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Gallery item"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
