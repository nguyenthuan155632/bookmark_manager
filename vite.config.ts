import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Only include Replit plugins in development and when running on Replit
    ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [
          // Conditionally import and use Replit plugins
          (await import('@replit/vite-plugin-runtime-error-modal').catch(() => null))?.default?.(),
          (await import('@replit/vite-plugin-cartographer').catch(() => null))?.cartographer?.(),
        ].filter(Boolean)
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            return 'vendor';
          }
        },
      },
    },
    sourcemap: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
});
