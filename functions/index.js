// ════════════════════════════════════════════════════════════
//  Cloud Functions — Délices Étoiles
//  Région : europe-west1 (latence réduite depuis CI)
// ════════════════════════════════════════════════════════════

const functions = require('firebase-functions/v1');
const admin     = require('firebase-admin');
const axios     = require('axios');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

const region = functions.region('europe-west1');
const fcfa   = n => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

// Origines autorisées pour les endpoints HTTP (onRequest) exposés au portail
// client : Access-Control-Allow-Origin n'accepte qu'une seule valeur, donc on
// reflète l'origine de la requête si elle est dans cette liste.
const ALLOWED_ORIGINS = [
  'https://delices-etoiles.ci',
  'https://www.delices-etoiles.ci',
  'https://delices-etoiles.web.app',
  'https://delices-etoiles.firebaseapp.com',
];
function setCorsOrigin(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.set('Access-Control-Allow-Origin', origin);
}

// ─────────────────────────────────────────────────────────
//  HELPER : vérifier que l'appelant est admin (global) OU gérant
//  (limité à son propre établissement — gestion du staff de son resto).
// ─────────────────────────────────────────────────────────
async function checkAdminOrManager(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }
  const role = context.auth.token.role;
  if (role === 'admin')   return { isAdmin: true,  restoId: null };
  if (role === 'manager') return { isAdmin: false, restoId: context.auth.token.restoId || null };
  throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs et gérants');
}

// Pour un gérant : vérifie que l'employé ciblé appartient bien à son
// établissement (jamais le propriétaire, jamais un autre établissement).
// Ne fait rien pour un admin (accès global).
async function assertOwnEstablishmentEmployee(caller, uid) {
  if (caller.isAdmin) return;
  const snap = await db.collection('employees').doc(uid).get();
  if (!snap.exists || snap.data().restoId !== caller.restoId) {
    throw new functions.https.HttpsError('permission-denied', "Cet employé n'appartient pas à votre établissement");
  }
}

// ─────────────────────────────────────────────────────────
//  HELPER : construire les custom claims selon le rôle
//  - 'admin' = PROPRIÉTAIRE : accès global, AUCUN restoId
//  - tous les autres rôles  : rattachés à un établissement (restoId requis)
// ─────────────────────────────────────────────────────────
const STAFF_ROLES = ['manager', 'serveur', 'bar', 'cuisine', 'livreur', 'caissier', 'custom'];
const ALL_ROLES   = ['admin', ...STAFF_ROLES];

// Rôle 'custom' : modules du dashboard staff cochés un par un par le propriétaire
// (employees/{uid}.customPermissions), plutôt qu'une matrice de rôle fixe.
const CUSTOM_TABS  = ['all','pending','preparing','ready','salle','livraison','done','awaiting_payment','expired','reservations'];
const CUSTOM_STATS = ['pending','prep','ready','done','ca'];
function sanitizeCustomPermissions(input) {
  const p = input || {};
  return {
    canOrder:  !!p.canOrder,
    canPay:    !!p.canPay,
    canStatus: !!p.canStatus,
    canPlan:   !!p.canPlan,
    tabs:  Array.isArray(p.tabs)  ? p.tabs.filter(t => CUSTOM_TABS.includes(t))   : [],
    stats: Array.isArray(p.stats) ? p.stats.filter(s => CUSTOM_STATS.includes(s)) : [],
  };
}

// Normalise l'entrée (string unique ou tableau) en tableau de rôles valide.
function normalizeRoles(input) {
  const arr = Array.isArray(input) ? input : (input ? [input] : []);
  const roles = [...new Set(arr.filter(r => ALL_ROLES.includes(r)))];
  if (!roles.length) {
    throw new functions.https.HttpsError('invalid-argument', 'Au moins un rôle valide est requis');
  }
  return roles;
}

// Construit les custom claims.
//  - claim `role` (principal) : conservé pour la sécurité (règles Firestore, checkAdmin).
//    = 'admin' si propriétaire, sinon le 1er rôle.
//  - claim `roles` (tableau)  : pour l'affichage/permissions du dashboard.
//  - 'admin' (PROPRIÉTAIRE) = global, exclusif, aucun restoId.
function buildRoleClaims(input, restoId) {
  let roles = normalizeRoles(input);
  if (roles.includes('admin')) {
    return { role: 'admin', roles: ['admin'] };            // propriétaire : global, exclusif
  }
  if (!restoId) {
    throw new functions.https.HttpsError('invalid-argument',
      "Un établissement (restoId) est requis pour ces rôles");
  }
  return { role: roles[0], roles, restoId };
}

