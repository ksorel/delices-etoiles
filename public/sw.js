// ════════════════════════════════════════════════════════════
//  Service Worker — Délices Étoiles
//  Stratégie : Network-first pour tout sauf images Storage
//  ⚠️  Incrémente CACHE_VERSION à chaque déploiement majeur
// ════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v8';
const CACHE         = 'delices-' + CACHE_VERSION;

// Assets à pré-cacher (shell minimaliste uniquement)
const PRECACHE = [
  '/offline.html',
];

// ── Install ───────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate : purge des anciens caches ───────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('delices-') && k !== CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Messages ──────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING')  self.skipWaiting();
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => e.ports[0]?.postMessage({ success: true }));
  }
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;

  // Ignorer : non-GET, extensions, Firebase API
  if (request.method !== 'GET')          return;
  if (url.startsWith('chrome-extension')) return;
  if (url.includes('googleapis.com'))    return;
  if (url.includes('gstatic.com'))       return;
  if (url.includes('firebasestorage'))   return; // Storage géré séparément

  // ── HTML : NETWORK ONLY ────────────────────────────────
  // Toujours récupérer le HTML depuis le réseau (pas de cache)
  // Cela évite les problèmes de version stale lors d'un scan QR
  if (request.headers.get('accept')?.includes('text/html') ||
      url.endsWith('/') || url.includes('/?') || url.includes('/dashboard') || url.includes('/admin')) {
    e.respondWith(
      fetch(request)
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // ── JS / CSS : NETWORK FIRST, cache 24h ───────────────
  if (url.includes('/js/') || url.includes('/css/') || url.endsWith('.js') || url.endsWith('.css')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ── Autres assets (images locales, manifest) ──────────
  e.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      });
      return cached || network;
    }).catch(() => caches.match('/offline.html'))
  );
});
