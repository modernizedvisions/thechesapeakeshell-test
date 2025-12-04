import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Eye, EyeOff, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import {
  fetchGalleryImages,
  fetchHomeHeroConfig,
  fetchOrders,
  fetchSoldProducts,
  saveGalleryImages,
  saveHomeHeroConfig,
  verifyAdminPassword,
} from '../lib/api';
import { GalleryImage, HeroConfig, HeroImage, Order, Product } from '../lib/types';

export function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [soldProducts, setSoldProducts] = useState<Product[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [heroConfig, setHeroConfig] = useState<HeroConfig>({ mainImage: null, gridImages: [] });
  const [activeTab, setActiveTab] = useState<'orders' | 'sold' | 'gallery' | 'home'>('orders');
  const [gallerySaveState, setGallerySaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [homeSaveState, setHomeSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const heroGridFileInputRef = useRef<HTMLInputElement | null>(null);
  const heroMainFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSaveHeroConfig = async () => {
    setHomeSaveState('saving');
    try {
      const configToSave: HeroConfig = {
        mainImage: heroConfig.mainImage || null,
        gridImages: (heroConfig.gridImages || []).slice(0, 6),
      };
      await saveHomeHeroConfig(configToSave);
      setHomeSaveState('success');
      setTimeout(() => setHomeSaveState('idle'), 1500);
    } catch (err) {
      console.error('Failed to save home hero images', err);
      setHomeSaveState('idle');
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
      loadAdminData();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await verifyAdminPassword(password);
      if (result) {
        sessionStorage.setItem('admin_token', 'demo_token');
        setIsAuthenticated(true);
        loadAdminData();
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Error verifying password');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminData = async () => {
    const [ordersData, soldData, galleryData, heroData] = await Promise.all([
      fetchOrders(),
      fetchSoldProducts(),
      fetchGalleryImages(),
      fetchHomeHeroConfig(),
    ]);
    setOrders(ordersData);
    setSoldProducts(soldData);
    setGalleryImages(galleryData);
    setHeroConfig({
      mainImage: heroData.mainImage || null,
      gridImages: (heroData.gridImages || []).slice(0, 6),
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setPassword('');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Admin Login
          </h2>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                required
              />
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'orders'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab('sold')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'sold'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sold Products
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'gallery'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Gallery
            </button>
            <button
              onClick={() => setActiveTab('home')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'home'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Home Page
            </button>
          </nav>
        </div>

        {activeTab === 'orders' && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No orders yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>{order.customer?.name}</div>
                          <div className="text-gray-500">{order.customer?.email}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {order.items?.length || 0} items
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${(order.totalCents / 100).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sold' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {soldProducts.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-12">
                No sold products yet
              </div>
            ) : (
              soldProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg overflow-hidden shadow-sm">
                  <div className="aspect-square bg-gray-100">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 mb-1">{product.name}</h3>
                    <p className="text-sm text-gray-500">
                      {product.soldAt
                        ? `Sold on ${new Date(product.soldAt).toLocaleDateString()}`
                        : 'Sold'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'gallery' && (
          <GalleryAdmin
            images={galleryImages}
            onChange={setGalleryImages}
            onSave={async () => {
              setGallerySaveState('saving');
              try {
                await saveGalleryImages(galleryImages);
                setGallerySaveState('success');
                setTimeout(() => setGallerySaveState('idle'), 1500);
              } catch (err) {
                console.error('Failed to save gallery images', err);
                setGallerySaveState('idle');
              }
            }}
            saveState={gallerySaveState}
            fileInputRef={fileInputRef}
            title="Gallery Management"
            description="Add, hide, or remove manual gallery images."
          />
        )}

        {activeTab === 'home' && (
          <div className="space-y-6">
            <MainHeroAdmin
              image={heroConfig.mainImage || null}
              onChange={(img) => setHeroConfig((prev) => ({ ...prev, mainImage: img }))}
              fileInputRef={heroMainFileInputRef}
              onSave={handleSaveHeroConfig}
              saveState={homeSaveState}
            />

            <GalleryAdmin
              images={heroConfig.gridImages}
              onChange={(imgs) => setHeroConfig((prev) => ({ ...prev, gridImages: imgs }))}
              onSave={handleSaveHeroConfig}
              saveState={homeSaveState}
              fileInputRef={heroGridFileInputRef}
              title="Hero Grid Images"
              description="Up to 6 images shown under the main hero."
              maxImages={6}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface MainHeroAdminProps {
  image: HeroImage | null;
  onChange: (image: HeroImage | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onSave: () => Promise<void>;
  saveState: 'idle' | 'saving' | 'success';
}

function MainHeroAdmin({ image, onChange, fileInputRef, onSave, saveState }: MainHeroAdminProps) {
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onChange({
        id: crypto.randomUUID(),
        imageUrl: dataUrl,
        hidden: false,
        createdAt: new Date().toISOString(),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Main Hero Image</h2>
          <p className="text-sm text-gray-600">Shown as the large image at the top of the hero.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={onSave}
            disabled={saveState === 'saving'}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saveState === 'saving' ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-200" />
                <span>Saving...</span>
              </span>
            ) : saveState === 'success' ? (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-200" />
                <span>Saved</span>
              </span>
            ) : (
              'Save'
            )}
          </button>
          {image && (
            <button
              onClick={() => onChange(null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400"
            >
              Remove
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Replace
          </button>
        </div>
      </div>

      <div className="aspect-video bg-gray-100 border border-dashed border-gray-300 rounded-lg overflow-hidden flex items-center justify-center">
        {image ? (
          <img src={image.imageUrl} alt="Main hero" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-gray-500">
            <Plus className="w-8 h-8 mb-2" />
            <span className="text-sm">Drop or upload a main hero image</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
    </div>
  );
}

interface GalleryAdminProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  onSave: () => Promise<void>;
  saveState: 'idle' | 'saving' | 'success';
  fileInputRef: React.RefObject<HTMLInputElement>;
  title?: string;
  description?: string;
  maxImages?: number;
}

function GalleryAdmin({
  images,
  onChange,
  onSave,
  saveState,
  fileInputRef,
  title = 'Gallery Management',
  description = 'Add, hide, or remove manual gallery images.',
  maxImages,
}: GalleryAdminProps) {
  const visibleImages = useMemo(() => images, [images]);
  const reachedLimit = maxImages !== undefined && visibleImages.length >= maxImages;

  const handleToggleHidden = (id: string) => {
    onChange(
      visibleImages.map((img) =>
        img.id === id ? { ...img, hidden: !img.hidden } : img
      )
    );
  };

  const handleDelete = (id: string) => {
    onChange(visibleImages.filter((img) => img.id !== id));
  };

  const handleAdd = (url: string) => {
    if (reachedLimit) return;
    const newImage: GalleryImage = {
      id: crypto.randomUUID(),
      imageUrl: url,
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    onChange([newImage, ...visibleImages]);
  };

  const handleFileSelect = async (file: File) => {
    if (reachedLimit) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      handleAdd(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (reachedLimit) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
          {reachedLimit && (
            <p className="text-xs text-gray-500 mt-1">Maximum of {maxImages} images reached.</p>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={saveState === 'saving'}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {saveState === 'saving' ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-200" />
              <span>Saving...</span>
            </span>
          ) : saveState === 'success' ? (
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-200" />
              <span>Saved</span>
            </span>
          ) : (
            'Save'
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <button
          onClick={() => !reachedLimit && fileInputRef.current?.click()}
          disabled={reachedLimit}
          className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-6 h-6 mb-1" />
          <span className="text-sm">Add Image</span>
          <Upload className="w-4 h-4 mt-1" />
        </button>

        {visibleImages.map((img) => (
          <div key={img.id} className="relative">
            <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
              <img src={img.imageUrl} alt={img.title || 'Gallery'} className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => handleToggleHidden(img.id)}
                className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900"
              >
                {img.hidden ? (
                  <>
                    <EyeOff className="w-4 h-4" /> Hidden
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" /> Visible
                  </>
                )}
              </button>
              <button
                onClick={() => handleDelete(img.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
    </div>
  );
}
