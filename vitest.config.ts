import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'attached_assets'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    threads: false,
    pool: 'threads',
    include: [
      'client/src/**/*.{test,spec}.{ts,tsx}',
      'server/**/*.{test,spec}.ts',
      'shared/**/*.{test,spec}.ts',
    ],
    exclude: ['node_modules', 'dist'],
    css: false,
  },
});
