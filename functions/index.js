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
const STAFF_ROLES = ['manager', 'serveur', 'bar', 'cuisine', 'livreur', 'caissier'];
const ALL_ROLES   = ['admin', ...STAFF_ROLES];

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
//  1. TRIGGER : Nouvelle commande → Notification WhatsApp
// ─────────────────────────────────────────────────────────
exports.onNewOrder = region.firestore
  .document('commandes/{orderId}')
  .onCreate(async (snap, context) => {
    const order = { id: context.params.orderId, ...snap.data() };
    const config = functions.config();
    if (!config.whatsapp?.token) return null;

    const staffNumbers = (config.whatsapp.staff_numbers || '').split(',').filter(Boolean);
    if (!staffNumbers.length) return null;

    const itemsList = (order.items || [])
      .map(i => `• ${i.qty}x ${i.name} — ${fcfa(i.price * i.qty)}`)
      .join('\n');
    const msg = order.type === 'salle'
      ? `🍽️ *Nouvelle commande salle*\nTable : ${order.tableId}\n${itemsList}\n*Total : ${fcfa(order.total)}*`
      : `🚴 *Nouvelle livraison*\n${order.deliveryInfo?.name || ''}\n${itemsList}\n*Total : ${fcfa(order.total)}*`;

    for (const number of staffNumbers) {
      try {
        await axios.post(
          `https://graph.facebook.com/v18.0/${config.whatsapp.phone_id}/messages`,
          { messaging_product: 'whatsapp', to: number.trim(), type: 'text', text: { body: msg } },
          { headers: { Authorization: `Bearer ${config.whatsapp.token}`, 'Content-Type': 'application/json' } }
        );
      } catch (e) { console.error('WhatsApp error:', e.message); }
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
exports.paymentWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const secret = req.headers['x-webhook-secret'];
  const expectedSecret = functions.config().payment?.webhook_secret;
  if (expectedSecret && secret !== expectedSecret) {
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
exports.dailyReport = region.pubsub
  .schedule('59 23 * * *')
  .timeZone('Africa/Abidjan')
  .onRun(async (_context) => {
    const config = functions.config();
    if (!config.email?.user) {
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
      auth: { user: config.email.user, pass: config.email.pass },
    });

    await transporter.sendMail({
      from: config.email.user,
      to: config.email.dest,
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
async function applyAvisDelta(restoId, menuId, ratingDelta, countDelta) {
  const dispoRef = db.collection('menu-dispo').doc(menuId + '_' + restoId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(dispoRef);
    const data = snap.exists ? snap.data() : {};
    const prevCount = data.ratingCount || 0;
    const prevAvg   = data.avgRating   || 0;
    const newCount  = Math.max(0, prevCount + countDelta);
    const newAvg    = newCount === 0 ? 0 : ((prevAvg * prevCount) + ratingDelta) / newCount;
    tx.set(dispoRef, {
      menuItemId: menuId, restoId,
      avgRating:   newAvg,
      ratingCount: newCount,
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

exports.onAvisCreate = region.firestore
  .document('avis/{avisId}')
  .onCreate(async (snap) => {
    const d = snap.data();
    try {
      await applyAvisDelta(d.restoId, d.menuId, d.rating, 1);
    } catch (e) {
      console.error('onAvisCreate error:', e.message);
    }
    return null;
  });

exports.onAvisDelete = region.firestore
  .document('avis/{avisId}')
  .onDelete(async (snap) => {
    const d = snap.data();
    try {
      await applyAvisDelta(d.restoId, d.menuId, -d.rating, -1);
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
  const { email, password, role, roles, displayName, username, restoId } = data;
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
  const { uid, role, roles, restoId } = data;
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
exports.askAssistant = region.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const { messages, system } = data;
  const apiKey = functions.config().anthropic?.key;

  if (!apiKey) {
    throw new functions.https.HttpsError('failed-precondition',
      'Clé API Anthropic non configurée. Exécutez : firebase functions:config:set anthropic.key=sk-...');
  }

  try {
    const https = require('https');
    const body  = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system:     system || 'Tu es un assistant utile pour le restaurant Délices Étoiles.',
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
          try {
            const parsed = JSON.parse(raw);
            resolve(parsed.content?.[0]?.text || "Je n'ai pas pu traiter votre demande.");
          } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    return { reply };
  } catch(e) {
    console.error('askAssistant error:', e);
    throw new functions.https.HttpsError('internal', 'Erreur lors de la génération de la réponse.');
  }
});

// ─────────────────────────────────────────────────────────
//  8. TRIGGER : Nouvelle demande devis traiteur
// ─────────────────────────────────────────────────────────
exports.onNewDevis = region.firestore
  .document('devis/{devisId}')
  .onCreate(async (snap, context) => {
    const devis = snap.data();
    const config = functions.config();
    if (!config.whatsapp?.token) return null;

    const staffNumbers = (config.whatsapp.staff_numbers || '').split(',').filter(Boolean);
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
          'https://graph.facebook.com/v18.0/' + config.whatsapp.phone_id + '/messages',
          { messaging_product:'whatsapp', to:number.trim(), type:'text', text:{body:msg} },
          { headers:{ Authorization:'Bearer '+config.whatsapp.token,'Content-Type':'application/json' } }
        );
      } catch(e) { console.error('WhatsApp devis error:', e.message); }
    }
    return null;
  });

// ─────────────────────────────────────────────────────────
//  9. UPLOAD FICHIER DEVIS — via Admin SDK (contourne rules)
// ─────────────────────────────────────────────────────────
exports.uploadDevisFile = region.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', 'https://delices-etoiles.web.app');
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

  try {
    const bucket   = admin.storage().bucket();
    const safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = 'devis/' + safeName;
    const fileRef  = bucket.file(filePath);
    const buffer   = Buffer.from(fileData, 'base64');

    await fileRef.save(buffer, {
      metadata: { contentType: mimeType || 'application/octet-stream' },
    });
    await fileRef.makePublic();

    const publicUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + filePath;
    res.json({ result: { url: publicUrl, nom: fileName } });
  } catch(e) {
    console.error('uploadDevisFile error:', e);
    res.status(500).json({ error: { message: e.message } });
  }
});

// ─────────────────────────────────────────────────────────
//  TRAITEUR — Notifications J-7 et J-1
// ─────────────────────────────────────────────────────────
exports.traiteurReminders = functions.pubsub
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
