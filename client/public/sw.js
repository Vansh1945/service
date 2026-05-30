const urlParams = new URL(self.location.href).searchParams;
const version = urlParams.get('v') || '1';
const CACHE_NAME = `rajelectrical-v${version}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(['/', '/index.html'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  // Do not intercept API requests
  if (e.request.url.includes('/api/')) {
    return;
  }

  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }

  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
