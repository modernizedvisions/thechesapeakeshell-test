import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Eye, EyeOff, Loader2, Plus, Trash2, Upload, Pencil, X } from 'lucide-react';
import {
  fetchGalleryImages,
  fetchHomeHeroConfig,
  fetchOrders,
  fetchSoldProducts,
  saveGalleryImages,
  saveHomeHeroConfig,
  verifyAdminPassword,
  adminFetchProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
} from '../lib/api';
import { GalleryImage, HeroConfig, HeroImage, Product } from '../lib/types';
import type { AdminOrder } from '../lib/db/orders';

type ProductFormState = {
  name: string;
  description: string;
  price: string;
  category: 'Ring Dish' | 'Wine Stopper' | 'Decor' | 'Ornaments';
  imageUrl: string;
  imageUrls: string;
  quantityAvailable: number;
  isOneOff: boolean;
  isActive: boolean;
  collection?: string;
  stripePriceId?: string;
  stripeProductId?: string;
};

type ManagedImage = {
  id: string;
  url: string;
  file?: File;
  isPrimary: boolean;
  isNew?: boolean;
};

const CATEGORY_OPTIONS: ProductFormState['category'][] = ['Ring Dish', 'Wine Stopper', 'Decor', 'Ornaments'];

const initialProductForm: ProductFormState = {
  name: '',
  description: '',
  price: '',
  category: 'Ring Dish',
  imageUrl: '',
  imageUrls: '',
  quantityAvailable: 1,
  isOneOff: true,
  isActive: true,
  collection: '',
  stripePriceId: '',
  stripeProductId: '',
};

