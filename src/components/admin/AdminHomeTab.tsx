import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Plus } from 'lucide-react';
import type { Category, CustomOrdersImage, HeroCollageImage, HomeSiteContent } from '../../lib/types';
import { AdminSectionHeader } from './AdminSectionHeader';
import { adminFetchCategories, adminUploadImageScoped, getAdminSiteContentHome, updateAdminSiteContentHome } from '../../lib/api';
import { ShopCategoryCardsSection } from './ShopCategoryCardsSection';

const OTHER_ITEMS_CATEGORY = {
  slug: 'other-items',
  name: 'Other Items',
};

const isOtherItemsCategory = (category: Category) =>
  (category.slug || '').toLowerCase() === OTHER_ITEMS_CATEGORY.slug ||
  (category.name || '').trim().toLowerCase() === OTHER_ITEMS_CATEGORY.name.toLowerCase();

export function AdminHomeTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [heroImages, setHeroImages] = useState<HeroCollageImage[]>([]);
  const [customOrdersImages, setCustomOrdersImages] = useState<CustomOrdersImage[]>([]);
  const [heroRotationEnabled, setHeroRotationEnabled] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const apiCategories = await adminFetchCategories();
        setCategories(normalizeCategoriesList(apiCategories));
      } catch (error) {
        console.error('Failed to load categories', error);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const loadHomeContent = async () => {
      setLoadState('loading');
      setError(null);
      try {
        const content = await getAdminSiteContentHome();
        const { hero, customOrders, rotation } = normalizeSiteContent(content);
        setHeroImages(hero);
        setCustomOrdersImages(customOrders);
        setHeroRotationEnabled(rotation);
        setLoadState('idle');
      } catch (err) {
        console.error('Failed to load home content', err);
        setLoadState('error');
        setError(err instanceof Error ? err.message : 'Failed to load home content');
      }
    };
    loadHomeContent();
  }, []);

  const handleSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      const hasUploads = heroImages.some((img) => img?.uploading) || customOrdersImages.some((img) => img?.uploading);
      const hasErrors = heroImages.some((img) => img?.uploadError) || customOrdersImages.some((img) => img?.uploadError);
      const hasInvalid = [...heroImages, ...customOrdersImages].some(
        (img) => img?.imageUrl?.startsWith('blob:') || img?.imageUrl?.startsWith('data:')
      );
      if (hasUploads) throw new Error('Images are still uploading.');
      if (hasErrors) throw new Error('Fix failed uploads before saving.');
      if (hasInvalid) throw new Error('Images must be uploaded first (no blob/data URLs).');
      const payload = buildSiteContent(heroImages, customOrdersImages, heroRotationEnabled);
      await updateAdminSiteContentHome(payload);
      setSaveState('success');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (err) {
      console.error('Failed to save home content', err);
      setSaveState('error');
      setError(err instanceof Error ? err.message : 'Failed to save home content');
    }
  };

  return (
    <div className="space-y-12">
      <HeroCollageAdmin
        images={heroImages}
        onChange={setHeroImages}
        onSave={handleSave}
        saveState={saveState}
        heroRotationEnabled={heroRotationEnabled}
        onHeroRotationToggle={setHeroRotationEnabled}
      />

      <CustomOrdersImagesAdmin
        images={customOrdersImages}
        onChange={setCustomOrdersImages}
        onSave={handleSave}
        saveState={saveState}
      />

      <ShopCategoryCardsSection
        categories={categories}
        onCategoryUpdated={(updated) => {
          setCategories((prev) => normalizeCategoriesList(prev.map((c) => (c.id === updated.id ? updated : c))));
        }}
      />
      {(loadState === 'loading' || error) && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {loadState === 'loading' && 'Loading home content...'}
          {error && loadState !== 'loading' && error}
        </div>
      )}
    </div>
  );
}

interface HeroCollageAdminProps {
  images: HeroCollageImage[];
  onChange: React.Dispatch<React.SetStateAction<HeroCollageImage[]>>;
  onSave: () => Promise<void>;
  saveState: 'idle' | 'saving' | 'success' | 'error';
  heroRotationEnabled?: boolean;
  onHeroRotationToggle?: (enabled: boolean) => void;
}

