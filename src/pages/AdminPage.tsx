import { useEffect, useMemo, useRef, useState } from 'react';
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
import { CustomOrdersImage, GalleryImage, HeroCollageImage, HeroConfig, Product } from '../lib/types';
import type { AdminOrder } from '../lib/db/orders';
import { AdminOrdersTab } from '../components/admin/AdminOrdersTab';
import { AdminSoldTab } from '../components/admin/AdminSoldTab';
import { AdminGalleryTab } from '../components/admin/AdminGalleryTab';
import { AdminHomeTab } from '../components/admin/AdminHomeTab';
import { AdminMessagesTab } from '../components/admin/AdminMessagesTab';
import { AdminShopTab } from '../components/admin/AdminShopTab';
import { AdminCustomOrdersTab } from '../components/admin/AdminCustomOrdersTab';

export type ProductFormState = {
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  imageUrls: string;
  quantityAvailable: number;
  isOneOff: boolean;
  isActive: boolean;
  collection?: string;
  stripePriceId?: string;
  stripeProductId?: string;
};

export type ManagedImage = {
  id: string;
  url: string;
  file?: File;
  isPrimary: boolean;
  isNew?: boolean;
};

const DEFAULT_CATEGORY_OPTIONS: string[] = ['Ring Dish', 'Wine Stopper', 'Decor', 'Ornaments'];

const normalizeCategoryValue = (value: string | undefined | null) => (value || '').trim();

const deriveCategoryOptions = (products: Product[]): string[] => {
  const names = new Map<string, string>();

  const addName = (name?: string | null) => {
    const normalized = normalizeCategoryValue(name);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!names.has(key)) names.set(key, normalized);
  };

  DEFAULT_CATEGORY_OPTIONS.forEach(addName);

  products.forEach((product) => {
    addName(product.type);
    addName((product as any).category);
    if (Array.isArray(product.categories)) {
      product.categories.forEach((c) => addName(c));
    }
  });

  return Array.from(names.values());
};

