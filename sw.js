/* TriAkar Service Worker — static asset cache
   Strategy: Cache-First for assets, Network-First for HTML + API.
   Version bump (CACHE_VER) forces all clients to re-fetch on deploy. */

const CACHE_VER = 'ta-v21';
const CACHE_NAME = 'triakar-' + CACHE_VER;

/* Assets to pre-cache on install (shell) */
const PRECACHE = [
  '/partials.js',
  '/shared.css',
  '/shared.js',
  '/assets/fonts/Glorida.woff2',
  '/favicon.svg',
  '/offline.html',
];

/* ── INSTALL ────────────────────────────────────────────── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() {
      return self.skipWaiting(); // activate immediately
    })
  );
});

/* ── ACTIVATE — purge old caches ────────────────────────── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── FETCH ──────────────────────────────────────────────── */
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  var req = e.request;

  /* Skip non-GET, chrome-extension, cross-origin API calls */
  if (req.method !== 'GET') return;
  if (url.startsWith('chrome-extension')) return;
  if (url.includes('triakar.onrender.com')) return;   // API — always network
  if (url.includes('supabase.co')) return;            // Supabase — always network
  if (url.includes('razorpay.com')) return;           // Payments — always network
  if (url.includes('googletagmanager.com')) return;   // Analytics — skip

  /* HTML pages: Network-first with cache fallback (content stays fresh) */
  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(req).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        }
        return res;
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match('/offline.html');
        });
      })
    );
    return;
  }

  /* App shell (CSS / JS): Network-first so deploys are picked up immediately,
     with cache fallback for offline. Prevents stale partials.js/shared.css/shared.js. */
  if (/\.(?:css|js)(?:\?|$)/.test(url)) {
    e.respondWith(
      fetch(req).then(function(res) {
        if (res && res.status === 200 && res.type !== 'opaque') {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        }
        return res;
      }).catch(function() {
        return caches.match(req);
      })
    );
    return;
  }

  /* Other static assets (fonts, images, favicon): Cache-first */
  e.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(res) {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        return res;
      });
    })
  );
});
