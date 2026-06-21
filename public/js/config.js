// ════════════════════════════════════════════════════════════
//  config.js — Configuration Firebase — Délices Étoiles
// ════════════════════════════════════════════════════════════

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getStorage }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const firebaseConfig = {
  apiKey:            "AIzaSyCU4Mqn6Wfyy5irKh9DpVoXFasx2N0-gGE",
  authDomain:        "delices-etoiles.firebaseapp.com",
  projectId:         "delices-etoiles",
  storageBucket:     "delices-etoiles.firebasestorage.app",
  messagingSenderId: "795728972354",
  appId:             "1:795728972354:web:50403340daee555d66fbdb"
};

const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
export default app;

// ════════════════════════════════════════════════════════════
//  Résolution de l'établissement courant (multi-lieu)
//
//  Le QR de table encode `?resto=<lieu>&table=<n>`.
//  Les liens marketing / portail peuvent aussi porter `?resto=<lieu>`.
//  Défaut : 'bassam' (l'historique des données existantes).
//
//  ⚠️ WHITELIST : ajouter ici tout nouveau lieu. La validation contre
//  cette liste empêche aussi un restoId arbitraire injecté via l'URL.
//  db.js importe INITIAL_RESTO_ID comme valeur de départ — pas d'import
//  inverse (config → db) pour éviter toute dépendance circulaire.
// ════════════════════════════════════════════════════════════

export const RESTO_IDS = ['bassam', 'abobo', 'ebimpe'];

function resolveRestoId() {
  try {
    const p = new URLSearchParams(window.location.search);
    let r = (p.get('resto') || '').trim().toLowerCase();
    if (r === 'ebimpé') r = 'ebimpe';   // tolérance accent
    if (RESTO_IDS.includes(r)) return r;
  } catch (_) {
    // pas de window (contexte non-navigateur) → défaut
  }
  return 'bassam';
}

// Valeur initiale, figée au chargement du module.
// Le changement de lieu à chaud (propriétaire dans l'admin) passe par
// setRestoId() exporté depuis db.js.
export const INITIAL_RESTO_ID = resolveRestoId();