// ─────────────────────────────────────────────────────────
//  0. Recalcul serveur du total d'une commande (anti-falsification)
// ─────────────────────────────────────────────────────────
// La commande est écrite directement par le client (Firestore, pas de Cloud
// Function) et firestore.rules ne valide aucun champ de prix — item.price,
// item.qty, total sont donc entièrement déclaratifs. Ce recalcul, exécuté
// juste après la création, revérifie chaque ligne contre le vrai catalogue
// (menu-dispo/menus) + les frais de livraison contre la vraie zone, et
// corrige le doc si besoin — avant que le staff ne voie/traite la commande.
// La réduction fidélité est revalidée par computeAuthoritativeLoyalty
// ci-dessous (date + % contre la vraie config, pas juste plafonnée).
async function computeAuthoritativeOrderTotal(order) {
  const items   = order.items || [];
  const restoId = order.restoId;
  const corrections = [];
  const catalogCache = {};

  async function getCatalog(itemId) {
    if (itemId in catalogCache) return catalogCache[itemId];
    let data = null;
    try {
      const [catalogSnap, dispoSnap] = await Promise.all([
        db.collection('menus').doc(itemId).get(),
        db.collection('menu-dispo').doc(itemId + '_' + restoId).get(),
      ]);
      if (dispoSnap.exists) {
        data = { ...(catalogSnap.exists ? catalogSnap.data() : {}), ...dispoSnap.data() };
      } else if (catalogSnap.exists) {
        data = catalogSnap.data(); // repli legacy : article pas encore migré vers menu-dispo
      }
    } catch (e) { console.warn('computeAuthoritativeOrderTotal: lookup', itemId, e.message); }
    catalogCache[itemId] = data;
    return data;
  }

  let itemsTotal = 0;
  for (const line of items) {
    const catalog = await getCatalog(line.id);
    if (!catalog) { itemsTotal += (line.price || 0) * (line.qty || 1); continue; } // article introuvable : pas de base fiable, on ne bloque pas la commande
    let expected = catalog.price;
    if (line.variant && Array.isArray(catalog.variantes)) {
      const v = catalog.variantes.find(vv => vv.label === line.variant);
      if (v) expected = v.prix;
    } else if (line.format && catalog.formats) {
      if (line.format === 'demi'  && catalog.formats.demi  != null) expected = catalog.formats.demi;
      if (line.format === 'grand' && catalog.formats.grand != null) expected = catalog.formats.grand;
    }
    if (typeof expected !== 'number') expected = line.price; // fiche incomplète : pas de base fiable
    if (expected !== line.price) {
      corrections.push({ id: line.id, name: line.name, declare: line.price, attendu: expected });
    }
    itemsTotal += expected * (line.qty || 1);
  }

  let deliveryFee = order.livraison?.frais || 0;
  if (order.type === 'livraison' && order.livraison?.zoneId) {
    try {
      const zoneSnap = await db.collection('zones-livraison').doc(order.livraison.zoneId).get();
      if (zoneSnap.exists) {
        const trueFee = zoneSnap.data().frais || 0;
        if (trueFee !== deliveryFee) {
          corrections.push({ id: '_livraison', name: 'Frais de livraison', declare: deliveryFee, attendu: trueFee });
        }
        deliveryFee = trueFee;
      }
    } catch (e) { console.warn('computeAuthoritativeOrderTotal: zone', order.livraison.zoneId, e.message); }
  }

  const loyaltyMontant = await computeAuthoritativeLoyalty(order, itemsTotal);
  if ((order.loyaltyDiscount?.montant || 0) !== loyaltyMontant) {
    corrections.push({ id: '_loyalty', name: 'Réduction fidélité', declare: order.loyaltyDiscount?.montant || 0, attendu: loyaltyMontant });
  }
  const sousTotal    = itemsTotal - loyaltyMontant;
  const expectedTotal = sousTotal + deliveryFee;

  return { expectedTotal, sousTotal, corrections };
}

// Résout la config fidélité effective d'un établissement — miroir serveur de
// fetchLoyaltyConfig (public/js/db.js) : réglage resto s'il est personnalisé
// et actif, sinon repli réseau (config/fidelite-reseau).
async function resolveLoyaltyConfig(restoId) {
  try {
    const restoSnap = await db.collection('config').doc(restoId).get();
    const loyalty = restoSnap.exists ? restoSnap.data().loyalty : null;
    if (loyalty && loyalty.useNetwork === false && loyalty.periodDays > 0) return loyalty;
  } catch (e) { console.warn('resolveLoyaltyConfig: resto', restoId, e.message); }
  try {
    const netSnap = await db.collection('config').doc('fidelite-reseau').get();
    if (netSnap.exists && netSnap.data().periodDays > 0) return netSnap.data();
  } catch (e) { console.warn('resolveLoyaltyConfig: reseau', e.message); }
  return null;
}

// Revalide l'éligibilité fidélité déclarée par le client (date + %) au lieu
// de simplement plafonner le montant au sous-total articles (ancien
// comportement, voir audit du 22/08). Si la réduction est accordée, marque
// aussi la récompense comme consommée ici (Admin SDK, hors règles) — le
// client n'a plus le droit d'écrire clients/{tel}.recompenses lui-même
// (firestore.rules), sinon il pouvait forger sa propre éligibilité (date
// arbitraire dans "recompenses" ou "premiereVisite") avant de commander.
async function computeAuthoritativeLoyalty(order, itemsTotal) {
  if (!order.loyaltyDiscount?.montant) return 0;
  const telephone = order.telephone || order.livraison?.telephone || null;
  const restoId    = order.restoId;
  if (!telephone || !restoId) return 0;

  const cfg = await resolveLoyaltyConfig(restoId);
  if (!cfg || cfg.rewardType !== 'reduction' || !(cfg.rewardPercent > 0)) return 0;

  let clientSnap;
  try {
    clientSnap = await db.collection('clients').doc(telephone).get();
  } catch (e) { console.warn('computeAuthoritativeLoyalty: client', telephone, e.message); return 0; }
  if (!clientSnap.exists) return 0;
  const clientData = clientSnap.data();
  const rec = clientData.recompenses?.[restoId];
  const refDate = rec?.derniereRecompenseAt?.toDate?.() || clientData.premiereVisite?.toDate?.() || null;
  if (!refDate) return 0;
  const elapsedDays = (Date.now() - refDate.getTime()) / 86400000;
  if (elapsedDays < cfg.periodDays) return 0;

  const montant = Math.min(Math.round(itemsTotal * cfg.rewardPercent / 100), itemsTotal);
  if (montant > 0) {
    await db.collection('clients').doc(telephone).set({
      recompenses: { [restoId]: { derniereRecompenseAt: admin.firestore.FieldValue.serverTimestamp() } },
    }, { merge: true });
  }
  return montant;
}

