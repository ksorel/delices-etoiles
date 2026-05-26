// ════════════════════════════════════════════════════════════
//  order.js — Soumission des commandes vers Firestore
// ════════════════════════════════════════════════════════════

import { createOrder } from './db.js';
import { getItems, getTotal, serializeItems, clearCart } from './cart.js';
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
