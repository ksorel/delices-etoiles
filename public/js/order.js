// ════════════════════════════════════════════════════════════
//  order.js — Soumission des commandes vers Firestore
// ════════════════════════════════════════════════════════════

import { createOrder } from './db.js';
import { getLang }     from './i18n.js';

// ─── Total du panier (article + ses upsells payants, ×qty) ─
// Les upsells (accompagnement/boisson) ont leur propre prix mais sont
// stockés sur la ligne article (item.upsells), pas additionnés à
// item.price : il faut les inclure explicitement dans tout calcul de total.
export function computeTotal(items) {
  return items.reduce((s, item) => {
    const upsellsTotal = (item.upsells || []).reduce((u, up) => u + (up.price || 0), 0);
    return s + (item.price + upsellsTotal) * item.qty;
  }, 0);
}

// ─── Sérialiser les articles du panier ───────────────────
export function serializeItems(items, lang = 'fr') {
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
export async function submitSalleOrder(tableId, clientUid, operateur = 'especes', sessionId = null, cartItems = [], saisieParServeur = false) {
  if (!cartItems.length) throw new Error('Panier vide');

  const lang  = getLang();
  const lines = serializeItems(cartItems, lang);
  const total = computeTotal(cartItems);

  const orderId = await createOrder({
    type:          'salle',
    tableId,
    sessionId,
    clientUid,
    items:         lines,
    itemIds:       cartItems.map(i => i.id),
    total,
    comment:       '',
    operateur,
    paymentStatus: operateur !== 'especes' ? 'awaiting_payment' : 'pending_cash',
    saisieParServeur: !!saisieParServeur,
  });

  return orderId;
}

// ─── Commande livraison ───────────────────────────────────
export async function submitLivraisonOrder(livraison, clientUid, cartItems = []) {
  if (!cartItems.length) throw new Error('Panier vide');

  const lang       = getLang();
  const lines      = serializeItems(cartItems, lang);
  const sous_total = computeTotal(cartItems);
  const total      = sous_total + (livraison.fraisLivraison || 0);

  const orderId = await createOrder({
    type:      'livraison',
    clientUid,
    items:     lines,
    itemIds:   cartItems.map(i => i.id),
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
