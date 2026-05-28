// ════════════════════════════════════════════════════════════
//  Service Worker v13 — Délices Étoiles
// ════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v13';
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

  if (!url.startsWith('http')) return;
  if (e.request.method !== 'GET') return;
  if (url.includes('firestore.googleapis.com')) return;
  if (url.includes('identitytoolkit.googleapis.com')) return;
  if (url.includes('securetoken.googleapis.com')) return;
  if (url.includes('gstatic.com')) return;
  if (url.includes('cloudfunctions.net')) return;

  // Images Firebase Storage : cache-first
  if (url.includes('firebasestorage.googleapis.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone(); // clone AVANT d'utiliser res
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // JS et CSS : toujours réseau, jamais de cache
  if (url.includes('/js/') || url.includes('/css/') ||
      url.endsWith('.js') || url.endsWith('.css')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // HTML : network-first avec fallback cache
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone(); // clone AVANT d'utiliser res
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
