const CACHE_NAME = 'solnuv-pwa-v4';
const OFFLINE_URL = '/offline';
const URLS_TO_CACHE = [
  '/offline',
  '/manifest.json',
];

function isCacheableStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/favicon.svg' ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname);
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(req);
    if (response && response.ok) {
      cache.put(req, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((response) => {
      if (response && response.ok) {
        cache.put(req, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  return cached || networkPromise || fetch(req);
}

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
  const isNextDataRequest = isSameOrigin && url.pathname.startsWith('/_next/data/');
  const isProtectedRoute = isSameOrigin && (
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/projects') ||
    url.pathname.startsWith('/reports') ||
    url.pathname.startsWith('/leaderboard') ||
    url.pathname.startsWith('/settings') ||
    url.pathname.startsWith('/profile') ||
    url.pathname.startsWith('/field') ||
    url.pathname.startsWith('/feedback') ||
    url.pathname === '/notifications'
  );

  // Never intercept cross-origin, API requests, Next.js data payloads, or protected routes.
  // Those should always come from the network to avoid stale authenticated app state.
  if (!isSameOrigin || isApiRequest || isNextDataRequest || isProtectedRoute) return;

  if (isNavigation) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (isCacheableStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  event.respondWith(
    fetch(req).catch((error) => {
      console.error(`[SW] Fetch failed for ${req.url}:`, error);
      return caches.match(OFFLINE_URL);
    })
  );
});
