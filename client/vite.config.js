import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use 'injectManifest' so we control the SW file ourselves
      // This lets firebase-messaging-sw.js handle push notifications
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'firebase-messaging-sw.js',
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      injectManifest: {
        // Don't inject workbox precache into firebase-messaging-sw.js
        // to avoid conflicts with firebase messaging
        injectionPoint: undefined
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'logo.png'],
      manifest: {
        name: 'Raj Electrical Service',
        short_name: 'Raj Service',
        description: 'Electrical service booking platform',
        start_url: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  server: {
    historyApiFallback: true
  },

  css: {
    postcss: './postcss.config.js'
  }
})