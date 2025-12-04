import { ContactForm } from '../components/ContactForm';
import { SocialSection } from '../components/SocialSection';

export function AboutPage() {
  return (
    <div className="bg-white">
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">About the Artist</h1>

          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">
              Welcome to my creative space. Each piece you see here is crafted with dedication,
              passion, and attention to detail. I believe in creating art that tells a story and
              connects with people on a personal level.
            </p>

            <p className="text-gray-600 mb-6">
              My journey as an artist began many years ago, and since then, I've been exploring
              different techniques and materials to bring unique visions to life. Every creation
              is an opportunity to express something meaningful and share it with the world.
            </p>

            <p className="text-gray-600 mb-6">
              Many of my works are one-of-a-kind pieces, meaning when you purchase them, you're
              getting something truly unique that no one else in the world will have. I take pride
              in this personal approach to art and the special connection it creates between the
              piece and its owner.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">The Process</h2>
            <p className="text-gray-600 mb-6">
              Each piece goes through a careful creative process, from initial concept to final
              execution. I work with high-quality materials and take the time needed to ensure
              every detail is just right. This commitment to quality means that while production
              may take time, the result is always worth the wait.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Custom Work</h2>
            <p className="text-gray-600 mb-6">
              Interested in a custom piece? I'm always excited to work on commissioned projects.
              Feel free to reach out through the contact form below to discuss your ideas, and
              we can create something special together.
            </p>
          </div>
        </div>
      </section>

      <SocialSection />

      <ContactForm />
    </div>
  );
}
