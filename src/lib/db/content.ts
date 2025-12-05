import type { GalleryImage, HeroConfig } from '../types';
import {
  GALLERY_STORAGE_KEY,
  HOME_HERO_STORAGE_KEY,
  defaultGalleryImages,
  defaultHomeHeroConfig,
} from './mockData';

// TODO: Swap localStorage for Cloudflare D1 tables exposed via Workers.

export async function getGalleryImages(): Promise<GalleryImage[]> {
  try {
    const stored = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as GalleryImage[];
    }
  } catch (err) {
    console.warn('Gallery storage read failed, using defaults.', err);
  }
  return defaultGalleryImages;
}

export async function saveGalleryImages(images: GalleryImage[]): Promise<void> {
  localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(images));
}

export async function getHomeHeroConfig(): Promise<HeroConfig> {
  try {
    const stored = localStorage.getItem(HOME_HERO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Backward compatibility: previously stored as an array of images.
      if (Array.isArray(parsed)) {
        return {
          mainImage: parsed[0] ? parsed[0] : null,
          gridImages: parsed.slice(0, 6),
        };
      }

      const config = parsed as HeroConfig;
      return {
        mainImage: config.mainImage || null,
        gridImages: Array.isArray(config.gridImages) ? config.gridImages.slice(0, 6) : [],
      };
    }
  } catch (err) {
    console.warn('Home hero storage read failed, using defaults.', err);
  }
  return defaultHomeHeroConfig;
}

export async function saveHomeHeroConfig(config: HeroConfig): Promise<void> {
  const safeConfig: HeroConfig = {
    mainImage: config.mainImage || null,
    gridImages: (config.gridImages || []).slice(0, 6),
  };
  localStorage.setItem(HOME_HERO_STORAGE_KEY, JSON.stringify(safeConfig));
}
