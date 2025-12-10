import React from 'react';
import { CheckCircle, Loader2, Plus } from 'lucide-react';
import type { CustomOrdersImage, HeroCollageImage, ShopCategoryTile } from '../../lib/types';

export interface AdminHomeTabProps {
  heroImages: HeroCollageImage[];
  customOrdersImages: CustomOrdersImage[];
  onHeroChange: (images: HeroCollageImage[]) => void;
  onCustomOrdersChange: (images: CustomOrdersImage[]) => void;
  onSaveHeroConfig: () => Promise<void>;
  homeSaveState: 'idle' | 'saving' | 'success';
  shopCategoryTiles: ShopCategoryTile[];
  categoryTilesSaveState: 'idle' | 'saving' | 'success';
  onSaveCategoryTiles: () => Promise<void>;
  onTileImageSelect: (file: File, tileId: string) => void;
  categoryTileFileInputRef: React.RefObject<HTMLInputElement>;
  onSelectTileId: (tileId: string) => void;
  activeTileId: string | null;
}

export function AdminHomeTab({
  heroImages,
  customOrdersImages,
  onHeroChange,
  onCustomOrdersChange,
  onSaveHeroConfig,
  homeSaveState,
  shopCategoryTiles,
  categoryTilesSaveState,
  onSaveCategoryTiles,
  onTileImageSelect,
  categoryTileFileInputRef,
  onSelectTileId,
  activeTileId,
}: AdminHomeTabProps) {
  return (
    <div className="space-y-6">
      <HeroCollageAdmin images={heroImages} onChange={onHeroChange} onSave={onSaveHeroConfig} saveState={homeSaveState} />

      <CustomOrdersImagesAdmin
        images={customOrdersImages}
        onChange={onCustomOrdersChange}
        onSave={onSaveHeroConfig}
        saveState={homeSaveState}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Shop Category Cards</h3>
            <p className="text-sm text-gray-600">Upload a hero image for each category tile.</p>
          </div>
          {categoryTilesSaveState === 'saving' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </div>
          )}
          {categoryTilesSaveState === 'success' && <div className="text-sm text-green-600">Saved!</div>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {shopCategoryTiles.map((tile) => {
            const pillText = tile.ctaLabel?.replace(/^All\s+/i, 'Shop ') || `Shop ${tile.label}`;

            return (
              <div key={tile.id} className="space-y-2">
                <div className="relative overflow-hidden rounded-lg shadow-sm aspect-[3/4] bg-gray-100">
                  {tile.imageUrl ? (
                    <img src={tile.imageUrl} alt={tile.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">No image uploaded</div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                  <div className="absolute inset-x-0 bottom-4 flex justify-center">
                    <span className="pointer-events-auto inline-flex items-center rounded-full bg-white px-5 py-2 text-xs font-medium text-gray-900 shadow-sm">
                      {pillText}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-700">
                  <div>
                    <p className="font-semibold text-gray-900">{tile.label}</p>
                    <p className="text-xs text-gray-500">Links to: {pillText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTileId(tile.id);
                      categoryTileFileInputRef.current?.click();
                    }}
                    className="text-xs text-gray-700 underline"
                  >
                    {tile.imageUrl ? 'Replace image' : 'Upload image'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={onSaveCategoryTiles}
            disabled={categoryTilesSaveState === 'saving'}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Save Category Cards
          </button>
        </div>
        <input
          ref={categoryTileFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && activeTileId) {
              onTileImageSelect(file, activeTileId);
            }
            if (categoryTileFileInputRef.current) categoryTileFileInputRef.current.value = '';
          }}
        />
      </div>
    </div>
  );
}

interface HeroCollageAdminProps {
  images: HeroCollageImage[];
  onChange: (images: HeroCollageImage[]) => void;
  onSave: () => Promise<void>;
  saveState: 'idle' | 'saving' | 'success';
}

function HeroCollageAdmin({ images, onChange, onSave, saveState }: HeroCollageAdminProps) {
  const slots = [0, 1, 2];

  const handleFileSelect = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onChange(
        slots
          .map((slotIndex) => {
            if (slotIndex !== index) return images[slotIndex];
            const existing = images[slotIndex];
            return {
              id: existing?.id || `hero-${slotIndex}-${crypto.randomUUID?.() || Date.now()}`,
              imageUrl: dataUrl,
              alt: existing?.alt,
              createdAt: existing?.createdAt || new Date().toISOString(),
            };
          })
          .filter((img): img is HeroCollageImage => Boolean(img && img.imageUrl))
      );
    };
    reader.readAsDataURL(file);
  };

  const handleAltChange = (index: number, alt: string) => {
    const existing = images[index];
    if (!existing) return;
    const next = [...images];
    next[index] = { ...existing, alt };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Hero Collage Images</h2>
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
      </header>

      <p className="text-xs text-slate-500">These three images appear in the floating collage on the homepage hero.</p>

      <div className="grid gap-4 md:grid-cols-3">
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

              <div className="aspect-[4/5] rounded-md border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                {image?.imageUrl ? (
                  <img src={image.imageUrl} alt={image.alt || `Hero image ${slot + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-slate-500 text-sm">
                    <Plus className="h-6 w-6 mb-1" />
                    <span>Drop or upload</span>
                  </div>
                )}
              </div>

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
  onChange: (images: CustomOrdersImage[]) => void;
  onSave: () => Promise<void>;
  saveState: 'idle' | 'saving' | 'success';
}

function CustomOrdersImagesAdmin({ images, onChange, onSave, saveState }: CustomOrdersImagesAdminProps) {
  const slots = [0, 1, 2, 3];

  const handleFileSelect = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const next = [...images];
      next[index] = { ...(next[index] || {}), imageUrl: dataUrl };
      onChange(next.slice(0, 4));
    };
    reader.readAsDataURL(file);
  };

  const handleAltChange = (index: number, alt: string) => {
    const next = [...images];
    if (!next[index]) {
      next[index] = { imageUrl: '' };
    }
    next[index] = { ...next[index], alt };
    onChange(next.slice(0, 4));
  };

  const handleRemove = (index: number) => {
    const next = [...images];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Custom Shell Orders Images</h2>
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
      </header>

      <p className="text-xs text-slate-500">
        These four images appear in the 2×2 photo grid next to the “Custom Shell Orders” section on the home page.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
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

              <div className="aspect-[4/5] rounded-md border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                {image?.imageUrl ? (
                  <img src={image.imageUrl} alt={image.alt || `Custom orders ${slot + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-slate-500 text-sm">
                    <Plus className="h-6 w-6 mb-1" />
                    <span>Drop or upload</span>
                  </div>
                )}
              </div>

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
