// ════════════════════════════════════════════════════════════
//  Service Worker v12 — Délices Étoiles
//  JS/CSS : toujours réseau (jamais mis en cache)
//  Images Storage : cache-first
// ════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v12';
const CACHE         = 'delices-' + CACHE_VERSION;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Ignorer non-HTTP, Firebase APIs, CDN
  if (!url.startsWith('http')) return;
  if (e.request.method !== 'GET') return;
  if (url.includes('firestore.googleapis.com')) return;
  if (url.includes('identitytoolkit.googleapis.com')) return;
  if (url.includes('securetoken.googleapis.com')) return;
  if (url.includes('gstatic.com')) return;
  if (url.includes('cloudfunctions.net')) return;

  // Images Firebase Storage : cache-first (les images ne changent pas)
  if (url.includes('firebasestorage.googleapis.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // JS et CSS : TOUJOURS réseau, jamais de cache
  // Cela garantit que la dernière version est toujours servie
  if (url.includes('/js/') || url.includes('/css/') ||
      url.endsWith('.js') || url.endsWith('.css')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request)) // fallback cache si hors ligne
    );
    return;
  }

  // HTML et autres : network-first avec fallback cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
