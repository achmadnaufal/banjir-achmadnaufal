import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// PNG icons from the SVG favicon: iOS ignores SVG touch icons, so without
// these the home-screen app (and its notifications) would show a screenshot.
// Apple and maskable icons sit on the app's own dark blue, not the preset's white.
const BACKGROUND = '#0f172a'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0, resizeOptions: { background: BACKGROUND } },
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: BACKGROUND } },
  },
  images: ['public/favicon.svg'],
})
