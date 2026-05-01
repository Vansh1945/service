import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars for the current mode (development / production)
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * Vite plugin: replaces %%VITE_*%% placeholders inside
   * public/firebase-messaging-sw.js with actual .env values.
   * Runs during both dev (configureServer) and build (generateBundle).
   */
  const swEnvPlugin = {
    name: 'sw-env-replace',

    // ── Dev server: intercept the SW file and return it with values injected ──
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/firebase-messaging-sw.js') return next()

        const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js')
        let content = fs.readFileSync(swPath, 'utf-8')

        content = injectEnv(content, env)

        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Service-Worker-Allowed', '/')
        res.end(content)
      })
    },

    // ── Build: rewrite the emitted SW file with values injected ──
    generateBundle(options, bundle) {
      const swAsset = bundle['firebase-messaging-sw.js']
      if (swAsset && swAsset.type === 'asset') {
        swAsset.source = injectEnv(String(swAsset.source), env)
      }
    }
  }

  return {
    plugins: [
      react(),
      swEnvPlugin,
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'public',
        filename: 'firebase-messaging-sw.js',
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        devOptions: {
          enabled: false,
          type: 'classic'
        },
        injectManifest: {
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
  }
})

/**
 * Replace all %%VITE_KEY%% tokens in `content` with values from `env`.
 * Falls back to empty string if the var is not defined.
 */
function injectEnv(content, env) {
  return content.replace(/%%(\w+)%%/g, (_, key) => env[key] ?? '')
}