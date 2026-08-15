/* TriAkar Service Worker, static asset cache
   Strategy: Stale-While-Revalidate for HTML/CSS/JS (instant page changes,
   refreshed in the background), Cache-First for fonts/images, network-only
   for APIs. Version bump (CACHE_VER) forces all clients to re-fetch on
   deploy, and partials.js auto-reloads once when a new SW takes control. */

const CACHE_VER = 'ta-v255';
const CACHE_NAME = 'triakar-' + CACHE_VER;

/* Assets to pre-cache on install (shell).
   NOTE: page URLs must be the CLEAN (post-redirect) form, caching a
   redirected response and serving it to a navigation request makes
   Chrome fail the whole navigation with ERR_FAILED. */
const PRECACHE = [
  '/partials.js',
  '/shared.css',
  '/shared.js',
  '/assets/fonts/Glorida.woff2',
  '/favicon.svg',
  '/offline.html',
  '/',
  '/products',
  '/product-detail',
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

/* ── ACTIVATE, purge old caches ────────────────────────── */
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
  if (url.includes('triakar.onrender.com')) return;   // API, always network
  if (url.includes('supabase.co')) return;            // Supabase, always network
  if (url.includes('razorpay.com')) return;           // Payments, always network
  if (url.includes('googletagmanager.com')) return;   // Analytics, skip

  /* HTML + app shell (CSS / JS): Stale-While-Revalidate, serve the cached
     copy instantly (no network wait between pages), refresh it in the
     background. Deploys still reach users: CACHE_VER bumps re-fetch
     everything and the controllerchange hook reloads once. */
  var isHTML = req.headers.get('accept') && req.headers.get('accept').includes('text/html');
  if (isHTML || /\.(?:css|js)(?:\?|$)/.test(url)) {
    e.respondWith(
      caches.match(req).then(function(maybeCached) {
        /* Never serve a redirected response to a navigation, Chrome
           rejects it (ERR_FAILED) because navigations use redirect:manual */
        var cached = (maybeCached && maybeCached.redirected) ? undefined : maybeCached;
        var network = fetch(req).then(function(res) {
          if (res && res.status === 200 && res.type !== 'opaque' && !res.redirected) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
          }
          return res;
        }).catch(function() {
          if (cached) return cached;
          if (isHTML) {
            return caches.match('/offline.html').then(function(off) {
              return off || new Response('<meta http-equiv="refresh" content="2">Reconnecting…', { status: 503, headers: { 'Content-Type': 'text/html' } });
            });
          }
          /* never resolve undefined, that surfaces as ERR_FAILED ("site can't be reached") */
          return new Response('', { status: 503 });
        });
        return cached || network;
      })
    );
    return;
  }

  /* Other static assets (fonts, images, favicon): Cache-first */
  e.respondWith(
    caches.match(req).then(function(cached) {
      if (cached && !cached.redirected) return cached;
      return fetch(req).then(function(res) {
        if (!res || res.status !== 200 || res.type === 'opaque' || res.redirected) return res;
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        return res;
      });
    })
  );
});