// ─────────────────────────────────────────────────────────
//  1. TRIGGER : Nouvelle commande → Notification WhatsApp + stock
// ─────────────────────────────────────────────────────────
// Secrets WHATSAPP_* retirés de runWith() : Sorel n'a pas encore les
// identifiants API WhatsApp (2026-07-29). Un runWith({secrets:[...]}) sur un
// secret jamais créé dans Secret Manager fait échouer TOUT déploiement de
// fonctions (validation faite sur l'ensemble du fichier, pas seulement sur
// la fonction ciblée par --only) — pas seulement celle-ci.
// Pour réactiver la notification une fois les identifiants obtenus :
// 1) npx firebase-tools functions:secrets:set WHATSAPP_TOKEN (+ PHONE_ID, STAFF_NUMBERS)
// 2) rajouter .runWith({ secrets: ['WHATSAPP_TOKEN','WHATSAPP_PHONE_ID','WHATSAPP_STAFF_NUMBERS'] })
//    juste après "region." ci-dessous.
exports.onNewOrder = region.firestore
  .document('commandes/{orderId}')
  .onCreate(async (snap, context) => {
    const order = { id: context.params.orderId, ...snap.data() };

    // Revérifier/corriger le total contre le vrai catalogue avant tout le
    // reste (notif, décompte stock) — voir computeAuthoritativeOrderTotal
    // ci-dessus pour le pourquoi.
    try {
      const { expectedTotal, sousTotal, corrections } = await computeAuthoritativeOrderTotal(order);
      if (corrections.length && expectedTotal !== order.total) {
        console.warn('onNewOrder: total corrigé', order.id, 'déclaré=' + order.total, 'attendu=' + expectedTotal, JSON.stringify(corrections));
        const patch = {
          total: expectedTotal,
          totalOriginal: order.total,
          totalCorrigeAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (order.type === 'livraison') patch.sous_total = sousTotal;
        await snap.ref.update(patch);
        order.total = expectedTotal; // pour que la suite (notif WhatsApp) reflète la bonne valeur
      }
    } catch (e) { console.error('onNewOrder: échec du recalcul du total', order.id, e.message); }

    // Notification WhatsApp — no-op tant que WHATSAPP_TOKEN n'est pas injecté
    // (secret non déclaré ci-dessus). Isolée dans son propre bloc : avant, un
    // "return null" précoce ici sautait aussi le décompte de stock ci-dessous
    // dès que la notif était indisponible — les deux étaient à tort liés.
    if (process.env.WHATSAPP_TOKEN) {
      const staffNumbers = (process.env.WHATSAPP_STAFF_NUMBERS || '').split(',').filter(Boolean);
      if (staffNumbers.length) {
        const itemsList = (order.items || [])
          .map(i => `• ${i.qty}x ${i.name} — ${fcfa(i.price * i.qty)}`)
          .join('\n');
        const msg = order.type === 'salle'
          ? `🍽️ *Nouvelle commande salle*\nTable : ${order.tableId}\n${itemsList}\n*Total : ${fcfa(order.total)}*`
          : `🚴 *Nouvelle livraison*\n${order.deliveryInfo?.name || ''}\n${itemsList}\n*Total : ${fcfa(order.total)}*`;

        for (const number of staffNumbers) {
          try {
            await axios.post(
              `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
              { messaging_product: 'whatsapp', to: number.trim(), type: 'text', text: { body: msg } },
              { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
            );
          } catch (e) { console.error('WhatsApp error:', e.message); }
        }
      }
    }
    // Décrémenter le stock des boissons commandées
    try {
      const items = order.items || [];
      const boissons = items.filter(function(i) {
        return i.category && ['boisson','bar','biere','soda','eau','jus','alcool']
          .some(function(c) { return i.category.toLowerCase().includes(c); });
      });
      for (const item of boissons) {
        // Chercher dans /stocks par nom d'article
        const stockSnap = await db.collection('stocks')
          .where('name', '==', item.name).limit(1).get();
        if (!stockSnap.empty) {
          const stockDoc = stockSnap.docs[0];
          const stockData = stockDoc.data();
          const isCasier  = (stockData.unit || '').toLowerCase().includes('casier');
          // Si le stock est en casiers, convertir les bouteilles commandées
          const deduct    = isCasier ? (item.qty || 1) / 24 : (item.qty || 1);
          const newQty    = Math.max(0, (stockData.qty || 0) - deduct);
          const newQtyRounded = isCasier ? Math.round(newQty * 100) / 100 : Math.floor(newQty);
          await stockDoc.ref.update({
            qty: newQtyRounded,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          // Log mouvement
          await db.collection('stock-movements').add({
            stockId: stockDoc.id,
            name: item.name,
            type: 'sortie',
            qty: item.qty || 1,
            orderId: order.id,
            date: admin.firestore.FieldValue.serverTimestamp()
          });
          // Si stock à 0 → désactiver l'article pour CET établissement
          // (catalogue partagé : menus/{id} = fiche commune, menu-dispo/{id}_{restoId} = dispo par lieu)
          if (newQtyRounded <= 0) {
            const menuSnap = await db.collection('menus')
              .where('name_fr', '==', item.name).limit(1).get();
            if (!menuSnap.empty) {
              const menuId = menuSnap.docs[0].id;
              await db.collection('menu-dispo').doc(menuId + '_' + stockData.restoId).set({
                menuItemId: menuId, restoId: stockData.restoId,
                available: false, stockStatus: 'rupture',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
              console.log('Menu item disabled (stock 0):', item.name);
            }
          }
        }
      }
    } catch(e) { console.error('Stock decrement error:', e.message); }

    return null;
  });

// ─────────────────────────────────────────────────────────
//  2. WEBHOOK : Confirmation paiement Mobile Money
// ─────────────────────────────────────────────────────────
exports.paymentWebhook = region.runWith({ secrets: ['PAYMENT_WEBHOOK_SECRET'] }).https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('paymentWebhook: PAYMENT_WEBHOOK_SECRET non configuré — requête refusée');
    res.status(500).send('Webhook non configuré'); return;
  }
  const secret = req.headers['x-webhook-secret'];
  if (secret !== expectedSecret) {
    res.status(403).send('Forbidden'); return;
  }

  const { orderId, status, amount, operator } = req.body;
  if (!orderId) { res.status(400).send('Missing orderId'); return; }

  try {
    await db.collection('commandes').doc(orderId).update({
      paymentStatus: status === 'success' ? 'paid' : 'failed',
      paymentOperator: operator,
      paymentAmount: amount,
      paymentConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
//  3. CRON : Rapport quotidien par email
// ─────────────────────────────────────────────────────────
exports.dailyReport = region.runWith({ secrets: ['EMAIL_USER', 'EMAIL_PASS', 'EMAIL_DEST'] }).pubsub
  .schedule('59 23 * * *')
  .timeZone('Africa/Abidjan')
  .onRun(async (_context) => {
    if (!process.env.EMAIL_USER) {
      console.warn('Email non configuré — skipping report');
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snap = await db.collection('commandes')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
      .get();

    const orders   = snap.docs.map(d => d.data());
    const total    = orders.reduce((s, o) => s + (o.total || 0), 0);
    const served   = orders.filter(o => o.status === 'done').length;
    const pending  = orders.filter(o => o.status !== 'done').length;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_DEST,
      subject: `Rapport Délices Étoiles — ${today.toLocaleDateString('fr-FR')}`,
      html: `<h2>Rapport du jour</h2>
             <p>Commandes : <strong>${orders.length}</strong></p>
             <p>Servies : <strong>${served}</strong></p>
             <p>En attente : <strong>${pending}</strong></p>
             <p>CA total : <strong>${fcfa(total)}</strong></p>`,
    });

    return null;
  });

// ─────────────────────────────────────────────────────────
//  4. TRIGGER : Notification FCM quand commande prête
// ─────────────────────────────────────────────────────────
exports.onOrderReady = region.firestore
  .document('commandes/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();

    if (before.status === after.status) return null;
    if (after.status !== 'ready') return null;

    const fcmToken = after.fcmToken;
    if (!fcmToken) return null;

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: '🍽️ Votre commande est prête !',
          body: after.type === 'salle'
            ? 'Votre serveur arrive avec votre commande.'
            : 'Votre livreur est en route !',
        },
        data: { orderId: context.params.orderId, status: 'ready' },
      });
    } catch (e) { console.error('FCM error:', e.message); }

    return null;
  });

// ─────────────────────────────────────────────────────────
//  4b. TRIGGER : Notification FCM quand une réservation est confirmée/refusée
// ─────────────────────────────────────────────────────────
exports.onReservationStatusChange = region.firestore
  .document('reservations/{resaId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();

    if (before.status === after.status) return null;
    if (!['confirmed', 'refused'].includes(after.status)) return null;

    const fcmToken = after.fcmToken;
    if (!fcmToken) return null;

    const confirmed = after.status === 'confirmed';
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: confirmed ? '✅ Réservation confirmée' : '❌ Réservation refusée',
          body: confirmed
            ? `Votre réservation du ${after.date || ''} à ${after.heure || ''} est confirmée. À bientôt !`
            : `Votre réservation du ${after.date || ''} à ${after.heure || ''} n'a pas pu être confirmée. Contactez l'établissement pour plus d'informations.`,
        },
        data: { reservationId: context.params.resaId, status: after.status },
      });
    } catch (e) { console.error('FCM réservation error:', e.message); }

    return null;
  });


// ─────────────────────────────────────────────────────────
//  6. TRIGGER : Stock mis à jour → disponibilité menu
// ─────────────────────────────────────────────────────────
exports.onStockUpdate = region.firestore
  .document('stocks/{stockId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();

    // Ignorer si la quantité n'a pas changé
    if (before.qty === after.qty) return null;

    const name   = after.name;
    const newQty = after.qty || 0;

    try {
      // Chercher l'article dans le catalogue, puis sa dispo pour l'établissement de ce stock
      // (catalogue partagé : menus/{id} = fiche commune, menu-dispo/{id}_{restoId} = dispo par lieu)
      const menuSnap = await db.collection('menus')
        .where('name_fr', '==', name).limit(1).get();

      if (menuSnap.empty) return null;

      const menuId    = menuSnap.docs[0].id;
      const dispoRef  = db.collection('menu-dispo').doc(menuId + '_' + after.restoId);
      const dispoSnap = await dispoRef.get();
      const dispoData = dispoSnap.exists ? dispoSnap.data() : {};

      if (newQty === 0 && dispoData.available !== false) {
        // Stock épuisé → désactiver
        await dispoRef.set({
          menuItemId:  menuId, restoId: after.restoId,
          available:   false,
          stockStatus: 'rupture',
          updatedAt:   admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('Article désactivé (rupture):', name);
      } else if (newQty > 0 && dispoData.available === false && dispoData.stockStatus === 'rupture') {
        // Stock réapprovisionné → réactiver
        await dispoRef.set({
          available:   true,
          stockStatus: 'disponible',
          updatedAt:   admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('Article réactivé (stock réapprovisionné):', name);
      }
    } catch(e) {
      console.error('onStockUpdate error:', e.message);
    }

    return null;
  });

// ─────────────────────────────────────────────────────────
//  6b. TRIGGERS : Avis client → agrégation note moyenne (menu-dispo)
// ─────────────────────────────────────────────────────────
// addRating/removeRating : note ajoutée/retirée de l'agrégat (création, suppression,
// ou les deux à la fois pour un changement de note — répartition par étoile incluse,
// comme l'histogramme d'un store).
async function applyAvisChange(restoId, menuId, { addRating, removeRating } = {}) {
  const dispoRef = db.collection('menu-dispo').doc(menuId + '_' + restoId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(dispoRef);
    const data = snap.exists ? snap.data() : {};
    let count = data.ratingCount || 0;
    let sum   = (data.avgRating || 0) * count;
    const breakdown = Object.assign({ 1:0, 2:0, 3:0, 4:0, 5:0 }, data.ratingBreakdown || {});
    if (removeRating) {
      count = Math.max(0, count - 1);
      sum  -= removeRating;
      breakdown[removeRating] = Math.max(0, (breakdown[removeRating] || 0) - 1);
    }
    if (addRating) {
      count += 1;
      sum   += addRating;
      breakdown[addRating] = (breakdown[addRating] || 0) + 1;
    }
    const avg = count === 0 ? 0 : sum / count;
    tx.set(dispoRef, {
      menuItemId: menuId, restoId,
      avgRating:       avg,
      ratingCount:     count,
      ratingBreakdown: breakdown,
      updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

exports.onAvisCreate = region.firestore
  .document('avis/{avisId}')
  .onCreate(async (snap) => {
    const d = snap.data();
    try {
      await applyAvisChange(d.restoId, d.menuId, { addRating: d.rating });
    } catch (e) {
      console.error('onAvisCreate error:', e.message);
    }
    return null;
  });

exports.onAvisUpdate = region.firestore
  .document('avis/{avisId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after  = change.after.data();
    if (before.rating === after.rating) return null;
    try {
      await applyAvisChange(after.restoId, after.menuId, { addRating: after.rating, removeRating: before.rating });
    } catch (e) {
      console.error('onAvisUpdate error:', e.message);
    }
    return null;
  });

exports.onAvisDelete = region.firestore
  .document('avis/{avisId}')
  .onDelete(async (snap) => {
    const d = snap.data();
    try {
      await applyAvisChange(d.restoId, d.menuId, { removeRating: d.rating });
    } catch (e) {
      console.error('onAvisDelete error:', e.message);
    }
    return null;
  });

// ─────────────────────────────────────────────────────────
//  5. GESTION DES UTILISATEURS (admin global, ou gérant scopé à son établissement)
// ─────────────────────────────────────────────────────────

exports.createEmployee = region.https.onCall(async (data, context) => {
  const caller = await checkAdminOrManager(context);
  const { email, password, role, roles, displayName, username, restoId, customPermissions } = data;
  if (!email || !password || (!role && !(Array.isArray(roles) && roles.length))) {
    throw new functions.https.HttpsError('invalid-argument', 'Email, mot de passe et rôle(s) requis');
  }
  let targetRestoId = restoId;
  if (!caller.isAdmin) {
    // Un gérant ne peut créer que du staff de son propre établissement,
    // jamais un compte Propriétaire.
    const requestedRoles = Array.isArray(roles) ? roles : (role ? [role] : []);
    if (requestedRoles.includes('admin')) {
      throw new functions.https.HttpsError('permission-denied', 'Un gérant ne peut pas créer de compte Propriétaire');
    }
    targetRestoId = caller.restoId;
  }
  const claims = buildRoleClaims(roles || role, targetRestoId);   // valide les rôles + restoId
  try {
    const userRecord = await admin.auth().createUser({
      email, password,
      displayName: displayName || email.split('@')[0],
      emailVerified: true,
    });
    await admin.auth().setCustomUserClaims(userRecord.uid, claims);
    await db.collection('employees').doc(userRecord.uid).set({
      uid: userRecord.uid, email,
      username: username || email.replace('@delices-etoiles.staff', ''),
      displayName: displayName || username || email.split('@')[0],
      roles: claims.roles, role: claims.role,
      restoId: claims.restoId || null, active: true,
      ...(claims.roles.includes('custom') ? { customPermissions: sanitizeCustomPermissions(customPermissions) } : {}),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid,
    });
    return { success: true, uid: userRecord.uid };
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Cet email est déjà utilisé');
    }
    throw new functions.https.HttpsError('internal', e.message);
  }
});

exports.updateEmployeeRole = region.https.onCall(async (data, context) => {
  const caller = await checkAdminOrManager(context);
  const { uid, role, roles, restoId, customPermissions } = data;
  if (!uid || (!role && !(Array.isArray(roles) && roles.length))) {
    throw new functions.https.HttpsError('invalid-argument', 'UID et rôle(s) requis');
  }
  await assertOwnEstablishmentEmployee(caller, uid);
  let targetRestoId = restoId;
  if (!caller.isAdmin) {
    const requestedRoles = Array.isArray(roles) ? roles : (role ? [role] : []);
    if (requestedRoles.includes('admin')) {
      throw new functions.https.HttpsError('permission-denied', 'Un gérant ne peut pas attribuer le rôle Propriétaire');
    }
    targetRestoId = caller.restoId;
  }
  const claims = buildRoleClaims(roles || role, targetRestoId);
  await admin.auth().setCustomUserClaims(uid, claims);
  await db.collection('employees').doc(uid).update({
    roles: claims.roles, role: claims.role,
    restoId: claims.restoId || null,
    customPermissions: claims.roles.includes('custom')
      ? sanitizeCustomPermissions(customPermissions)
      : admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: context.auth.uid,
  });
  return { success: true };
});

exports.toggleEmployee = region.https.onCall(async (data, context) => {
  const caller = await checkAdminOrManager(context);
  const { uid, disabled } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'UID requis');
  await assertOwnEstablishmentEmployee(caller, uid);
  await admin.auth().updateUser(uid, { disabled });
  await db.collection('employees').doc(uid).update({
    active: !disabled, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.deleteEmployee = region.https.onCall(async (data, context) => {
  const caller = await checkAdminOrManager(context);
  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'UID requis');
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'Impossible de supprimer son propre compte');
  }
  await assertOwnEstablishmentEmployee(caller, uid);
  await admin.auth().deleteUser(uid);
  await db.collection('employees').doc(uid).delete();
  return { success: true };
});

exports.resetEmployeePassword = region.https.onCall(async (data, context) => {
  const caller = await checkAdminOrManager(context);
  const { uid, password } = data;
  if (!uid || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'UID et mot de passe requis');
  }
  if (password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Mot de passe trop court (min. 6 caractères)');
  }
  await assertOwnEstablishmentEmployee(caller, uid);
  await admin.auth().updateUser(uid, { password });
  return { success: true };
});

exports.setUserRole = region.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin uniquement');
  }
  const { uid, role, restoId } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'UID requis');
  await admin.auth().setCustomUserClaims(uid, buildRoleClaims(role, restoId));
  return { success: true };
});

// ─────────────────────────────────────────────────────────
//  7. ASSISTANT IA — Proxy Anthropic (évite CORS)
// ─────────────────────────────────────────────────────────
// Anti-abus : chaque appel coûte du crédit API Anthropic ; un client anonyme
// pourrait boucler dessus sans limite. Compteur par uid, fenêtre glissante.
const ASSISTANT_RATE_LIMIT     = 20;                // requêtes
const ASSISTANT_RATE_WINDOW_MS = 60 * 60 * 1000;     // par heure

// Prompts système — copie serveur de public/js/assistant.js (à resynchroniser
// si l'un des deux change). Le client n'envoie qu'une clé contextType, jamais
// le texte lui-même : askAssistant est un endpoint public (auth anonyme
// suffit), donc accepter un "system" fourni par le client permettrait à
// n'importe qui d'utiliser le crédit API Anthropic du propriétaire pour
// n'importe quel usage, hors du périmètre "assistant restaurant".
const SYSTEM_PROMPTS = {
  admin: `Tu es l'assistant IA intégré à la plateforme digitale du restaurant Délices Étoiles, réseau multi-établissements (Grand-Bassam, Abobo, Ebimpé) + Traiteur, en Côte d'Ivoire.

Tu aides uniquement le gérant et le propriétaire à utiliser l'application d'administration.

CONTEXTE DE L'APPLICATION :
- URL : https://delices-etoiles.ci
- Admin : /admin — back-office complet (gérant scopé à son établissement, propriétaire voit tout)
- Dashboard staff : /dashboard — gestion des commandes en temps réel
- PWA client : / — menu client, commandes salle/livraison, suivi, Infos & Actualités

SECTIONS DE L'ADMIN (barre latérale) :
- Établissements : CRUD des lieux du réseau (nom, logo, réseaux sociaux, activation)
- Carrousel accueil, Plat du jour, Infos & Actualités (annonces, recrutement, promotions avec date d'expiration + bouton copier le message pour WhatsApp), Avis clients : contenu affiché au client
- Candidatures : candidatures reçues via une annonce de recrutement, CV joint si fourni par le candidat
- Articles, Zones de livraison, Upselling (accompagnements/boissons suggérés)
- Utilisateurs : identifiants courts (ex: cuisine01), rôles multiples, réinitialisation MDP
- Plan de salle (tap pour sélectionner/déplacer), QR Codes
- Fidélité réseau (réglage par défaut) + Fidélité par établissement (dans Configuration) : récompense périodique (tous les X jours), texte libre (à appliquer par le staff) ou % de réduction (déduit automatiquement du panier client au moment de la commande)
- Configuration : nom, contacts, modes de paiement, délai d'expiration des commandes, fidélité
- Statistiques (CA, panier moyen, répartition nourriture/boissons, graphique par période), Stocks boissons (casiers de 24)
- Paiements, Comptabilité (revenus/dépenses/solde)
- Traiteur : Demandes, Devis (lignes catégorisables Entrée/Plat/Dessert/Boisson pour un rendu façon carte de menu), Prestations

NOTE : la notification WhatsApp automatique (nouvelle commande, nouvelle demande devis) n'est pas encore active — identifiants API WhatsApp Business pas encore configurés. Si on te demande pourquoi elle ne fonctionne pas, explique cela sans détailler l'infrastructure technique.

RÔLES : admin 👑 (propriétaire, global), manager (gérant, scopé à son établissement), serveur 🪑, bar 🍺, cuisine 👨‍🍳, livreur 🚴, caissier 💳. Un employé peut avoir plusieurs rôles.
Connexion staff : identifiant court (ex: cuisine01) + MDP — PAS d'email. Propriétaire/gérant : email + MDP.

RÉPONSES : Toujours en français. Concis, étapes numérotées.`,

  dashboard: `Tu es l'assistant IA du dashboard Délices Étoiles, réseau de restaurants en Côte d'Ivoire.

Tu aides le staff (serveurs, cuisine, bar, livreurs, caissiers, gérants) à utiliser le dashboard de gestion des commandes.

FONCTIONNALITÉS DU DASHBOARD :
- Commandes en temps réel avec filtres par statut (badge de rôle en haut = rôles actifs)
- Flux salle : Commencer → Prêt → Valider paiement → Servi
- Flux livraison : Commencer → Prêt → Parti en livraison → Livré + Encaissé
- Réservations : confirmer/refuser les demandes reçues du portail client
- Plan de salle : voir l'état des tables, taper une table pour filtrer ses commandes
- Prise de commande serveur : saisir une commande pour un client sans téléphone adapté
- Badge fidélité 🎁 sur une commande : récompense disponible pour ce client. Si texte libre, bouton pour la marquer utilisée après l'avoir remise ; si c'est une réduction en %, elle a déjà été déduite automatiquement du total (visible sur la carte)
- Facture de session imprimable (table avec plusieurs commandes)
- Son : alerte sonore à chaque nouvelle commande
- Modes paiement : Espèces, Wave CI, Orange Money, MTN
- Installable en icône sur tablette/téléphone (menu du navigateur → Installer l'application)

RÔLES ET ACCÈS :
- Cuisine/Bar : voient leurs commandes, changent les statuts
- Serveur : voit toutes les commandes salle, peut encaisser
- Livreur : voit les commandes livraison, confirme la livraison + encaissement
- Caissier : encaissement et factures uniquement
- Gérant/Admin : accès complet + plan de salle + prise de commande

RÉPONSES : Toujours en français. Court et pratique.`,

  client: `Tu es l'assistant du restaurant Délices Étoiles, situé à Grand-Bassam en Côte d'Ivoire.

Tu aides les clients à commander, choisir des plats et suivre leurs commandes.

INFORMATIONS RESTAURANT :
- Délices Étoiles — Resto & Traiteur
- Grand-Bassam, Côte d'Ivoire
- Commandes salle (QR code) et livraison disponibles
- Paiement : Espèces, Wave CI, Orange Money, MTN

CE QUE TU PEUX FAIRE :
- Recommander des plats selon les goûts
- Expliquer comment commander
- Aider à suivre une commande
- Informer sur les zones et frais de livraison

RÉPONSES : Toujours en français. Chaleureux et accueillant. Court et utile.`,
};

async function checkAssistantRateLimit(uid) {
  const ref = db.collection('assistant-usage').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now  = Date.now();
    const data = snap.exists ? snap.data() : {};
    const windowStart = data.windowStart || 0;
    if (now - windowStart > ASSISTANT_RATE_WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    if ((data.count || 0) >= ASSISTANT_RATE_LIMIT) {
      throw new functions.https.HttpsError('resource-exhausted',
        "Trop de messages envoyés à l'assistant. Réessayez dans quelques minutes.");
    }
    tx.set(ref, { count: data.count + 1, windowStart }, { merge: true });
  });
}

exports.askAssistant = region.runWith({ secrets: ['ANTHROPIC_KEY'] }).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }
  await checkAssistantRateLimit(context.auth.uid);

  // Le "system" prompt n'est JAMAIS pris depuis le client (endpoint
  // accessible avec la seule auth anonyme) — seule une clé contextType
  // connue est acceptée, résolue vers la copie serveur ci-dessus.
  const { messages, contextType } = data;
  const system = SYSTEM_PROMPTS[contextType] || SYSTEM_PROMPTS.client;
  const apiKey = process.env.ANTHROPIC_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError('failed-precondition',
      'Clé API Anthropic non configurée. Exécutez : firebase functions:secrets:set ANTHROPIC_KEY');
  }

  try {
    const https = require('https');
    const body  = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system:     system,
      messages:   (messages || []).slice(-10),
    });

    const reply = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers:  {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length':    Buffer.byteLength(body),
        },
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(raw); } catch(e) { reject(e); return; }
          // Anthropic répond 4xx/5xx avec { type:'error', error:{ type, message } } —
          // sans ce contrôle, une erreur (mauvaise clé, modèle invalide, quota...)
          // se traduisait silencieusement par "Je n'ai pas pu traiter votre demande"
          // sans jamais apparaître dans les logs.
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error('askAssistant: Anthropic API error', res.statusCode, parsed);
            reject(new Error(parsed?.error?.message || ('Anthropic API a répondu ' + res.statusCode)));
            return;
          }
          const text = parsed.content?.[0]?.text;
          if (!text) { console.error('askAssistant: réponse inattendue', parsed); }
          resolve(text || "Je n'ai pas pu traiter votre demande.");
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    return { reply };
  } catch(e) {
    console.error('askAssistant error:', e);
    throw new functions.https.HttpsError('internal', e.message || 'Erreur lors de la génération de la réponse.');
  }
});

