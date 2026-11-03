/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// BASE_PATH viene impostato dalla GitHub Action (es. /tabata-taimer/); in locale è /.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: { host: true },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'splash/*.png'],
      manifest: {
        name: 'Tabata tAImer',
        short_name: 'tAImer',
        description: 'Timer a intervalli per Tabata e HIIT, senza abbonamenti.',
        lang: 'it',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F0D0A',
        theme_color: '#0F0D0A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,wav}'],
        globIgnores: ['splash/**'],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
