import { Outlet, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { CartIcon } from '../components/cart/CartIcon';
import { CartDrawer } from '../components/cart/CartDrawer';
import { useUIStore } from '../store/uiStore';

export function SiteLayout() {
  const openCartOnLoad = useUIStore((state) => state.openCartOnLoad);
  const setOpenCartOnLoad = useUIStore((state) => state.setOpenCartOnLoad);
  const setCartDrawerOpen = useUIStore((state) => state.setCartDrawerOpen);

  useEffect(() => {
    if (openCartOnLoad) {
      setCartDrawerOpen(true);
      setOpenCartOnLoad(false);
    }
  }, [openCartOnLoad, setCartDrawerOpen, setOpenCartOnLoad]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-serif font-semibold text-gray-900">
              The Chesapeake Shell
            </Link>
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/shop"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Shop
              </Link>
              <Link
                to="/gallery"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Gallery
              </Link>
              <Link
                to="/about"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                About
              </Link>
              <CartIcon />
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-1 bg-white">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">
              &copy; {new Date().getFullYear()} The Chesapeake Shell. All rights reserved.
            </p>
            <Link
              to="/admin"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </footer>

      <CartDrawer />
    </div>
  );
}
