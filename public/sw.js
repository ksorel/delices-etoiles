// ════════════════════════════════════════════════════════════
//  Service Worker v11 — Délices Étoiles
//  Stratégie : Network-first pour JS/CSS, cache pour images
// ════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v11';
const CACHE         = 'delices-' + CACHE_VERSION;

// ── Install : pas de précache pour éviter les blocages ───────
self.addEventListener('install', e => {
  // Activation immédiate sans attendre la fermeture des onglets
  self.skipWaiting();
});

// ── Activate : supprimer tous les anciens caches ─────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // Prendre contrôle immédiatement
  );
});

// ── Fetch : Network-first pour tout sauf images Storage ──────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Ignorer les requêtes non-HTTP et Firebase
  if (!url.startsWith('http')) return;
  if (url.includes('firestore.googleapis.com')) return;
  if (url.includes('firebase') && !url.includes('web.app')) return;
  if (url.includes('gstatic.com')) return;

  // Images Firebase Storage : cache-first
  if (url.includes('firebasestorage.googleapis.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Ne pas cacher les requêtes POST/PUT/DELETE
  if (e.request.method !== 'GET') return;

  // Tout le reste : NETWORK-FIRST (toujours la version fraîche)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
