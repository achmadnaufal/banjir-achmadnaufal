import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const SNAPSHOT_PATTERN = /^https:\/\/poskobanjir\.dsdadki\.web\.id\/xmldata\.xml/
const HISTORY_PATTERN = /^https:\/\/poskobanjir\.dsdadki\.web\.id\/Pages\/GenerateDataTinggiAir\.aspx/

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Monitor Banjir — Cinangka Paradisa Residence',
        short_name: 'Monitor Banjir',
        description: 'Live water level + early-warning alerts for Cinangka Paradisa Residence, via the Pesanggrahan gauge',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/?source=pwa',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: SNAPSHOT_PATTERN,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'upstream-xml',
              expiration: { maxEntries: 4, maxAgeSeconds: 3600 },
            },
          },
          {
            urlPattern: HISTORY_PATTERN,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'upstream-history',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 8, maxAgeSeconds: 1800 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
})
