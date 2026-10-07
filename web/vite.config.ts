import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Ciel · Your personal intelligence',
        short_name: 'Ciel',
        description: 'A private workspace for your knowledge, tasks, and everyday clarity.',
        theme_color: '#F3F8FD',
        background_color: '#F3F8FD',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/ciel-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/ciel-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/ciel-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz$/, /^\/readyz$/],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173, strictPort: true, headers: { 'X-Content-Type-Options': 'nosniff' } },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-sanitize'],
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node', testTimeout: 15000 },
})
