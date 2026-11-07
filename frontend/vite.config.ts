import { readFileSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vite'
import { API_CACHE_NAME } from './src/lib/swCaches.ts'

// The browser chrome and the PWA manifest take the DA's background, read from tokens.css so no colour
// literal lives here. Dark is the reference theme (vigie-da.html); the app updates the meta at runtime.
const tokens = readFileSync(path.resolve(import.meta.dirname, 'src/styles/tokens.css'), 'utf8')
const darkBg = /:root\[data-theme="dark"\]\{[^}]*?--bg:\s*(#[0-9a-fA-F]{3,8})/.exec(tokens)?.[1]
if (!darkBg) throw new Error('--bg not found in the dark block of src/styles/tokens.css')

const themeColorMeta: Plugin = {
  name: 'vigie-theme-color',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { name: 'theme-color', content: darkBg }, injectTo: 'head' },
  ],
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    themeColorMeta,
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Vigie',
        short_name: 'Vigie',
        description: 'Votre veille techno : articles et vidéos à voir, tags, notes et partage.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: darkBg,
        background_color: darkBg,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Never cache /api/auth/*: a stale /me would survive a logout.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: API_CACHE_NAME,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    proxy: { '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:8000', changeOrigin: true } },
  },
})
