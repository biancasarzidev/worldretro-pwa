// Simple cache-first SW (raiz)
const APP_VERSION = 'wr-pwa-v2';
const ASSETS = [
  '/',                     // página inicial
  '/index.html',
  '/styles.css',
  '/app.js',
  '/products.json',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_VERSION).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== APP_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;

  // Apenas mesma origem (evita problemas com cdns/analytics)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Fallback para navegação: entrega o index offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (request.method !== 'GET') return;

  // Cache-first com atualização em background
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(APP_VERSION).then((c) => c.put(request, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
