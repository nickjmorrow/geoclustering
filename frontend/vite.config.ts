import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// `vitest/config` rather than `vite`: same function, plus the `test` key.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // MapLibre alone is ~800 KB minified; the warning would fire on every build.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // MapLibre is most of the bundle and changes far less often than the
        // app, so it gets a file of its own and a cache entry that survives
        // app-only deploys.
        manualChunks: (id) => (id.includes('/node_modules/maplibre-gl/') ? 'maplibre' : undefined),
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    // Absolute imports from src/.
    alias: { src: '/src' },
  },
  server: {
    host: true,
    port: 3003,
    proxy: {
      // The browser only ever talks to one origin: no CORS in dev, and no API
      // URL baked into the bundle. nginx does the same job in production.
      '/api': {
        changeOrigin: true,
        target: process.env.BACKEND_ORIGIN ?? 'http://localhost:8003',
      },
    },
    watch: {
      // Docker on macOS does not deliver filesystem events across the bind
      // mount, so HMR silently stops working without polling.
      usePolling: true,
    },
  },
  test: {
    // Node, not jsdom: everything tested is a pure function of data. The
    // logic worth pinning lives in .ts modules, not in components.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
