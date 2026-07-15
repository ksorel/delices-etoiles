// ════════════════════════════════════════════════════════════
//  order.js — Soumission des commandes vers Firestore
// ════════════════════════════════════════════════════════════

import { createOrder } from './db.js';
import { getLang }     from './i18n.js';

// ─── Sérialiser les articles du panier ───────────────────
function serializeItems(items, lang = 'fr') {
  return items.flatMap(item => {
    const base = {
      id:       item.id,
      name:     lang === 'en' ? (item.name_en || item.name_fr) : item.name_fr,
      price:    item.price,
      qty:      item.qty,
      subtotal: item.price * item.qty,
      glace:    item.glace   || null,
      format:   item.format  || null,
      variant:  item.variant || null,
      comment:  item.comment || '',
    };
    const lines = [base];
    for (const u of item.upsells || []) {
      lines.push({
        id:       u.id,
        name:     lang === 'en' ? (u.name_en || u.name_fr) : u.name_fr,
        price:    u.price,
        qty:      item.qty,
        subtotal: u.price * item.qty,
        parentId: item.id,
        isUpsell: true,
      });
    }
    return lines;
  });
}

// ─── Commande salle ───────────────────────────────────────
export async function submitSalleOrder(tableId, clientUid, operateur = 'especes', sessionId = null, cartItems = []) {
  if (!cartItems.length) throw new Error('Panier vide');

  const lang  = getLang();
  const lines = serializeItems(cartItems, lang);
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  const orderId = await createOrder({
    type:          'salle',
    tableId,
    sessionId,
    clientUid,
    items:         lines,
    total,
    comment:       '',
    operateur,
    paymentStatus: operateur !== 'especes' ? 'awaiting_payment' : 'pending_cash',
  });

  return orderId;
}

// ─── Commande livraison ───────────────────────────────────
export async function submitLivraisonOrder(livraison, clientUid, cartItems = []) {
  if (!cartItems.length) throw new Error('Panier vide');

  const lang       = getLang();
  const lines      = serializeItems(cartItems, lang);
  const sous_total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const total      = sous_total + (livraison.fraisLivraison || 0);

  const orderId = await createOrder({
    type:      'livraison',
    clientUid,
    items:     lines,
    sous_total,
    total,
    livraison: {
      nom:           livraison.nom || null,
      telephone:     livraison.telephone,
      adresse:       livraison.adresse,
      zoneId:        livraison.zoneId,
      zoneName:      livraison.zoneName,
      frais:         livraison.fraisLivraison || 0,
      operateur:     livraison.operateur,
      transactionId: null,
    },
    paymentStatus: 'awaiting_payment',
    comment:       livraison.comment || '',
  });

  return orderId;
}

// ─── Formater FCFA ────────────────────────────────────────
export function formatFCFA(amount) {
  if (!amount || amount === 0) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}
