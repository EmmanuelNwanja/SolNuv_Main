const CACHE_NAME = 'solnuv-pwa-v2';
const URLS_TO_CACHE = [
  '/',
  '/calculator',
  '/plans',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_TO_CACHE))
      .catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isApiRequest = isSameOrigin && url.pathname.startsWith('/api');
  const isNavigation = req.mode === 'navigate';

  // Never intercept cross-origin or API requests. Let the browser/network handle them.
  if (!isSameOrigin || isApiRequest) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((networkResp) => {
          // Cache only successful same-origin GET responses.
          if (networkResp && networkResp.ok) {
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return networkResp;
        })
        .catch(() => {
          // Offline fallback is only valid for full page navigations.
          if (isNavigation) return caches.match('/offline.html');
          return Response.error();
        });
    })
  );
});
