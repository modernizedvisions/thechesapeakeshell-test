import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true, // keep the mapped path (avoids '#' realpath issues on Windows)
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