// ─────────────────────────────────────────────────────────
//  8. TRIGGER : Nouvelle demande devis traiteur
// ─────────────────────────────────────────────────────────
// Secrets WHATSAPP_* retirés de runWith() — voir le commentaire détaillé sur
// onNewOrder plus haut (identifiants API pas encore obtenus, 2026-07-29).
exports.onNewDevis = region.firestore
  .document('devis/{devisId}')
  .onCreate(async (snap, context) => {
    const devis = snap.data();
    if (!process.env.WHATSAPP_TOKEN) return null;

    const staffNumbers = (process.env.WHATSAPP_STAFF_NUMBERS || '').split(',').filter(Boolean);
    if (!staffNumbers.length) return null;

    const eventLabels = {
      mariage:'Mariage', bapteme:'Baptême', anniversaire:'Anniversaire',
      entreprise:'Repas entreprise', seminaire:'Séminaire', autre:'Événement',
    };
    const label = eventLabels[devis.type] || devis.type;
    const date  = new Date(devis.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});

    const msg = '🎉 *Nouvelle demande traiteur !*\n'
      + `Type : ${label}\n`
      + `Date : ${date}\n`
      + `Personnes : ${devis.nbPersonnes}\n`
      + `Lieu : ${devis.lieu}\n`
      + `Client : ${devis.client.nom} — ${devis.client.tel}\n`
      + (devis.besoins ? `Besoins : ${devis.besoins}` : '');

    for (const number of staffNumbers) {
      try {
        await axios.post(
          'https://graph.facebook.com/v18.0/' + process.env.WHATSAPP_PHONE_ID + '/messages',
          { messaging_product:'whatsapp', to:number.trim(), type:'text', text:{body:msg} },
          { headers:{ Authorization:'Bearer '+process.env.WHATSAPP_TOKEN,'Content-Type':'application/json' } }
        );
      } catch(e) { console.error('WhatsApp devis error:', e.message); }
    }
    return null;
  });