function HeroCollageAdmin({
  images,
  onChange,
  onSave,
  saveState,
  heroRotationEnabled = false,
  onHeroRotationToggle,
}: HeroCollageAdminProps) {
  const slots = [0, 1, 2];

  const handleFileSelect = async (index: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    onChange((prev) => {
      const next = [...prev];
      const existing = next[index];
      next[index] = {
        id: existing?.id || `hero-${index}-${crypto.randomUUID?.() || Date.now()}`,
        imageUrl: previewUrl,
        alt: existing?.alt,
        createdAt: existing?.createdAt || new Date().toISOString(),
        uploading: true,
        uploadError: undefined,
        previewUrl,
      };
      return next;
    });

    try {
      const result = await adminUploadImageScoped(file, { scope: 'home' });
      URL.revokeObjectURL(previewUrl);
      onChange((prev) => {
        const next = [...prev];
        const existing = next[index];
        if (existing) {
          next[index] = {
            ...existing,
            imageUrl: result.url,
            uploading: false,
            uploadError: undefined,
            previewUrl: undefined,
          };
        } else {
          next[index] = { id: `hero-${index}`, imageUrl: result.url };
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      onChange((prev) => {
        const next = [...prev];
        const existing = next[index];
        if (existing) {
          next[index] = {
            ...existing,
            uploading: false,
            uploadError: message,
          };
        }
        return next;
      });
    }
  };

  const handleAltChange = (index: number, alt: string) => {
    const existing = images[index];
    if (!existing) return;
    const next = [...images];
    next[index] = { ...existing, alt };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange((prev) => {
      const next = [...prev];
      const existing = next[index];
      next[index] = existing ? { ...existing, imageUrl: '' } : { id: `hero-${index}`, imageUrl: '' };
      return next;
    });
  };

  return (
    <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <div className="space-y-2">
        <AdminSectionHeader
          title="Hero Images"
          subtitle="main images on your site"
        />
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-900">Rotate Hero Images</p>
            <p className="text-xs text-slate-600">
              ON: rotate through all hero images. OFF: show only the first image.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              checked={!!heroRotationEnabled}
              onChange={(e) => onHeroRotationToggle?.(e.target.checked)}
            />
            <span>{heroRotationEnabled ? 'On' : 'Off'}</span>
          </label>
        </div>
        <div className="flex justify-center sm:justify-end">
          <button
            onClick={onSave}
            disabled={saveState === 'saving'}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saveState === 'saving' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saveState === 'success' ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-200" />
                Saved
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => {
          const image = images[slot];
          const inputId = `hero-collage-${slot}`;
          return (
            <div
              key={slot}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(slot, file);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">Hero Image {slot + 1}</div>
                <div className="flex items-center gap-2">
                  {image && (
                    <button type="button" onClick={() => handleRemove(slot)} className="text-xs text-red-600 hover:text-red-700">
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => document.getElementById(inputId)?.click()}
                    className="text-xs text-slate-700 underline hover:text-slate-900"
                  >
                    {image ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </div>

              <div className="aspect-[3/4] rounded-md border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                {image?.imageUrl ? (
                  <>
                    <img src={image.previewUrl || image.imageUrl} alt={image.alt || `Hero image ${slot + 1}`} className="h-full w-full object-cover" />
                    {image.uploading && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs text-slate-700">
                        Uploading...
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-500 text-sm">
                    <Plus className="h-6 w-6 mb-1" />
                    <span>Drop or upload</span>
                  </div>
                )}
              </div>
              {image?.uploadError && (
                <div className="text-xs text-red-600">{image.uploadError}</div>
              )}

              <div className="space-y-1">
                <label htmlFor={`${inputId}-alt`} className="text-xs font-medium text-slate-700">
                  Alt text / description
                </label>
                <input
                  id={`${inputId}-alt`}
                  type="text"
                  value={image?.alt || ''}
                  onChange={(e) => handleAltChange(slot, e.target.value)}
                  placeholder="Optional description"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <input
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(slot, file);
                  (e.target as HTMLInputElement).value = '';
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface CustomOrdersImagesAdminProps {
  images: CustomOrdersImage[];
  onChange: React.Dispatch<React.SetStateAction<CustomOrdersImage[]>>;
  onSave: () => Promise<void>;
  saveState: 'idle' | 'saving' | 'success' | 'error';
}

const normalizeCategoriesList = (items: Category[]): Category[] => {
  const map = new Map<string, Category>();
  items.forEach((cat) => {
    const key = cat.id || cat.name;
    if (!key) return;
    const normalized: Category = { ...cat, id: cat.id || key };
    map.set(key, normalized);
  });
  const ordered = Array.from(map.values()).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const otherItems = ordered.filter((cat) => isOtherItemsCategory(cat));
  const withoutOtherItems = ordered.filter((cat) => !isOtherItemsCategory(cat));
  return [...withoutOtherItems, ...otherItems];
};

function CustomOrdersImagesAdmin({ images, onChange, onSave, saveState }: CustomOrdersImagesAdminProps) {
  const slots = [0, 1, 2, 3];

  const handleFileSelect = async (index: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    onChange((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] || { imageUrl: '' }), imageUrl: previewUrl, uploading: true, uploadError: undefined, previewUrl };
      return next.slice(0, 4);
    });

    try {
      const result = await adminUploadImageScoped(file, { scope: 'home' });
      URL.revokeObjectURL(previewUrl);
      onChange((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...(updated[index] || {}),
          imageUrl: result.url,
          uploading: false,
          uploadError: undefined,
          previewUrl: undefined,
        };
        return updated.slice(0, 4);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      onChange((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...(updated[index] || {}),
          uploading: false,
          uploadError: message,
        };
        return updated.slice(0, 4);
      });
    }
  };

  const handleRemove = (index: number) => {
    onChange((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] || { imageUrl: '' }), imageUrl: '' };
      return next;
    });
  };

  return (
    <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <div className="space-y-2">
        <AdminSectionHeader
          title="Custom Orders"
          subtitle="images shown beside the custom orders section."
        />
        <div className="flex justify-center sm:justify-end">
          <button
            onClick={onSave}
            disabled={saveState === 'saving'}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saveState === 'saving' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saveState === 'success' ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-200" />
                Saved
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {slots.map((slot) => {
          const image = images[slot];
          const inputId = `custom-orders-${slot}`;
          return (
            <div
              key={slot}
              className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(slot, file);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Image {slot + 1}</span>
                <div className="flex items-center gap-2">
                  {image?.imageUrl && (
                    <button type="button" onClick={() => handleRemove(slot)} className="text-xs text-red-600 hover:text-red-700">
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => document.getElementById(inputId)?.click()}
                    className="text-xs text-slate-700 underline hover:text-slate-900"
                  >
                    {image?.imageUrl ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </div>

              <div className="aspect-[3/4] rounded-md border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                {image?.imageUrl ? (
                  <>
                    <img src={image.previewUrl || image.imageUrl} alt={image.alt || `Custom orders ${slot + 1}`} className="h-full w-full object-cover" />
                    {image.uploading && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs text-slate-700">
                        Uploading...
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-500 text-sm">
                    <Plus className="h-6 w-6 mb-1" />
                    <span>Drop or upload</span>
                  </div>
                )}
              </div>
              {image?.uploadError && (
                <div className="text-xs text-red-600">{image.uploadError}</div>
              )}

              <input
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(slot, file);
                  (e.target as HTMLInputElement).value = '';
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

const normalizeSiteContent = (content: HomeSiteContent) => {
  const hero: HeroCollageImage[] = Array.from({ length: 3 }, (_, index) => ({
    id: `hero-${index}`,
    imageUrl: '',
  }));
  if (content.heroImages?.left) hero[0] = { id: 'hero-left', imageUrl: content.heroImages.left };
  if (content.heroImages?.middle) hero[1] = { id: 'hero-middle', imageUrl: content.heroImages.middle };
  if (content.heroImages?.right) hero[2] = { id: 'hero-right', imageUrl: content.heroImages.right };

  const customOrders = Array.from({ length: 4 }, () => ({ imageUrl: '' }));
  if (Array.isArray(content.customOrderImages)) {
    content.customOrderImages.slice(0, 4).forEach((url, index) => {
      customOrders[index] = { imageUrl: url };
    });
  }

  return {
    hero,
    customOrders,
    rotation: !!content.heroRotationEnabled,
  };
};

const buildSiteContent = (
  hero: HeroCollageImage[],
  customOrders: CustomOrdersImage[],
  heroRotationEnabled: boolean
): HomeSiteContent => {
  const heroImages = {
    left: hero[0]?.imageUrl || '',
    middle: hero[1]?.imageUrl || '',
    right: hero[2]?.imageUrl || '',
  };
  const customOrderImages = customOrders.filter((img) => !!img?.imageUrl).slice(0, 4).map((img) => img.imageUrl);
  return { heroImages, customOrderImages, heroRotationEnabled };
};
