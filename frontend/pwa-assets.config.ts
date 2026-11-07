import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Regenerate icons with: npm run generate-pwa-assets
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // full-bleed source; background filled for maskable/apple icons
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#1fa97c', fit: 'cover' } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#1fa97c', fit: 'cover' } },
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  },
  images: ['public/favicon.svg'],
})
