// Simple cache-first SW
const APP_VERSION = 'wr-pwa-v1';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js', '/products.json',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_VERSION).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==APP_VERSION).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res => {
      const copy = res.clone();
      caches.open(APP_VERSION).then(c => c.put(request, copy));
      return res;
    }).catch(()=> cached))
  );
});