// ─────────────────────────────────────────────────────────
//  9. UPLOAD FICHIER DEVIS — via Admin SDK (contourne rules)
// ─────────────────────────────────────────────────────────
// Limites alignées sur le formulaire client (public/js/app.js, handleTraiteurFile) :
// 5 Mo max, types acceptés = .pdf/.doc/.docx/.jpg/.jpeg/.png. Le client applique déjà
// ces règles côté UI, mais un appel direct à l'endpoint peut les contourner — on les
// revérifie ici côté serveur.
const DEVIS_MAX_SIZE = 5 * 1024 * 1024;
const DEVIS_ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

exports.uploadDevisFile = region.https.onRequest(async (req, res) => {
  setCorsOrigin(req, res);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Vérifier le token Firebase
  const authHeader = req.headers.authorization || '';
  const idToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) { res.status(401).json({ error: { message: 'Non authentifié' } }); return; }

  try {
    await admin.auth().verifyIdToken(idToken);
  } catch(e) {
    res.status(401).json({ error: { message: 'Token invalide' } }); return;
  }

  const { fileData, fileName, mimeType } = req.body.data || {};
  if (!fileData || !fileName) {
    res.status(400).json({ error: { message: 'Fichier manquant' } }); return;
  }
  if (!DEVIS_ALLOWED_MIME.includes(mimeType)) {
    res.status(400).json({ error: { message: 'Type de fichier non autorisé (PDF, Word, JPG ou PNG uniquement)' } }); return;
  }

  const buffer = Buffer.from(fileData, 'base64');
  if (buffer.length > DEVIS_MAX_SIZE) {
    res.status(400).json({ error: { message: 'Fichier trop volumineux (max 5 Mo)' } }); return;
  }

  try {
    const bucket   = admin.storage().bucket();
    const safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = 'devis/' + safeName;
    const fileRef  = bucket.file(filePath);

    await fileRef.save(buffer, {
      metadata: { contentType: mimeType },
    });
    // Pas de makePublic() : un devis (brief événement, menu désiré...) n'a
    // pas vocation à être public — seul l'admin doit pouvoir l'ouvrir (même
    // logique que uploadCandidatureFile). URL signée, non devinable.
    const [signedUrl] = await fileRef.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 365 });

    res.json({ result: { url: signedUrl, nom: fileName } });
  } catch(e) {
    console.error('uploadDevisFile error:', e);
    res.status(500).json({ error: { message: e.message } });
  }
});

