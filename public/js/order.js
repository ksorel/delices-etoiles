// ════════════════════════════════════════════════════════════
//  order.js — Soumission des commandes vers Firestore
// ════════════════════════════════════════════════════════════

import { createOrder } from './db.js';
// Fonctions panier — accès via window (définies dans app.js)
function getItems()  { return window._getCartItems ? window._getCartItems() : []; }
function getTotal()  { return window._getCartTotal ? window._getCartTotal() : 0; }
function clearCart() { if (window._clearCart) window._clearCart(); }
function serializeItems(lang = 'fr') {
  const items = window._serializeCartItems ? window._serializeCartItems(lang) : getItems();
  if (window._serializeCartItems) return items; // already serialized
  // fallback manual serialization
  return items.flatMap(item => {
    const base = {
      id: item.id, name: lang === 'en' ? item.name_en : item.name_fr,
      price: item.price, qty: item.qty, subtotal: item.price * item.qty,
      glace: item.glace, format: item.format, comment: item.comment,
    };
    const lines = [base];
    for (const u of item.upsells || []) {
      lines.push({
        id: u.id, name: lang === 'en' ? (u.name_en || u.name_fr) : u.name_fr,
        price: u.price, qty: item.qty, subtotal: u.price * item.qty,
        parentId: item.id, isUpsell: true,
      });
    }
    return lines;
  });
}
import { getLang } from './i18n.js';

/**
 * Soumet une commande salle (QR Code)
 * @param {string} tableId
 * @param {string} clientUid
 * @returns {string} orderId
 */
export async function submitSalleOrder(tableId, clientUid, operateur = 'especes') {
  const items = getItems();
  if (!items.length) throw new Error('Panier vide');

  const lang  = getLang();
  const lines = serializeItems(lang);
  const total = getTotal();

  const isMobileMoney = operateur !== 'especes';

  const orderId = await createOrder({
    type:          'salle',
    tableId,
    clientUid,
    items:         lines,
    total,
    comment:       '',
    operateur,
    paymentStatus: isMobileMoney ? 'awaiting_payment' : 'pending_cash',
    // pending_cash   = en attente de paiement espèces (staff valide)
    // awaiting_payment = en attente de confirmation Mobile Money
  });

  clearCart();
  return orderId;
}

/**
 * Soumet une commande livraison
 * @param {Object} livraison - { nom, telephone, adresse, zoneId, zoneName, fraisLivraison, operateur }
 * @param {string} clientUid
 * @returns {string} orderId
 */
export async function submitLivraisonOrder(livraison, clientUid) {
  const items = getItems();
  if (!items.length) throw new Error('Panier vide');

  const lang  = getLang();
  const lines = serializeItems(lang);
  const sous_total = getTotal();
  const total = sous_total + livraison.fraisLivraison;

  const orderId = await createOrder({
    type:      'livraison',
    clientUid,
    items:     lines,
    sous_total,
    total,
    livraison: {
      nom:        livraison.nom,
      telephone:  livraison.telephone,
      adresse:    livraison.adresse,
      zoneId:     livraison.zoneId,
      zoneName:   livraison.zoneName,
      frais:      livraison.fraisLivraison,
      operateur:  livraison.operateur,
      transactionId: null,         // Mis à jour par le webhook Mobile Money
    },
    paymentStatus: 'awaiting_payment',
    comment: livraison.comment || '',
  });

  clearCart();
  return orderId;
}

/**
 * Formate un montant en FCFA
 */
export function formatFCFA(amount) {
  if (!amount || amount === 0) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}
