import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import type { Product } from '../../lib/types';
import type { ManagedImage, ProductFormState } from '../../pages/AdminPage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProductAdminCardProps {
  product: Product;
  onEdit: (product: Product) => void;
}

const ProductAdminCard: React.FC<ProductAdminCardProps> = ({ product, onEdit }) => {
  const primaryImageUrl = Array.isArray((product as any).images) && (product as any).images.length > 0
    ? (product as any).images[0]
    : (product as any).imageUrls?.[0] ?? (product as any).imageUrl ?? null;

  const quantity =
    ('quantity' in product && (product as any).quantity !== undefined)
      ? (product as any).quantity
      : product.quantityAvailable;
  const isOneOff = ('oneOff' in product ? (product as any).oneOff : (product as any).oneOff) ?? product.oneoff;
  const isActive = ('active' in product ? (product as any).active : (product as any).active) ?? product.visible;

  const priceLabel =
    (product as any).formattedPrice ??
    (product as any).priceFormatted ??
    (product as any).displayPrice ??
    (product as any).price ??
    (product.priceCents !== undefined ? formatPriceDisplay(product.priceCents) : '');

  return (
    <div className="flex flex-col rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-[4/5] w-full overflow-hidden rounded-t-xl bg-slate-100">
        {primaryImageUrl ? (
          <img
            src={primaryImageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        {'category' in product && (product as any).category && (
          <div className="text-xs text-slate-500">
            {(product as any).category}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-900 truncate">
            {product.name}
          </h3>
          <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
            {priceLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {quantity !== undefined && (
            <span>Qty: {quantity}</span>
          )}
          {isOneOff && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              One-off
            </span>
          )}
          {isActive !== undefined && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
              {isActive ? 'Active' : 'Inactive'}
            </span>
          )}
        </div>

        <button
          type="button"
          className="mt-2 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50"
          onClick={() => onEdit(product)}
        >
          Edit product
        </button>
      </div>
    </div>
  );
};

export interface AdminShopTabProps {
  productMessage: string;
  productForm: ProductFormState;
  productImages: ManagedImage[];
  editProductImages: ManagedImage[];
  adminProducts: Product[];
  editProductId: string | null;
  editProductForm: ProductFormState | null;
  productSaveState: 'idle' | 'saving' | 'success' | 'error';
  isLoadingProducts: boolean;
  categoryOptions: ProductFormState['category'][];
  productImageFileInputRef: React.RefObject<HTMLInputElement>;
  editProductImageFileInputRef: React.RefObject<HTMLInputElement>;
  onCreateProduct: (e: React.FormEvent) => void | Promise<void>;
  onProductFormChange: (field: keyof ProductFormState, value: string | number | boolean) => void;
  onResetProductForm: () => void;
  onAddProductImages: (files: FileList | null) => void;
  onSetPrimaryProductImage: (id: string) => void;
  onRemoveProductImage: (id: string) => void;
  onAddEditProductImages: (files: FileList | null) => void;
  onSetPrimaryEditImage: (id: string) => void;
  onMoveEditImage: (id: string, direction: 'up' | 'down') => void;
  onRemoveEditImage: (id: string) => void;
  onEditFormChange: (field: keyof ProductFormState, value: string | number | boolean) => void;
  onUpdateProduct: (e: React.FormEvent) => void | Promise<void>;
  onCancelEditProduct: () => void;
  onStartEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void | Promise<void>;
}

export const AdminShopTab: React.FC<AdminShopTabProps> = ({
  productMessage,
  productForm,
  productImages,
  editProductImages,
  adminProducts,
  editProductId,
  editProductForm,
  productSaveState,
  isLoadingProducts,
  categoryOptions,
  productImageFileInputRef,
  editProductImageFileInputRef,
  onCreateProduct,
  onProductFormChange,
  onResetProductForm,
  onAddProductImages,
  onSetPrimaryProductImage,
  onRemoveProductImage,
  onAddEditProductImages,
  onSetPrimaryEditImage,
  onMoveEditImage,
  onRemoveEditImage,
  onEditFormChange,
  onUpdateProduct,
  onCancelEditProduct,
  onStartEditProduct,
  onDeleteProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editImages, setEditImages] = useState<ManagedImage[]>([]);
  const [categories, setCategories] = useState<string[]>(categoryOptions);
  const [newCategoryName, setNewCategoryName] = useState('');
  const maxModalImages = 4;

  const handleModalFileSelect = (files: FileList | null) => {
    onAddEditProductImages(files);
  };

  const handleSetPrimaryModalImage = (id: string) => {
    onSetPrimaryEditImage(id);
    setEditImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === id })));
  };

  const handleRemoveModalImage = (id: string) => {
    onRemoveEditImage(id);
    setEditImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const filteredProducts = useMemo(() => {
    const all = adminProducts;

    return all.filter((product) => {
      const name = (product.name ?? '').toLowerCase();
      const desc = ((product as any).description ?? '').toLowerCase();
      const cat = ((product as any).category ?? '').toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchSearch = !term || name.includes(term) || desc.includes(term);
      const matchCat = selectedCategory === 'All' || cat === selectedCategory.toLowerCase();

      return matchSearch && matchCat;
    });
  }, [adminProducts, searchTerm, selectedCategory]);

  useEffect(() => {
    if (isEditModalOpen) {
      const imgs = editProductImages.length && !editProductImages.some((img) => img.isPrimary)
        ? [{ ...editProductImages[0], isPrimary: true }, ...editProductImages.slice(1)]
        : editProductImages;
      setEditImages(imgs);
    }
  }, [isEditModalOpen, editProductImages, editProductId]);

  return (
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

        <form onSubmit={onCreateProduct} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] gap-8">
            <section className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  required
                  value={productForm.name}
                  onChange={(e) => onProductFormChange('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  value={productForm.description}
                  onChange={(e) => onProductFormChange('description', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => onProductFormChange('price', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Categories
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Add new category"
                        className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = newCategoryName.trim();
                          if (!trimmed) return;
                          const exists = categories.some((cat) => cat.toLowerCase() === trimmed.toLowerCase());
                          if (!exists) {
                            setCategories((prev) => [...prev, trimmed]);
                            // TODO: Persist custom categories to backend when available.
                          }
                          onProductFormChange('category', trimmed as ProductFormState['category']);
                          setNewCategoryName('');
                        }}
                        disabled={!newCategoryName.trim()}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium transition ${
                          newCategoryName.trim()
                            ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                            : 'border-slate-200 text-slate-300 cursor-not-allowed'
                        }`}
                      >
                        ✓
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto py-1">
                      {categories.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">No categories yet. Add one above to get started.</p>
                      ) : (
                        categories.map((cat) => (
                          <label
                            key={cat}
                            className="flex items-center gap-2 px-3 py-1 text-sm hover:bg-slate-100 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={productForm.category === cat}
                              onChange={() => onProductFormChange('category', cat as ProductFormState['category'])}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="text-slate-800">{cat}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Available</label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.quantityAvailable}
                    onChange={(e) => onProductFormChange('quantityAvailable', Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    disabled={productForm.isOneOff}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-center pt-2">
                <ToggleSwitch
                  label="One-off piece"
                  description="Defaults to one-of-a-kind"
                  checked={productForm.isOneOff}
                  onChange={(val) => onProductFormChange('isOneOff', val)}
                />
                <ToggleSwitch
                  label="Active (visible)"
                  checked={productForm.isActive}
                  onChange={(val) => onProductFormChange('isActive', val)}
                />
              </div>

              <div className="flex gap-3 pt-4">
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
                    'Save Product'
                  )}
                </button>
                <button
                  type="button"
                  onClick={onResetProductForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:border-gray-400"
                >
                  Clear
                </button>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Product Images</h4>
                <button
                  type="button"
                  onClick={() => productImageFileInputRef.current?.click()}
                  className="text-xs font-medium text-slate-700 border border-slate-300 rounded-full px-3 py-1 hover:bg-slate-50"
                >
                  Upload Images
                </button>
                <input
                  ref={productImageFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onAddProductImages(e.target.files);
                    if (productImageFileInputRef.current) productImageFileInputRef.current.value = '';
                  }}
                />
              </div>

              <div
                className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-4 text-center text-sm text-slate-500 cursor-pointer"
                onClick={() => productImageFileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onAddProductImages(e.dataTransfer.files);
                }}
              >
                Drag & drop images here, or click to browse. Up to 4 images.
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => {
                  const image = productImages[index];
                  if (image) {
                    return (
                      <div
                        key={image.id}
                        className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                      >
                        <img src={image.url} alt={`Product image ${index + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/40 px-2 py-1 text-xs text-white">
                          <button
                            type="button"
                            onClick={() => onSetPrimaryProductImage(image.id)}
                            className={`px-2 py-1 rounded ${image.isPrimary ? 'bg-white text-slate-900' : 'bg-black/30 text-white'}`}
                          >
                            {image.isPrimary ? 'Primary' : 'Set primary'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveProductImage(image.id)}
                            className="text-red-100 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-center aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
                    >
                      Empty slot
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </form>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
          >
            <option value="All">All types</option>
            {Array.from(new Set(adminProducts.map((p: any) => p.category).filter(Boolean))).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Current Products (Card View)
        </h3>

        {isLoadingProducts && (
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        )}

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductAdminCard
              key={product.id}
              product={product}
              onEdit={(p) => {
                setIsEditModalOpen(true);
                onStartEditProduct(p);
              }}
            />
          ))}
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
                onAddEditProductImages(e.target.files);
                if (editProductImageFileInputRef.current) editProductImageFileInputRef.current.value = '';
              }}
            />
          </div>
          <ManagedImagesList
            images={editProductImages}
            onSetPrimary={onSetPrimaryEditImage}
            onMove={onMoveEditImage}
            onRemove={onRemoveEditImage}
          />
        </div>
      )}

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateProduct(e);
              setIsEditModalOpen(false);
            }}
            className="space-y-4"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    value={editProductForm?.name || ''}
                    onChange={(e) => onEditFormChange('name', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editProductForm?.price || ''}
                      onChange={(e) => onEditFormChange('price', e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={editProductForm?.quantityAvailable ?? 1}
                      onChange={(e) => onEditFormChange('quantityAvailable', Number(e.target.value))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      disabled={editProductForm?.isOneOff}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editProductForm?.description || ''}
                    onChange={(e) => onEditFormChange('description', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={editProductForm?.category}
                      onChange={(e) => onEditFormChange('category', e.target.value as ProductFormState['category'])}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">One-off</label>
                    <input
                      type="checkbox"
                      checked={!!editProductForm?.isOneOff}
                      onChange={(e) => onEditFormChange('isOneOff', e.target.checked)}
                      className="h-4 w-4"
                    />
                    <label className="text-sm font-medium text-gray-700">Active</label>
                    <input
                      type="checkbox"
                      checked={!!editProductForm?.isActive}
                      onChange={(e) => onEditFormChange('isActive', e.target.checked)}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Product Images (max 4)</h3>
                  <button
                    type="button"
                    onClick={() => editProductImageFileInputRef.current?.click()}
                    className="text-xs font-medium text-slate-700 border border-slate-300 rounded-full px-3 py-1 hover:bg-slate-50"
                  >
                    Upload
                  </button>
                  <input
                    ref={editProductImageFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleModalFileSelect(e.target.files);
                      if (editProductImageFileInputRef.current) editProductImageFileInputRef.current.value = '';
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: maxModalImages }).map((_, idx) => {
                    const image = editImages[idx];
                    if (image) {
                      return (
                        <div key={image.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                          <img src={image.url} alt={`Edit image ${idx + 1}`} className="h-full w-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/40 px-2 py-1 text-xs text-white">
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryModalImage(image.id)}
                              className={`px-2 py-1 rounded ${image.isPrimary ? 'bg-white text-slate-900' : 'bg-black/30 text-white'}`}
                            >
                              {image.isPrimary ? 'Primary' : 'Set primary'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveModalImage(image.id)}
                              className="text-red-100 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => editProductImageFileInputRef.current?.click()}
                        className="flex items-center justify-center aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
                      >
                        Upload
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Save
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function formatPriceDisplay(priceCents?: number) {
  if (priceCents === undefined || priceCents === null) return '$0.00';
  return `$${(priceCents / 100).toFixed(2)}`;
}

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSwitch({ label, description, checked, onChange }: ToggleSwitchProps) {
  const trackClasses = checked ? 'bg-slate-900 border-slate-900' : 'bg-slate-200 border-slate-300';
  const thumbClasses = checked ? 'translate-x-5' : 'translate-x-1';

  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3">
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${trackClasses}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${thumbClasses}`}
        />
      </span>
      <div className="flex flex-col text-left">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="text-xs text-slate-500">{description}</span>}
      </div>
    </button>
  );
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
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => onSetPrimary(img.id)}
                className={`rounded px-2 py-1 ${img.isPrimary ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {img.isPrimary ? 'Primary' : 'Set primary'}
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

