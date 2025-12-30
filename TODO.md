# PWA Conversion Tasks

## Frontend (React/Vite)
- [x] Update client/public/manifest.json with PWA fields (name, short_name, start_url, display, theme_color, background_color, icons)
- [x] Add manifest link and theme-color meta to client/index.html
- [x] Add vite-plugin-pwa to client/vite.config.js for service worker setup
- [x] Verify service worker registration (handled by Vite PWA)
- [x] Build the app to generate PWA assets (sw.js, manifest.webmanifest)

## Backend (Node/Express)
- [x] Ensure HTTPS compatibility (deployment level)
- [x] Add headers for service worker caching
- [x] Confirm CORS is enabled (already present)
- [x] Ensure GET APIs are cache-safe

## Testing
- [ ] Test "Add to Home Screen" functionality
- [ ] Verify standalone mode
- [ ] Check offline caching
