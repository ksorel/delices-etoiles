// ════════════════════════════════════════════════════════════
//  db.js — Helpers Firestore
//  Toutes les opérations en base passent par ce module
// ════════════════════════════════════════════════════════════

import { db } from './config.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Menu ────────────────────────────────────────────────
export async function fetchMenu() {
  const snap = await getDocs(collection(db, 'menus'));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return items.sort((a, b) => {
    if (a.category < b.category) return -1;
    if (a.category > b.category) return 1;
    return (a.order || 0) - (b.order || 0);
  });
}

// ─── Zones de livraison ──────────────────────────────────
export async function fetchZones() {
  const q = query(collection(db, 'zones-livraison'), where('active', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Règles upselling ────────────────────────────────────
export async function fetchUpsellRules() {
  const snap = await getDocs(collection(db, 'upselling-rules'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


// ─── Sessions de table ───────────────────────────────────

// Générer un ID de session court (6 chars)
function genSessionId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Créer une nouvelle session sur une table
export async function createSession(tableId, clientUid) {
  const sessionId = genSessionId();
  await setDoc(doc(db, 'sessions', sessionId), {
    sessionId,
    tableId,
    clientUid,
    status:    'ouverte',     // ouverte | payee | cloturee
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return sessionId;
}

// Récupérer les sessions ouvertes sur une table
export async function getOpenSessions(tableId) {
  const q = query(
    collection(db, 'sessions'),
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
export async function getSessionOrders(sessionId) {
  const q = query(
    collection(db, 'commandes'),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Écouter toutes les sessions ouvertes (dashboard)
export function listenOpenSessions(callback) {
  const q = query(
    collection(db, 'sessions'),
    where('status', '==', 'ouverte'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => { if (err.code !== 'permission-denied') console.error(err); });
}

// ─── Table session ───────────────────────────────────────
export async function getOrCreateTable(tableId) {
  const ref = doc(db, 'tables', tableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      number:    tableId,
      status:    'active',
      createdAt: serverTimestamp(),
    });
  }
  return { id: tableId, ...snap.data() };
}

// ─── Créer une commande ──────────────────────────────────
export async function createOrder(orderData) {
  const ref = await addDoc(collection(db, 'commandes'), {
    ...orderData,
    status:    'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Dashboard staff : écoute temps réel ────────────────
export function listenOrders(callback, filters = {}) {
  let q = collection(db, 'commandes');

  const conditions = [orderBy('createdAt', 'desc')];
  if (filters.status)  conditions.unshift(where('status', '==', filters.status));
  if (filters.type)    conditions.unshift(where('type',   '==', filters.type));

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

// ─── Admin : toggle disponibilité item menu ──────────────
export async function toggleItemAvailability(itemId, available) {
  await updateDoc(doc(db, 'menus', itemId), { available });
}

// ─── Admin : mettre à jour une zone de livraison ─────────
export async function updateZone(zoneId, data) {
  await updateDoc(doc(db, 'zones-livraison', zoneId), data);
}


// ─── Plat du jour ────────────────────────────────────────
export async function fetchPlatDuJour() {
  try {
    // 1. Chercher le menu du jour carrousel (document fixe 'menu-du-jour')
    const menuDoc = await getDoc(doc(db, 'plat-du-jour', 'menu-du-jour'));
    if (menuDoc.exists() && menuDoc.data().slides && menuDoc.data().slides.length) {
      return { id: menuDoc.id, isCarousel: true, ...menuDoc.data() };
    }
    // 2. Fallback : ancien format plat du jour unique
    const q = query(
      collection(db, 'plat-du-jour'),
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


export async function setPlatDuJour(data) {
  // Désactiver l'ancien plat du jour
  const q = query(collection(db, 'plat-du-jour'), where('active', '==', true));
  const snap = await getDocs(q);
  const batch = (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { active: false }));
  await batch.commit();
  // Créer le nouveau
  await addDoc(collection(db, 'plat-du-jour'), {
    ...data,
    active: true,
    updatedAt: serverTimestamp(),
  });
}


// ─── Suivi commande en temps réel ────────────────────────
export function listenOrder(orderId, callback) {
  return onSnapshot(
    doc(db, 'commandes', orderId),
    snap => { if (snap.exists()) callback({ id: snap.id, ...snap.data() }); },
    err  => { console.info('listenOrder error:', err.code); }
  );
}
// ─── Helpers ─────────────────────────────────────────────
export function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
