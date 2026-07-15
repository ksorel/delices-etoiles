// ════════════════════════════════════════════════════════════
//  fcm.js — Firebase Cloud Messaging (notifications push)
//  Utilisé uniquement sur la page de suivi de commande
// ════════════════════════════════════════════════════════════

import { getMessaging, getToken, onMessage } from
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import app from './config.js';
import { db } from './config.js';
import { doc, updateDoc } from
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Clé VAPID (Console Firebase → Paramètres du projet → Cloud Messaging
// → Certificats Web Push). Clé publique — sans risque à exposer côté client.
const VAPID_KEY = 'BNNsjHCh0DZFhGKfGDiB21VfNS2qJSjmA1QUGebJCdx3np3LwLHtMB59irXOX1H_GORj6ylyNucCViF47_hU368';

let _messaging = null;

function getMsg() {
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

/**
 * Demander la permission + enregistrer le token FCM
 * Sauvegarde le token dans la commande Firestore
 * @param {string} orderId
 * @returns {string|null} fcmToken
 */
export async function requestNotificationPermission(orderId) {
  if (!('Notification' in window)) return null;
  if (VAPID_KEY === 'REMPLACE_PAR_TA_CLE_VAPID') {
    console.warn('[FCM] Clé VAPID non configurée');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // Enregistrer le SW messaging
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(getMsg(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });

    if (token && orderId) {
      // Sauvegarder le token dans la commande pour que la Cloud Function l'utilise
      await updateDoc(doc(db, 'commandes', orderId), { fcmToken: token });
    }
    return token;
  } catch (e) {
    console.warn('[FCM] Erreur:', e.message);
    return null;
  }
}

/**
 * Écouter les messages FCM au premier plan
 * @param {function} callback - appelé avec le payload
 */
export function listenForegroundMessages(callback) {
  try {
    return onMessage(getMsg(), callback);
  } catch (e) {
    console.warn('[FCM] onMessage error:', e.message);
    return () => {};
  }
}