export function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [soldProducts, setSoldProducts] = useState<Product[]>([]);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [heroConfig, setHeroConfig] = useState<HeroConfig>({ mainImage: null, gridImages: [] });
  const [activeTab, setActiveTab] = useState<'orders' | 'sold' | 'gallery' | 'home' | 'shop'>('orders');
  const [gallerySaveState, setGallerySaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [homeSaveState, setHomeSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [productSaveState, setProductSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [productMessage, setProductMessage] = useState<string>('');
  const [productForm, setProductForm] = useState<ProductFormState>(initialProductForm);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editProductForm, setEditProductForm] = useState<ProductFormState | null>(null);
  const [productImages, setProductImages] = useState<ManagedImage[]>([]);
  const [editProductImages, setEditProductImages] = useState<ManagedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const heroGridFileInputRef = useRef<HTMLInputElement | null>(null);
  const heroMainFileInputRef = useRef<HTMLInputElement | null>(null);
  const productImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const editProductImageFileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((order) => {
      const idMatch = order.id.toLowerCase().includes(q);
      const nameMatch = (order.customerName ?? '').toLowerCase().includes(q);
      const emailMatch = (order.customerEmail ?? '').toLowerCase().includes(q);
      const productMatch = order.items?.some((item) =>
        (item.productName ?? '').toLowerCase().includes(q)
      );
      return idMatch || nameMatch || emailMatch || productMatch;
    });
  }, [orders, searchQuery]);

  const formatCurrency = (cents: number, currency: string = 'usd') => {
    const amount = (cents ?? 0) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

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
    await loadAdminProducts();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setPassword('');
  };

  const loadAdminProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const data = await adminFetchProducts();
      setAdminProducts(data);
    } catch (err) {
      console.error('Failed to load admin products', err);
      setProductMessage('Could not load products. Showing latest known list.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleProductFormChange = (field: keyof ProductFormState, value: string | number | boolean) => {
    setProductForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditFormChange = (field: keyof ProductFormState, value: string | number | boolean) => {
    setEditProductForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const resetProductForm = () => {
    setProductForm(initialProductForm);
    setProductImages([]);
  };

  const addImages = (files: FileList | null, setImages: React.Dispatch<React.SetStateAction<ManagedImage[]>>) => {
    if (!files) return;
    const newEntries: ManagedImage[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      file,
      isPrimary: false,
      isNew: true,
    }));
    setImages((prev) => {
      const combined = [...prev, ...newEntries];
      if (!combined.some((img) => img.isPrimary) && combined.length > 0) {
        combined[0].isPrimary = true;
      }
      return combined;
    });
  };

  const setPrimaryImage = (
    id: string,
    setImages: React.Dispatch<React.SetStateAction<ManagedImage[]>>
  ) => {
    setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === id })));
  };

  const moveImage = (
    id: string,
    direction: 'up' | 'down',
    setImages: React.Dispatch<React.SetStateAction<ManagedImage[]>>
  ) => {
    setImages((prev) => {
      const idx = prev.findIndex((img) => img.id === id);
      if (idx === -1) return prev;
      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const newOrder = [...prev];
      [newOrder[idx], newOrder[swapWith]] = [newOrder[swapWith], newOrder[idx]];
      return newOrder;
    });
  };

  const removeImage = (
    id: string,
    setImages: React.Dispatch<React.SetStateAction<ManagedImage[]>>
  ) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const normalizeImageOrder = (images: ManagedImage[]): ManagedImage[] => {
    if (!images.length) return images;
    const primary = images.find((i) => i.isPrimary) || images[0];
    return [primary, ...images.filter((i) => i.id !== primary.id)];
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/admin/upload-image', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    const data = await response.json();
    if (data.url) return data.url as string;
    if (Array.isArray(data.urls) && data.urls.length > 0) return data.urls[0] as string;
    throw new Error('Upload response missing url');
  };

  const resolveImageUrls = async (images: ManagedImage[]): Promise<{ imageUrl: string; imageUrls: string[] }> => {
    const ordered = normalizeImageOrder(images);
    const urls: string[] = [];

    for (const img of ordered) {
      if (img.file) {
        const uploadedUrl = await uploadImage(img.file);
        urls.push(uploadedUrl);
      } else if (img.url) {
        urls.push(img.url);
      }
    }

    const primary = urls[0] || '';
    return { imageUrl: primary, imageUrls: urls };
  };

  const startEditProduct = (product: Product) => {
    setEditProductId(product.id);
    setEditProductForm(productToFormState(product));
    const urls = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []);
    const managed: ManagedImage[] = urls.map((url, idx) => ({
      id: `${product.id}-${idx}`,
      url,
      isPrimary: idx === 0,
      isNew: false,
    }));
    setEditProductImages(managed);
  };

  const cancelEditProduct = () => {
    setEditProductId(null);
    setEditProductForm(null);
    setEditProductImages([]);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductSaveState('saving');
    setProductMessage('');

    try {
      const manualUrls = mergeManualImages(productForm);
      const uploaded = productImages.length > 0 ? await resolveImageUrls(productImages) : manualUrls;
      const mergedImages = mergeImages(uploaded, manualUrls);

      const payload = {
        ...formStateToPayload(productForm),
        imageUrl: mergedImages.imageUrl,
        imageUrls: mergedImages.imageUrls,
      };

      const created = await adminCreateProduct(payload);
      if (created) {
        setProductMessage('Product created.');
        resetProductForm();
        setProductImages([]);
        await loadAdminProducts();
        setProductSaveState('success');
        setTimeout(() => setProductSaveState('idle'), 1500);
      } else {
        setProductSaveState('error');
      }
    } catch (err) {
      console.error('Create product failed', err);
      setProductMessage('Create failed. Please check inputs.');
      setProductSaveState('error');
      setTimeout(() => setProductSaveState('idle'), 1500);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProductId || !editProductForm) return;
    setProductSaveState('saving');
    setProductMessage('');

    try {
      const manualUrls = mergeManualImages(editProductForm);
      const uploaded = editProductImages.length > 0 ? await resolveImageUrls(editProductImages) : manualUrls;
      const mergedImages = mergeImages(uploaded, manualUrls);

      const payload = {
        ...formStateToPayload(editProductForm),
        imageUrl: mergedImages.imageUrl,
        imageUrls: mergedImages.imageUrls,
      };

      const updated = await adminUpdateProduct(editProductId, payload);
      if (updated) {
        setProductMessage('Product updated.');
        setEditProductId(null);
        setEditProductForm(null);
        setEditProductImages([]);
        await loadAdminProducts();
        setProductSaveState('success');
        setTimeout(() => setProductSaveState('idle'), 1500);
      } else {
        setProductSaveState('error');
      }
    } catch (err) {
      console.error('Update product failed', err);
      setProductMessage('Update failed. Please try again.');
      setProductSaveState('error');
      setTimeout(() => setProductSaveState('idle'), 1500);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const confirmed = window.confirm('Delete this product?');
    if (!confirmed) return;
    try {
      await adminDeleteProduct(id);
      await loadAdminProducts();
    } catch (err) {
      console.error('Delete product failed', err);
      setProductMessage('Delete failed.');
    }
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
    <>
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
            <button
              onClick={() => setActiveTab('shop')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'shop'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Shop
            </button>
          </nav>
        </div>

        {activeTab === 'orders' && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3 px-6 pt-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order ID, customer, or product..."
                className="w-full sm:max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
              />
            </div>
            {filteredOrders.length === 0 ? (
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
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>{order.shippingName || order.customerName || 'Customer'}</div>
                          <div className="text-gray-500">{order.customerEmail || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {order.items?.length || 0} items
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${(order.totalCents / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            View
                          </button>
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

        {activeTab === 'shop' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Shop / Products</h2>
                  <p className="text-sm text-gray-600">Add, edit, and manage all products shown in the storefront.</p>
                </div>
              </div>

              {productMessage && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  {productMessage}
                </div>
              )}

              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      required
                      value={productForm.name}
                      onChange={(e) => handleProductFormChange('name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={productForm.category}
                      onChange={(e) => handleProductFormChange('category', e.target.value as ProductFormState['category'])}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    required
                    value={productForm.description}
                    onChange={(e) => handleProductFormChange('description', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) => handleProductFormChange('price', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Available</label>
                    <input
                      type="number"
                      min="1"
                      value={productForm.quantityAvailable}
                      onChange={(e) => handleProductFormChange('quantityAvailable', Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      disabled={productForm.isOneOff}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Collection (optional)</label>
                    <input
                      value={productForm.collection}
                      onChange={(e) => handleProductFormChange('collection', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="e.g., New Arrivals"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">Product Images</label>
                      <button
                        type="button"
                        onClick={() => productImageFileInputRef.current?.click()}
                        className="text-sm text-gray-700 underline"
                      >
                        Upload images
                      </button>
                    </div>
                    <input
                      ref={productImageFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addImages(e.target.files, setProductImages);
                        if (productImageFileInputRef.current) productImageFileInputRef.current.value = '';
                      }}
                    />
                    <ManagedImagesList
                      images={productImages}
                      onSetPrimary={(id) => setPrimaryImage(id, setProductImages)}
                      onMove={(id, dir) => moveImage(id, dir, setProductImages)}
                      onRemove={(id) => removeImage(id, setProductImages)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Image URLs (optional fallback)</label>
                    <textarea
                      value={productForm.imageUrls}
                      onChange={(e) => handleProductFormChange('imageUrls', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      rows={4}
                      placeholder="Provide URLs if not uploading. Primary = first entry."
                    />
                    <input
                      value={productForm.imageUrl}
                      onChange={(e) => handleProductFormChange('imageUrl', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Primary image URL (optional)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={productForm.isOneOff}
                      onChange={(e) => handleProductFormChange('isOneOff', e.target.checked)}
                      className="h-4 w-4 text-gray-900 border-gray-300 rounded"
                    />
                    One-off piece
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={productForm.isActive}
                      onChange={(e) => handleProductFormChange('isActive', e.target.checked)}
                      className="h-4 w-4 text-gray-900 border-gray-300 rounded"
                    />
                    Active (visible)
                  </label>
                  <div className="text-xs text-gray-500 self-center">
                    Price is stored in cents. Stripe IDs are auto-generated and read-only.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Price ID (auto)</label>
                    <input
                      value={productForm.stripePriceId}
                      readOnly
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm"
                      placeholder="Auto-generated by Stripe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Product ID (auto)</label>
                    <input
                      value={productForm.stripeProductId}
                      readOnly
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm"
                      placeholder="Auto-generated by Stripe"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={productSaveState === 'saving'}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {productSaveState === 'saving' ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-200" />
                        <span>Saving...</span>
                      </span>
                    ) : (
                      'Add Product'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={resetProductForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:border-gray-400"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between p-6 pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Current Products</h3>
                  <p className="text-sm text-gray-600">Edit or remove items already in the storefront.</p>
                </div>
                {isLoadingProducts && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">One-off</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {adminProducts.map((product) => {
                      const isEditing = editProductId === product.id && editProductForm;
                      return (
                        <tr key={product.id}>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                value={editProductForm?.name || ''}
                                onChange={(e) => handleEditFormChange('name', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded"
                              />
                            ) : (
                              <div>
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-gray-500">{product.collection || '—'}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {isEditing ? (
                              <select
                                value={editProductForm?.category}
                                onChange={(e) =>
                                  handleEditFormChange('category', e.target.value as ProductFormState['category'])
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded"
                              >
                                {CATEGORY_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              product.type
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editProductForm?.price}
                                onChange={(e) => handleEditFormChange('price', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded"
                              />
                            ) : (
                              formatPriceDisplay(product.priceCents)
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                value={editProductForm?.quantityAvailable || 1}
                                onChange={(e) => handleEditFormChange('quantityAvailable', Number(e.target.value))}
                                className="w-20 px-2 py-1 border border-gray-300 rounded"
                                disabled={editProductForm?.isOneOff}
                              />
                            ) : (
                              product.quantityAvailable ?? 1
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={!!editProductForm?.isOneOff}
                                onChange={(e) => handleEditFormChange('isOneOff', e.target.checked)}
                                className="h-4 w-4 text-gray-900 border-gray-300 rounded"
                              />
                            ) : (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  product.oneoff ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {product.oneoff ? 'One-off' : 'Multi'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={!!editProductForm?.isActive}
                                onChange={(e) => handleEditFormChange('isActive', e.target.checked)}
                                className="h-4 w-4 text-gray-900 border-gray-300 rounded"
                              />
                            ) : (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  product.visible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {product.visible ? 'Active' : 'Hidden'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 space-x-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={handleUpdateProduct}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-800"
                                >
                                  <CheckCircle className="w-4 h-4" /> Save
                                </button>
                                <button
                                  onClick={cancelEditProduct}
                                  className="inline-flex items-center gap-1 px-3 py-1 border border-gray-300 rounded hover:border-gray-400 text-gray-700"
                                >
                                  <X className="w-4 h-4" /> Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditProduct(product)}
                                  className="inline-flex items-center gap-1 px-3 py-1 border border-gray-300 rounded hover:border-gray-400 text-gray-700"
                                >
                                  <Pencil className="w-4 h-4" /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {adminProducts.length === 0 && !isLoadingProducts && (
                  <div className="p-6 text-center text-gray-500">No products yet</div>
                )}
              </div>
            </div>

            {editProductId && (
              <div className="bg-white rounded-lg shadow-sm border border-dashed border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Edit Images</h4>
                    <p className="text-xs text-gray-600">Upload, reorder, and set a primary image.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => editProductImageFileInputRef.current?.click()}
                    className="text-sm text-gray-700 underline"
                  >
                    Upload images
                  </button>
                  <input
                    ref={editProductImageFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addImages(e.target.files, setEditProductImages);
                      if (editProductImageFileInputRef.current) editProductImageFileInputRef.current.value = '';
                    }}
                  />
                </div>
                <ManagedImagesList
                  images={editProductImages}
                  onSetPrimary={(id) => setPrimaryImage(id, setEditProductImages)}
                  onMove={(id, dir) => moveImage(id, dir, setEditProductImages)}
                  onRemove={(id) => removeImage(id, setEditProductImages)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {selectedOrder && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-lg max-w-xl w-full mx-4 p-6 relative">
          <button
            type="button"
            onClick={() => setSelectedOrder(null)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-sm"
          >
            Close
          </button>

          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Order {selectedOrder.id}
            </h2>
            <p className="text-xs text-gray-500">
              Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Customer
              </h3>
              <p className="font-medium text-gray-900">
                {selectedOrder.customerName || selectedOrder.shippingName || 'Unknown customer'}
              </p>
              {selectedOrder.customerEmail && (
                <p className="text-gray-600">{selectedOrder.customerEmail}</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Shipping Address
              </h3>
              {selectedOrder.shippingAddress ? (
                <div className="text-gray-700">
                  {selectedOrder.shippingAddress.line1 && (
                    <p>{selectedOrder.shippingAddress.line1}</p>
                  )}
                  {selectedOrder.shippingAddress.line2 && (
                    <p>{selectedOrder.shippingAddress.line2}</p>
                  )}
                  {(selectedOrder.shippingAddress.city ||
                    selectedOrder.shippingAddress.state ||
                    selectedOrder.shippingAddress.postal_code) && (
                    <p>
                      {[selectedOrder.shippingAddress.city, selectedOrder.shippingAddress.state, selectedOrder.shippingAddress.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {selectedOrder.shippingAddress.country && (
                    <p>{selectedOrder.shippingAddress.country}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No shipping address recorded.</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Payment
              </h3>
              <p className="text-gray-700">
                Total: {formatCurrency(selectedOrder.totalCents)}
              </p>
              {selectedOrder.cardLast4 ? (
                <p className="text-gray-600">
                  Paid with {selectedOrder.cardBrand || 'card'} ending in{' '}
                  {selectedOrder.cardLast4}
                </p>
              ) : (
                <p className="text-gray-500">No card details available.</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Items
              </h3>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.productId + (item.productName ?? '')}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.productName || 'Item'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.priceCents * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No items recorded for this order.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
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

function productToFormState(product: Product): ProductFormState {
  return {
    name: product.name,
    description: product.description,
    price: product.priceCents ? (product.priceCents / 100).toFixed(2) : '',
    category: (product.type as ProductFormState['category']) || 'Ring Dish',
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls ? product.imageUrls.join(',') : '',
    quantityAvailable: product.quantityAvailable ?? 1,
    isOneOff: product.oneoff,
    isActive: product.visible,
    collection: product.collection || '',
    stripePriceId: product.stripePriceId || '',
    stripeProductId: product.stripeProductId || '',
  };
}

function formStateToPayload(state: ProductFormState) {
  const priceNumber = Number(state.price || 0);
  const parsedImages = parseImageUrls(state.imageUrls);
  const quantityAvailable = state.isOneOff ? 1 : Math.max(1, Number(state.quantityAvailable) || 1);

  return {
    name: state.name.trim(),
    description: state.description.trim(),
    priceCents: Math.round(priceNumber * 100),
    category: state.category,
    imageUrl: state.imageUrl.trim(),
    imageUrls: parsedImages,
    quantityAvailable,
    isOneOff: state.isOneOff,
    isActive: state.isActive,
    collection: state.collection?.trim() || undefined,
    stripePriceId: state.stripePriceId?.trim() || undefined,
    stripeProductId: state.stripeProductId?.trim() || undefined,
  };
}

function parseImageUrls(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function mergeManualImages(state: ProductFormState): { imageUrl: string; imageUrls: string[] } {
  const extra = parseImageUrls(state.imageUrls);
  const combined = [state.imageUrl, ...extra].filter(Boolean);
  return {
    imageUrl: combined[0] || '',
    imageUrls: combined,
  };
}

function mergeImages(
  primarySet: { imageUrl: string; imageUrls: string[] },
  secondary: { imageUrl: string; imageUrls: string[] }
): { imageUrl: string; imageUrls: string[] } {
  const merged = [...(primarySet.imageUrls || [])];
  for (const url of secondary.imageUrls || []) {
    if (!merged.includes(url)) merged.push(url);
  }
  const imageUrl = primarySet.imageUrl || secondary.imageUrl || merged[0] || '';
  if (imageUrl && !merged.includes(imageUrl)) {
    merged.unshift(imageUrl);
  }
  return { imageUrl, imageUrls: merged };
}

function formatPriceDisplay(priceCents?: number) {
  if (priceCents === undefined || priceCents === null) return '$0.00';
  return `$${(priceCents / 100).toFixed(2)}`;
}

function ManagedImagesList({
  images,
  onSetPrimary,
  onMove,
  onRemove,
}: {
  images: ManagedImage[];
  onSetPrimary: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onRemove: (id: string) => void;
}) {
  if (!images.length) {
    return <div className="text-sm text-gray-500 border border-gray-200 rounded-lg p-3">No images yet. Upload to add.</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {images.map((img, idx) => (
        <div key={img.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="aspect-square bg-gray-100 overflow-hidden">
            <img src={img.url} alt={`upload-${idx}`} className="w-full h-full object-cover" />
          </div>
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{img.isPrimary ? 'Primary' : 'Additional'}</span>
              <span>{img.isNew ? 'New' : 'Saved'}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSetPrimary(img.id)}
                className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded hover:border-gray-400"
              >
                Set primary
              </button>
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onMove(img.id, 'up')}
                className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded hover:border-gray-400"
              >
                Up
              </button>
              <button
                type="button"
                onClick={() => onMove(img.id, 'down')}
                className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded hover:border-gray-400"
              >
                Down
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
