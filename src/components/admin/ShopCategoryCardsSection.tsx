import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchShopCategoryTiles, saveShopCategoryTiles, adminUpdateCategory } from '../../lib/api';
import type { Category, ShopCategoryTile } from '../../lib/types';
import { AdminSectionHeader } from './AdminSectionHeader';

interface ShopCategoryCardsSectionProps {
  categories?: Category[];
  onCategoryUpdated?: (category: Category) => void;
}

const SLOT_COUNT = 4;

export function ShopCategoryCardsSection({ categories = [], onCategoryUpdated }: ShopCategoryCardsSectionProps) {
  const [tiles, setTiles] = useState<ShopCategoryTile[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  const [categoryState, setCategoryState] = useState<Category[]>(categories);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadTiles();
  }, []);

  useEffect(() => {
    setCategoryState(categories);
  }, [categories]);

  // Ensure each tile is hydrated with a categoryId when a matching slug exists.
  useEffect(() => {
    if (!tiles.length || !categoryState.length) return;

    let changed = false;
    const hydrated = tiles.map((tile) => {
      if (tile.categoryId) return tile;
      const match = findCategoryBySlug(categoryState, tile.categorySlug);
      if (!match) return tile;
      changed = true;
      return {
        ...tile,
        categoryId: match.id,
        label: match.name || tile.label,
        ctaLabel: match.name ? `All ${match.name}` : tile.ctaLabel,
      };
    });

    if (changed) {
      setTiles(hydrated);
    }
  }, [tiles, categoryState]);

  const loadTiles = async () => {
    try {
      const loaded = await fetchShopCategoryTiles();
      const normalized = normalizeToFour(loaded).map((tile, index) => ({
        ...tile,
        slotIndex: tile.slotIndex ?? index,
      }));
      setTiles(normalized.slice(0, SLOT_COUNT));
    } catch (error) {
      console.error('Failed to load category tiles', error);
    }
  };

  const resolveCategoryForTile = (tile: ShopCategoryTile) => {
    if (!tile) return undefined;
    return (
      categoryOptions.find((c) => c.id === tile.categoryId) ||
      findCategoryBySlug(categoryOptions, tile.categorySlug)
    );
  };

  const handleTileImageSelect = (file: File, tileId: string) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      const tile = tiles.find((t) => t.id === tileId);
      const resolvedCategory = tile ? resolveCategoryForTile(tile) : undefined;
      const categoryId = resolvedCategory?.id;
      if (!categoryId) {
        alert('Please select a category before uploading an image.');
        return;
      }
      const imageUrl = reader.result as string;
      // Optimistically update local category hero image
      setCategoryState((prev) =>
        prev.map((cat) => (cat.id === categoryId ? { ...cat, heroImageUrl: imageUrl } : cat))
      );

      try {
        const updated = await adminUpdateCategory(categoryId, { heroImageUrl: imageUrl });
        if (updated) {
          setCategoryState((prev) => prev.map((cat) => (cat.id === updated.id ? { ...cat, ...updated } : cat)));
          onCategoryUpdated?.(updated);
        }
      } catch (err) {
        console.error('Failed to update category hero image', err);
        alert('Failed to save image. Please try again.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const withSlots = tiles.map((tile, index) => {
        const category = categoryOptions.find((c) => c.id === tile.categoryId);
        return {
          ...tile,
          slotIndex: tile.slotIndex ?? index,
          imageUrl: category?.heroImageUrl || category?.imageUrl || tile.imageUrl || '',
        };
      });
      await saveShopCategoryTiles(withSlots);
      setTiles(withSlots.slice(0, SLOT_COUNT));
      setSaveState('success');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (err) {
      console.error('Failed to save category tiles', err);
      setSaveState('idle');
    }
  };

  const categoryOptions = useMemo(() => categoryState, [categoryState]);

  const handleCategoryChange = (tileId: string, categoryId: string) => {
    const selected = categoryOptions.find((c) => c.id === categoryId);
    if (!selected) return;
    setTiles((prev) =>
      prev.map((tile) =>
        tile.id === tileId
          ? {
              ...tile,
              categoryId,
              label: selected.name,
              ctaLabel: selected.name ? `All ${selected.name}` : tile.ctaLabel,
              categorySlug: selected.slug || tile.categorySlug,
            }
          : tile
      )
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <AdminSectionHeader
        title="Category Home Page Display"
        subtitle="Choose which categories appear on the home page and in what order."
        className="mt-10"
      />
      {saveState === 'saving' && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving...
        </div>
      )}
      {saveState === 'success' && <div className="text-sm text-green-600 text-center mb-3">Saved!</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {tiles.slice(0, SLOT_COUNT).map((tile, idx) => {
          const selectedCategory = resolveCategoryForTile(tile);
          const displayLabel = selectedCategory?.name || tile.label || `Category ${idx + 1}`;
          const pillText = `Shop ${displayLabel}`;
          const categoryImage = selectedCategory?.heroImageUrl || selectedCategory?.imageUrl;

          return (
            <div key={tile.id || idx} className="space-y-3">
              <div className="relative overflow-hidden rounded-lg shadow-sm aspect-[3/4] bg-gray-100">
                {categoryImage ? (
                  <img src={categoryImage} alt={displayLabel} className="h-full w-full object-cover" />
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

              <div className="mt-2 flex w-full items-center justify-between gap-2">
                <div className="w-full max-w-xs">
                  <select
                    value={selectedCategory?.id || ''}
                    onChange={(e) => handleCategoryChange(tile.id, e.target.value)}
                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTileId(tile.id);
                    fileInputRef.current?.click();
                  }}
                  className="text-xs text-gray-700 underline whitespace-nowrap"
                >
                  {categoryImage ? 'Replace image' : 'Upload image'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Save Category Cards
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeTileId) {
            handleTileImageSelect(file, activeTileId);
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
    </div>
  );
}

const normalizeToFour = (tiles: ShopCategoryTile[]): ShopCategoryTile[] => {
  const result = [...tiles];
  const defaults = [
    {
      id: 'slot-1',
      label: 'Ring Dishes',
      ctaLabel: 'All Ring Dishes',
      categorySlug: 'ring-dish',
      imageUrl: '',
      slotIndex: 0,
    },
    {
      id: 'slot-2',
      label: 'Ornaments',
      ctaLabel: 'All Ornaments',
      categorySlug: 'ornament',
      imageUrl: '',
      slotIndex: 1,
    },
    {
      id: 'slot-3',
      label: 'Decor',
      ctaLabel: 'All Decor',
      categorySlug: 'decor',
      imageUrl: '',
      slotIndex: 2,
    },
    {
      id: 'slot-4',
      label: 'Wine Stoppers',
      ctaLabel: 'All Wine Stoppers',
      categorySlug: 'wine-stopper',
      imageUrl: '',
      slotIndex: 3,
    },
  ];
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (!result[i]) result[i] = defaults[i] as ShopCategoryTile;
  }
  return result.slice(0, SLOT_COUNT);
};

const findCategoryBySlug = (categories: Category[], slug?: string) => {
  if (!slug) return undefined;
  return categories.find((c) => (c.slug || '').toLowerCase() === slug.toLowerCase());
};
