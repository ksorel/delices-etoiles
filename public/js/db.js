// ════════════════════════════════════════════════════════════
//  db.js — Helpers Firestore
//  Toutes les opérations en base passent par ce module
//
//  MULTI-ÉTABLISSEMENT (Bassam / Abobo / Ebimpé / …) :
//  - Les collections RESTAURANT sont filtrées par restoId.
//  - Le module garde un "restoId courant" (setRestoId), posé par
//    le résolveur de lieu au démarrage (URL/QR), défaut 'bassam'.
//  - Chaque helper resto accepte un override explicite en dernier
//    argument (utile au propriétaire qui consolide plusieurs lieux).
//  - Le TRAITEUR est CENTRAL : il ne passe pas par restoId. Ses zones
//    sont séparées (fetchZonesTraiteur → /zones-traiteur, "Zone A").
// ════════════════════════════════════════════════════════════

import { db, INITIAL_RESTO_ID } from './config.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Établissement courant ───────────────────────────────
// Valeur initiale résolue par config.js (depuis l'URL/QR, défaut 'bassam').
// setRestoId() permet au propriétaire de basculer de lieu à chaud (admin).
// Toutes les requêtes resto s'y réfèrent par défaut.
let _currentRestoId = INITIAL_RESTO_ID;

export function setRestoId(restoId) {
  if (restoId) _currentRestoId = restoId;
}
export function getRestoId() {
  return _currentRestoId;
}
// Résout le restoId effectif : override explicite sinon courant.
function rid(override) {
  return override || _currentRestoId;
}

// ─── Menu ────────────────────────────────────────────────
// Catalogue partagé (menus/{id} : nom, description, photo, catégorie…) +
// disponibilité/prix par établissement (menu-dispo/{id}_{restoId}). Un
// article du catalogue n'apparaît que s'il a une fiche dispo pour ce lieu.
// Repli : un article pas encore migré (ancien format, restoId directement
// sur menus/{id}) reste utilisable tel quel le temps de la migration.
export async function fetchMenu(restoId) {
  const targetResto = rid(restoId);
  const [catalogSnap, dispoSnap] = await Promise.all([
    getDocs(collection(db, 'menus')),
    getDocs(query(collection(db, 'menu-dispo'), where('restoId', '==', targetResto))),
  ]);

  const dispoByItem = {};
  dispoSnap.docs.forEach(d => { dispoByItem[d.data().menuItemId] = d.data(); });

  const items = [];
  for (const catalogDoc of catalogSnap.docs) {
    const catalog = catalogDoc.data();
    const dispo = dispoByItem[catalogDoc.id];
    if (dispo) {
      items.push(mergeCatalogDispo(catalogDoc.id, catalog, dispo));
    } else if (catalog.restoId === targetResto) {
      items.push({ id: catalogDoc.id, ...catalog }); // pas encore migré
    }
  }
  items.sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.order || 0) - (b.order || 0));
  return items;
}

function mergeCatalogDispo(id, catalog, dispo) {
  const item = {
    id, ...catalog,
    price: dispo.price, prixVariable: dispo.prixVariable,
    available: dispo.available, order: dispo.order,
    avgRating: dispo.avgRating || 0, ratingCount: dispo.ratingCount || 0,
  };
  if (dispo.formats != null) item.formats = dispo.formats;
  if (dispo.stockStatus != null) item.stockStatus = dispo.stockStatus;
  if (dispo.variantePrix && Array.isArray(catalog.variantes)) {
    item.variantes = catalog.variantes.map(v => ({ label: v.label, prix: dispo.variantePrix[v.label] }));
  }
  return item;
}

