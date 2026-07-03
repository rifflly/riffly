/**
 * Riffly service worker (rule d): cache-first app shell + data, offline support,
 * and an update flow that lets the app show a "New version ready" banner.
 *
 * This is a TEMPLATE. At build time a Vite plugin (see vite.config.js) fills in
 * the cache name and precache list below and emits the real /sw.js. Because the
 * cache name and precached (content-hashed) filenames change every release, a
 * new build is always seen as an update.
 */
const CACHE = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  // Precache the whole app shell so it works offline after the first visit.
  // Do NOT skipWaiting here — the app asks the user first, then posts SKIP_WAITING.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// The app posts this when the user taps "Refresh" on the update banner.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't touch cross-origin

  // Navigations: network-first (so a fresh build's new asset refs load online),
  // falling back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // Everything else (hashed JS/CSS, icons, manifest): cache-first. Hashed assets
  // are immutable, so this is both fast and safe.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});
