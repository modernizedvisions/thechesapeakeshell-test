import type { HeroCollageImage } from '../lib/types';
import { Link } from 'react-router-dom';

interface HomeHeroProps {
  images?: HeroCollageImage[];
}

export default function HomeHero({ images = [] }: HomeHeroProps) {
  const heroBackground = '/images/hero-bg.jpg';

  const fallbacks: HeroCollageImage[] = [
    {
      id: 'fallback-1',
      imageUrl: '/images/chesapeake-hero-1.jpg',
      alt: 'Handcrafted decoupage oyster shell jewelry dish',
    },
    {
      id: 'fallback-2',
      imageUrl: '/images/chesapeake-hero-2.jpg',
      alt: 'Coastal art oyster shell wall hanging',
    },
    {
      id: 'fallback-3',
      imageUrl: '/images/chesapeake-hero-3.jpg',
      alt: 'Vibrant hand-painted oyster shell trinket dish',
    },
  ];

  const safeImages = (images || []).filter((img) => !!img?.imageUrl);
  const slot1 = safeImages[0] || fallbacks[0];
  const slot2 = safeImages[1] || fallbacks[1];
  const slot3 = safeImages[2] || fallbacks[2];

  return (
    <section
      id="hero"
      className="relative w-full bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${heroBackground}')` }}
    >
      <div className="absolute inset-0 bg-white/60" aria-hidden="true" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
              Pieces of the coast, brushed with color.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-700 max-w-xl">
              Bringing the quiet beauty of the coast to you — or wrapped as a gift for someone you love.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 focus:ring-offset-white/70"
              >
                Shop New Art
              </Link>
              <Link
                to="/gallery"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 focus:ring-offset-white/70"
              >
                View Gallery
              </Link>
            </div>
          </div>

          <div className="relative h-72 sm:h-80 md:h-96">
            <div className="absolute left-0 top-2 w-32 sm:w-40 md:w-44 rotate-[-3deg] rounded-2xl bg-white border border-slate-100 shadow-lg overflow-hidden">
              <div className="relative aspect-[4/5]">
                <img
                  src={slot1.imageUrl}
                  alt={slot1.alt || 'Handcrafted decoupage oyster shell art'}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="absolute right-0 top-10 w-36 sm:w-44 md:w-52 rotate-2 rounded-2xl bg-white border border-slate-100 shadow-lg overflow-hidden">
              <div className="relative aspect-[4/5]">
                <img
                  src={slot2.imageUrl}
                  alt={slot2.alt || 'Coastal art oyster shell wall hanging'}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="absolute left-8 bottom-0 w-40 sm:w-52 md:w-60 rotate-[-1deg] rounded-2xl bg-white border border-slate-100 shadow-lg overflow-hidden">
              <div className="relative aspect-video">
                <img
                  src={slot3.imageUrl}
                  alt={slot3.alt || 'Vibrant hand-painted oyster shell trinket dish'}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