// ─── Zones de livraison (RESTAURANT, par lieu) ───────────
// ⚠️ Index composite requis : restoId ASC, active ASC
export async function fetchZones(restoId) {
  const q = query(
    collection(db, 'zones-livraison'),
    where('restoId', '==', rid(restoId)),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Zones TRAITEUR (central, "Zone A") ──────────────────
// Jeu de zones propre au traiteur, indépendant des lieux resto.
// Tarif de déplacement calculé depuis la base de production traiteur.
export async function fetchZonesTraiteur() {
  const q = query(collection(db, 'zones-traiteur'), where('active', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Règles upselling (par lieu) ─────────────────────────
export async function fetchUpsellRules(restoId) {
  const q = query(
    collection(db, 'upselling-rules'),
    where('restoId', '==', rid(restoId))
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


// ─── Établissements / lieux ──────────────────────────────
// Source unique des lieux : collection 'restos'. Le propriétaire les gère
// depuis l'admin (ajout, libellé, commune, adresse, activation, ordre).
// restoId = clé technique stable ; la commune n'est qu'une étiquette
// (plusieurs établissements peuvent partager une même commune).

// Lieux ACTIFS, triés — pour le sélecteur client.
// ⚠️ Index composite requis : actif ASC, ordre ASC
export async function fetchLieux() {
  const q = query(
    collection(db, 'restos'),
    where('actif', '==', true),
    orderBy('ordre')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Un lieu précis (par son restoId) — pour afficher le nom courant.
export async function fetchLieu(restoId) {
  const snap = await getDoc(doc(db, 'restos', restoId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// TOUS les lieux (actifs ou non) — pour l'admin.
export async function fetchAllLieux() {
  const snap = await getDocs(query(collection(db, 'restos'), orderBy('ordre')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Créer / mettre à jour un lieu (merge — ne réécrit que les champs fournis).
export async function saveLieu(restoId, data) {
  await setDoc(doc(db, 'restos', restoId), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Activer / désactiver un lieu (le retire du sélecteur client sans suppression).
export async function setLieuActif(restoId, actif) {
  await updateDoc(doc(db, 'restos', restoId), { actif, updatedAt: serverTimestamp() });
}

// ─── Sessions de table ───────────────────────────────────

// Générer un ID de session court (6 chars)
function genSessionId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Créer une nouvelle session sur une table
export async function createSession(tableId, clientUid, restoId) {
  const sessionId = genSessionId();
  await setDoc(doc(db, 'sessions', sessionId), {
    sessionId,
    restoId:   rid(restoId),
    tableId,
    clientUid,
    status:    'ouverte',     // ouverte | payee | cloturee
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return sessionId;
}

// Récupérer les sessions ouvertes sur une table
// ⚠️ La table 5 existe dans plusieurs lieux → restoId indispensable ici.
// ⚠️ Index composite requis : restoId ASC, tableId ASC, status ASC, createdAt ASC
export async function getOpenSessions(tableId, restoId) {
  const q = query(
    collection(db, 'sessions'),
    where('restoId', '==', rid(restoId)),
    where('tableId', '==', tableId),
    where('status', '==', 'ouverte'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Mettre à jour le statut d'une session
export async function updateSessionStatus(sessionId, status) {
  await updateDoc(doc(db, 'sessions', sessionId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

// Récupérer toutes les commandes d'une session
// (sessionId est déjà unique → pas de filtre restoId nécessaire)
export async function getSessionOrders(sessionId) {
  const q = query(
    collection(db, 'commandes'),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Écouter toutes les sessions ouvertes (dashboard d'un lieu)
// ⚠️ Index composite requis : restoId ASC, status ASC, createdAt DESC
export function listenOpenSessions(callback, restoId) {
  const q = query(
    collection(db, 'sessions'),
    where('restoId', '==', rid(restoId)),
    where('status', '==', 'ouverte'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => { if (err.code !== 'permission-denied') console.error(err); });
}

// ─── Table session ───────────────────────────────────────
// ⚠️ Le doc est namespacé par lieu pour éviter la collision des numéros
// de table entre établissements : id = `${restoId}-${tableId}`.
// Les QR codes doivent encoder ce tableId namespacé (ou restoId + tableId).
export async function getOrCreateTable(tableId, restoId) {
  const r = rid(restoId);
  const docId = r + '-' + tableId;
  const ref = doc(db, 'tables', docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      number:    tableId,
      restoId:   r,
      status:    'active',
      createdAt: serverTimestamp(),
    });
  }
  return { id: docId, restoId: r, ...snap.data() };
}

// ─── Créer une commande ──────────────────────────────────
// Le restoId est injecté si absent (filet de sécurité).
export async function createOrder(orderData) {
  const ref = await addDoc(collection(db, 'commandes'), {
    restoId:   orderData.restoId || _currentRestoId,
    ...orderData,
    status:    'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Avis clients sur un article (par établissement) ─────
// ID déterministe {restoId}_{menuId}_{uid} : au plus 1 avis par client/plat/lieu.
function avisId(restoId, menuId, uid) { return restoId + '_' + menuId + '_' + uid; }

// L'avis existe-t-il déjà pour ce client sur ce plat/lieu ?
export async function getExistingAvis(restoId, menuId, uid) {
  const snap = await getDoc(doc(db, 'avis', avisId(restoId, menuId, uid)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Le client a-t-il déjà commandé ce plat dans cet établissement ?
// (condition pour pouvoir laisser un avis — "achat vérifié")
export async function hasVerifiedPurchase(restoId, menuId, uid) {
  const q = query(
    collection(db, 'commandes'),
    where('restoId', '==', restoId),
    where('clientUid', '==', uid),
    where('itemIds', 'array-contains', menuId),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function submitAvis({ restoId, menuId, uid, rating, comment, prenom }) {
  const id = avisId(restoId, menuId, uid);
  await setDoc(doc(db, 'avis', id), {
    restoId, menuId,
    clientUid: uid,
    rating,
    comment: (comment || '').slice(0, 300),
    prenom:  (prenom  || '').slice(0, 40),
    status:  'visible',
    createdAt: serverTimestamp(),
  });
  return id;
}

// Derniers avis publiés pour un article, dans un établissement.
export async function fetchAvisForItem(restoId, menuId, maxCount = 10) {
  const q = query(
    collection(db, 'avis'),
    where('restoId', '==', restoId),
    where('menuId', '==', menuId),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Réservations de table ───────────────────────────────
export async function submitReservation(data, restoId) {
  const ref = await addDoc(collection(db, 'reservations'), {
    ...data,
    restoId:   rid(restoId),
    tenantId:  'delices-etoiles',
    status:    'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
// Dashboard : écoute des réservations d'un établissement.
export function listenReservations(callback, restoId) {
  const conds = [orderBy('createdAt', 'desc')];
  if (restoId) conds.unshift(where('restoId', '==', rid(restoId)));
  const q = query(collection(db, 'reservations'), ...conds);
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (err.code !== 'permission-denied') console.error('reservations:', err); });
}
export async function updateReservationStatus(id, status) {
  await updateDoc(doc(db, 'reservations', id), { status, updatedAt: serverTimestamp() });
}

// ─── Dashboard staff : écoute temps réel (par lieu) ──────
// ⚠️ Index composites requis (restoId en 1re position) :
//    restoId+createdAt, restoId+status+createdAt, restoId+type+createdAt
export function listenOrders(callback, filters = {}, restoId) {
  let q = collection(db, 'commandes');

  // restoId d'abord, puis les filtres optionnels, puis l'ordre.
  const conditions = [orderBy('createdAt', 'desc')];
  if (filters.status)  conditions.unshift(where('status', '==', filters.status));
  if (filters.type)    conditions.unshift(where('type',   '==', filters.type));
  conditions.unshift(where('restoId', '==', rid(restoId)));

  q = query(q, ...conditions);
  return onSnapshot(q, snap => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(orders);
  });
}

// ─── Mettre à jour le statut d'une commande ──────────────
export async function updateOrderStatus(orderId, status) {
  await updateDoc(doc(db, 'commandes', orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

// ─── Admin : mettre à jour une zone de livraison ─────────
export async function updateZone(zoneId, data) {
  await updateDoc(doc(db, 'zones-livraison', zoneId), data);
}


// ─── Plat du jour (par lieu) ─────────────────────────────
// Le carrousel "menu-du-jour" était un doc à ID FIXE → collision entre
// lieux. On namespace l'ID par restoId.
// Carrousel d'accueil (global, transverse aux établissements).
// Retourne { actif, slides:[{url,...}] } ou null si le document n'existe pas.
export async function fetchAccueilCarousel() {
  try {
    const snap = await getDoc(doc(db, 'config', 'accueil'));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) { console.warn('Carrousel accueil:', e); return null; }
}

export async function fetchPlatDuJour(restoId) {
  const r = rid(restoId);
  try {
    // 1. Menu du jour carrousel (doc fixe par lieu)
    const menuDoc = await getDoc(doc(db, 'plat-du-jour', 'menu-du-jour-' + r));
    if (menuDoc.exists() && menuDoc.data().slides && menuDoc.data().slides.length) {
      return { id: menuDoc.id, isCarousel: true, ...menuDoc.data() };
    }
    // 2. Fallback : ancien format plat du jour unique (scopé au lieu)
    // ⚠️ Index composite requis : restoId ASC, active ASC, updatedAt DESC
    const q = query(
      collection(db, 'plat-du-jour'),
      where('restoId', '==', r),
      where('active', '==', true),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      id:         snap.docs[0].id,
      name_fr:    data.name_fr  || '',
      name_en:    data.name_en  || '',
      price:      data.price    || 0,
      imageUrl:   data.imageUrl || '',
      description_fr: data.description_fr || '',
      menuItemId: data.menuItemId || null,
      ...data,
    };
  } catch (e) {
    console.info('platDuJour non disponible:', e.code);
    return null;
  }
}


// ⚠️ BUG CORRIGÉ : l'ancienne version désactivait TOUS les plats du jour
// actifs (active==true) sans filtre de lieu. En multi-lieu, publier le plat
// du jour de Bassam aurait désactivé celui d'Abobo et Ebimpé. On scope la
// désactivation au lieu concerné.
export async function setPlatDuJour(data, restoId) {
  const r = rid(restoId);
  // Désactiver l'ancien plat du jour DE CE LIEU UNIQUEMENT
  const q = query(
    collection(db, 'plat-du-jour'),
    where('restoId', '==', r),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  const batch = (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { active: false }));
  await batch.commit();
  // Créer le nouveau
  await addDoc(collection(db, 'plat-du-jour'), {
    restoId: r,
    ...data,
    active: true,
    updatedAt: serverTimestamp(),
  });
}


// ─── Suivi commande en temps réel ────────────────────────
// (par orderId unique → pas de filtre restoId nécessaire)
export function listenOrder(orderId, callback) {
  let unsub = null;
  let retryCount = 0;

  function start() {
    unsub = onSnapshot(
      doc(db, 'commandes', orderId),
      snap => {
        retryCount = 0; // reset on success
        if (snap.exists()) callback({ id: snap.id, ...snap.data() });
      },
      err => {
        console.warn('listenOrder error:', err.code);
        if (err.code === 'permission-denied' && retryCount < 3) {
          retryCount++;
          // Retry after short delay (token may not be ready yet)
          setTimeout(function() {
            if (unsub) { try { unsub(); } catch(e) {} }
            start();
          }, 2000 * retryCount);
        }
      }
    );
  }

  start();
  // Return unsubscribe function
  return function() {
    if (unsub) { try { unsub(); } catch(e) {} }
  };
}
// ─── Helpers ─────────────────────────────────────────────
export function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
