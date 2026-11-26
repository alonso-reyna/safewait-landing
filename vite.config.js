import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    // three.js pesa ~600 kB; se sirve en un solo archivo con gzip
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      // la landing, la presentación (/pitch/) y la escena 3D que la presentación carga en sus iframes (/video/)
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        pitch: resolve(import.meta.dirname, 'pitch/index.html'),
        video: resolve(import.meta.dirname, 'video/index.html'),
      },
    },
  },
});
