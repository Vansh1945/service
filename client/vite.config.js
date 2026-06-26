/* global process, __dirname */
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
        includeAssets: ['apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: "Raj Electrical Services",
          short_name: "Raj Services",
          description: "Book certified electricians for home and commercial electrical repairs, installations, and maintenance.",
          id: "/",
          start_url: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#0D9488",
          orientation: "portrait",
          dir: "ltr",
          lang: "en-US",
          categories: ["business", "utilities"],
          icons: [
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable"
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ],
          shortcuts: [
            {
              name: "Book Service",
              short_name: "Book",
              description: "Book an electrical service",
              url: "/",
              icons: [{ src: "/icon-192.png", sizes: "192x192" }]
            }
          ],
          screenshots: [
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              form_factor: "wide",
              label: "Raj Electrical Services Desktop"
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              form_factor: "narrow",
              label: "Raj Electrical Services Mobile"
            }
          ],
          launch_handler: {
            client_mode: ["navigate-new", "focus-existing"]
          },
          edge_side_panel: {
            preferred_width: 480
          }
        }
      })
    ],

    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
      }
    },

    css: {
      postcss: './postcss.config.cjs'
    },
    build: {
      chunkSizeWarningLimit: 1000,
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('framer-motion')) {
                return 'vendor-framer-motion';
              }
              if (id.includes('lucide-react') || id.includes('react-icons') || id.includes('@heroicons')) {
                return 'vendor-icons';
              }

              if (id.includes('react-datepicker') || id.includes('react-time-picker')) {
                return 'vendor-pickers';
              }
              if (id.includes('country-state-city')) {
                return 'vendor-csc';
              }
              if (id.includes('leaflet')) {
                return 'vendor-leaflet';
              }
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              if (id.includes('swiper')) {
                return 'vendor-swiper';
              }
            }
          }
        }
      }
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