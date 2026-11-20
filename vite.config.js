import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js pesa ~600 kB; se sirve en un solo archivo con gzip
    chunkSizeWarningLimit: 1200,
  },
});
