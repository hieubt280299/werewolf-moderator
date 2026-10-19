import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Installable, offline-capable app. New versions install in the background and take over on the
    // next launch — never a forced reload in the middle of a game.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['moon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Werewolf Gamemaster',
        short_name: 'Werewolf GM',
        description: 'A moderator companion for Ultimate Werewolf.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#050505',
        background_color: '#050505',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Fonts are bundled, split into unicode-range subsets. Cache the subsets a device actually
        // uses on first load (hashed file names, so cache-first is safe) rather than precaching all.
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) => sameOrigin && url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
} as never);
