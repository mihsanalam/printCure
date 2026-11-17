import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built pages also work inside Electron (file:// fallback).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        desktop: 'desktop.html',
        web: 'web.html',
      },
    },
  },
});