// Upload de CV (formulaire "Postuler" d'une annonce recrutement) — mêmes
// limites/validation server-side que uploadDevisFile, chemin candidatures/.
exports.uploadCandidatureFile = region.https.onRequest(async (req, res) => {
  setCorsOrigin(req, res);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers.authorization || '';
  const idToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) { res.status(401).json({ error: { message: 'Non authentifié' } }); return; }

  try {
    await admin.auth().verifyIdToken(idToken);
  } catch(e) {
    res.status(401).json({ error: { message: 'Token invalide' } }); return;
  }

  const { fileData, fileName, mimeType } = req.body.data || {};
  if (!fileData || !fileName) {
    res.status(400).json({ error: { message: 'Fichier manquant' } }); return;
  }
  if (!DEVIS_ALLOWED_MIME.includes(mimeType)) {
    res.status(400).json({ error: { message: 'Type de fichier non autorisé (PDF, Word, JPG ou PNG uniquement)' } }); return;
  }

  const buffer = Buffer.from(fileData, 'base64');
  if (buffer.length > DEVIS_MAX_SIZE) {
    res.status(400).json({ error: { message: 'Fichier trop volumineux (max 5 Mo)' } }); return;
  }

  try {
    const bucket   = admin.storage().bucket();
    const safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = 'candidatures/' + safeName;
    const fileRef  = bucket.file(filePath);

    await fileRef.save(buffer, {
      metadata: { contentType: mimeType },
    });
    // Pas de makePublic() ici (contrairement aux devis) : un CV contient des
    // infos personnelles. URL signee (non devinable, 1 an) plutot qu'un objet
    // public — elle n'est de toute facon jamais visible que par le staff,
    // seul lecteur autorise de la fiche candidature (regles Firestore).
    const [signedUrl] = await fileRef.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 365 });

    res.json({ result: { url: signedUrl, nom: fileName } });
  } catch(e) {
    console.error('uploadCandidatureFile error:', e);
    res.status(500).json({ error: { message: e.message } });
  }
});

