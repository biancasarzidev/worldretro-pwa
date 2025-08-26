// service-worker.js
// ⚙️ Versão (mude a cada deploy)
const APP_VERSION = 'wr-pwa-v3';
const CACHE_STATIC = `static-${APP_VERSION}`;

// ✅ Use caminhos RELATIVOS (GitHub Pages / subpasta)
const ASSETS = [
  './',                         // start_url
  './index.html',
  './styles.css',
  './app.js',
  './products.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './offline.html'              // crie este arquivo (opcional, recomendado)
];

// ————— INSTALL: pre-cache dos essenciais —————
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_STATIC).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// ————— ACTIVATE: limpa caches antigos + navigation preload —————
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_STATIC).map((k) => caches.delete(k))
    );
  })());
  self.clients.claim();
});

// ————— Helpers —————
const isSameOrigin = (url) => {
  try { return new URL(url, self.location.href).origin === self.location.origin; }
  catch { return false; }
};

// cache-first com atualização em background (para estáticos locais)
async function cacheFirstWithBGUpdate(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);

  // atualiza em background
  const netPromise = fetch(request).then(async (res) => {
    // só guarda respostas básicas (mesma origem)
    if (res && res.ok && res.type === 'basic') {
      await cache.put(request, res.clone());
    }
    return res;
  }).catch(() => null);

  if (cached) {
    netPromise.catch(() => {});
    return cached;
  }
  const net = await netPromise;
  if (net) return net;
  throw new Error('Network error and no cache');
}

// network-first com fallback (para dados mutáveis)
async function networkFirstWithCacheFallback(request) {
  const cache = await caches.open(CACHE_STATIC);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res && res.ok && res.type === 'basic') {
      await cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Network and cache miss');
  }
}

// navegação: usa preload > rede > cache > offline.html
async function navigationHandler(event) {
  const preload = event.preloadResponse ? await event.preloadResponse : null;
  if (preload) return preload;

  try {
    const res = await fetch(event.request);
    // guarda HTML da mesma origem
    if (isSameOrigin(event.request.url) && res.ok && res.type === 'basic') {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(event.request, res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(CACHE_STATIC);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const offline = await cache.match('./offline.html');
    if (offline) return offline;
    // último recurso
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// ————— FETCH —————
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // Navegação (HTML/doc)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(navigationHandler(event));
    return;
  }

  // Cross-origin: não cacheia (evita “encher” com respostas opacas)
  if (!isSameOrigin(request.url)) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Dados que mudam com frequência (ex.: catálogo)
  if (request.url.endsWith('products.json')) {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }

  // Estáticos da mesma origem
  event.respondWith(cacheFirstWithBGUpdate(request));
});