const initialProductForm: ProductFormState = {
  name: '',
  description: '',
  price: '',
  category: DEFAULT_CATEGORY_OPTIONS[0] || '',
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
  const [heroConfig, setHeroConfig] = useState<HeroConfig>({ heroImages: [], customOrdersImages: [] });
  const [activeTab, setActiveTab] = useState<'orders' | 'sold' | 'gallery' | 'home' | 'shop' | 'messages' | 'customOrders'>('orders');
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
  const productImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const editProductImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const [messages] = useState<any[]>([]);
  const [customOrders, setCustomOrders] = useState<any[]>([]);
  const [customOrderDraft, setCustomOrderDraft] = useState<any>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS);

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
        heroImages: (heroConfig.heroImages || []).slice(0, 3),
        customOrdersImages: (heroConfig.customOrdersImages || []).slice(0, 4),
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
      heroImages: (heroData.heroImages || []).slice(0, 3),
      customOrdersImages: (heroData.customOrdersImages || []).slice(0, 4),
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
      setCategoryOptions(deriveCategoryOptions(data));
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
    setProductForm({ ...initialProductForm, category: categoryOptions[0] || initialProductForm.category });
    setProductImages([]);
  };

  const addImages = (
    files: FileList | null,
    setImages: React.Dispatch<React.SetStateAction<ManagedImage[]>>,
    slotIndex?: number
  ) => {
    if (!files) return;
    const incoming = Array.from(files);
    setImages((prev) => {
      const maxSlots = 4;
      const selected = incoming.slice(0, maxSlots);
      let result = [...prev];

      // If a slot index is provided, replace starting at that slot.
      if (slotIndex !== undefined && slotIndex !== null && slotIndex >= 0) {
        const start = Math.min(slotIndex, maxSlots - 1);
        selected.forEach((file, offset) => {
          const pos = Math.min(start + offset, maxSlots - 1);
          const newEntry: ManagedImage = {
            id: crypto.randomUUID(),
            url: URL.createObjectURL(file),
            file,
            isPrimary: false,
            isNew: true,
          };
          result[pos] = newEntry;
        });
      } else {
        // Default behavior: append into remaining slots
        const remaining = Math.max(0, maxSlots - result.length);
        if (remaining === 0) return result;
        const toAdd = selected.slice(0, remaining).map((file) => ({
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          file,
          isPrimary: false,
          isNew: true,
        }));
        result = [...result, ...toAdd];
      }

      // Limit to 4 slots
      result = result.slice(0, maxSlots);

      // Ensure there is a primary image
      if (!result.some((img) => img?.isPrimary) && result.length > 0) {
        result[0].isPrimary = true;
      }

      return result;
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
    // TODO: In future, move from base64 data URLs to real storage (e.g., R2) and restore a real upload endpoint.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read image as data URL'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
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
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'messages'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => setActiveTab('customOrders')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'customOrders'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Custom Orders
            </button>
          </nav>
        </div>

        {activeTab === 'orders' && (
          <AdminOrdersTab
            searchQuery={searchQuery}
            filteredOrders={filteredOrders}
            onSearchChange={setSearchQuery}
            onSelectOrder={setSelectedOrder}
          />
        )}

        {activeTab === 'sold' && <AdminSoldTab soldProducts={soldProducts} />}

        {activeTab === 'gallery' && (
          <AdminGalleryTab
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
          <AdminHomeTab
            heroImages={heroConfig.heroImages || []}
            customOrdersImages={heroConfig.customOrdersImages || []}
            onHeroChange={(images) => setHeroConfig((prev) => ({ ...prev, heroImages: images }))}
            onCustomOrdersChange={(images) => setHeroConfig((prev) => ({ ...prev, customOrdersImages: images }))}
            onSaveHeroConfig={handleSaveHeroConfig}
            homeSaveState={homeSaveState}
          />
        )}

        {activeTab === 'shop' && (
          <AdminShopTab
            productMessage={productMessage}
            productForm={productForm}
            productImages={productImages}
            editProductImages={editProductImages}
            adminProducts={adminProducts}
            editProductId={editProductId}
            editProductForm={editProductForm}
            productSaveState={productSaveState}
            isLoadingProducts={isLoadingProducts}
            categoryOptions={categoryOptions}
            productImageFileInputRef={productImageFileInputRef}
            editProductImageFileInputRef={editProductImageFileInputRef}
            onCreateProduct={handleCreateProduct}
            onProductFormChange={handleProductFormChange}
            onResetProductForm={resetProductForm}
            onAddProductImages={(files, slotIndex) => addImages(files, setProductImages, slotIndex)}
            onSetPrimaryProductImage={(id) => setPrimaryImage(id, setProductImages)}
            onRemoveProductImage={(id) => removeImage(id, setProductImages)}
            onAddEditProductImages={(files, slotIndex) => addImages(files, setEditProductImages, slotIndex)}
            onSetPrimaryEditImage={(id) => setPrimaryImage(id, setEditProductImages)}
            onMoveEditImage={(id, dir) => moveImage(id, dir, setEditProductImages)}
            onRemoveEditImage={(id) => removeImage(id, setEditProductImages)}
            onEditFormChange={handleEditFormChange}
            onUpdateProduct={handleUpdateProduct}
            onCancelEditProduct={cancelEditProduct}
            onStartEditProduct={startEditProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeTab === 'messages' && (
          <AdminMessagesTab
            messages={messages}
            onCreateCustomOrderFromMessage={(draft) => {
              setCustomOrderDraft(draft);
              setActiveTab('customOrders');
            }}
          />
        )}

        {activeTab === 'customOrders' && (
          <AdminCustomOrdersTab
            allCustomOrders={customOrders}
            onCreateOrder={(order) => setCustomOrders((prev) => [...prev, { id: crypto.randomUUID(), ...order }])}
            initialDraft={customOrderDraft}
            onDraftConsumed={() => setCustomOrderDraft(null)}
          />
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

function productToFormState(product: Product): ProductFormState {
  return {
    name: product.name,
    description: product.description,
    price: product.priceCents ? (product.priceCents / 100).toFixed(2) : '',
    category: normalizeCategoryValue(product.type || (product as any).category) || DEFAULT_CATEGORY_OPTIONS[0] || '',
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
  const category = normalizeCategoryValue(state.category) || DEFAULT_CATEGORY_OPTIONS[0] || 'Uncategorized';

  return {
    name: state.name.trim(),
    description: state.description.trim(),
    priceCents: Math.round(priceNumber * 100),
    category,
    categories: category ? [category] : undefined,
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