// ─────────────────────────────────────────────────────────
//  TRAITEUR — Notifications J-7 et J-1
// ─────────────────────────────────────────────────────────
exports.traiteurReminders = region.pubsub
  .schedule('every day 08:00')
  .timeZone('Africa/Abidjan')
  .onRun(async () => {
    const now = new Date();
    const j1  = new Date(now); j1.setDate(j1.getDate() + 1);
    const j7  = new Date(now); j7.setDate(j7.getDate() + 7);

    const fmt = d => d.toISOString().split('T')[0];
    const targets = [fmt(j1), fmt(j7)];

    const snap = await admin.firestore()
      .collection('devis')
      .where('statut', '==', 'confirme')
      .get();

    const batch = admin.firestore().batch();
    let count = 0;

    const EVENT_LABELS = {
      mariage:'Mariage', bapteme:'Baptême', anniversaire:'Anniversaire',
      entreprise:'Repas entreprise', seminaire:'Séminaire', autre:'Événement',
    };

    snap.docs.forEach(docSnap => {
      const d = docSnap.data();
      if (!targets.includes(d.date)) return;
      const daysLeft = d.date === fmt(j1) ? 1 : 7;
      const label    = daysLeft === 1 ? 'demain' : 'dans 7 jours';
      const ref = admin.firestore().collection('notifications').doc();
      batch.set(ref, {
        type:        'traiteur_reminder',
        devisId:     docSnap.id,
        clientNom:   d.client && d.client.nom ? d.client.nom : '',
        typeEv:      EVENT_LABELS[d.type] || d.type || '',
        dateEv:      d.date,
        daysLeft,
        label,
        nbPersonnes: d.nbPersonnes || 0,
        lieu:        d.lieu || '',
        read:        false,
        createdAt:   admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    });

    if (count > 0) await batch.commit();
    console.log('traiteurReminders: ' + count + ' notification(s)');
    return null;
  });
