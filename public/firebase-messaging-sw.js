// ═══════════════════════════════════════════════════════════
//  firebase-messaging-sw.js — Service Worker FCM
//  Gère les notifications en arrière-plan
// ═══════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCU4Mqn6Wfyy5irKh9DpVoXFasx2N0-gGE",
  authDomain:        "delices-etoiles.firebaseapp.com",
  projectId:         "delices-etoiles",
  storageBucket:     "delices-etoiles.firebasestorage.app",
  messagingSenderId: "795728972354",
  appId:             "1:795728972354:web:50403340daee555d66fbdb",
});

const messaging = firebase.messaging();

// Notification reçue en arrière-plan
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Délices Étoiles', {
    body:  body  || 'Votre commande est prête !',
    icon:  icon  || '/img/logo.jpeg',
    badge: '/img/logo.jpeg',
    tag:   'order-update',
    renotify: true,
    data: payload.data || {},
  });
});

// Clic sur la notification → ouvrir l'app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.trackingUrl || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        const existing = clientList.find(c => c.url.includes(self.location.origin));
        if (existing) return existing.focus();
        return clients.openWindow(url);
      })
  );
});
