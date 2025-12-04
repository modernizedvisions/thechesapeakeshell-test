import type { HeroImage } from '../lib/types';

interface HeroShowcaseProps {
  image?: HeroImage | null;
  isLoading?: boolean;
}

export default function HeroShowcase({ image, isLoading = false }: HeroShowcaseProps) {
  const featured = image && !image.hidden ? image : null;

  return (
    <section className="w-full bg-white py-16">
      <div className="max-w-6xl mx-auto px-4 text-center">

        <div className="w-48 h-48 mx-auto bg-gray-100 border border-gray-300 rounded-xl flex items-center justify-center overflow-hidden">
          {isLoading ? (
            <div className="w-full h-full animate-pulse bg-gray-100" />
          ) : featured ? (
            <img
              src={featured.imageUrl}
              alt="Featured hero"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 font-sans text-sm">
              HERO IMG
            </div>
          )}
        </div>

        <p className="mt-6 text-sm tracking-[0.25em] uppercase text-gray-500 font-sans">
          NEW ART
        </p>

      </div>
    </section>
  );
}
