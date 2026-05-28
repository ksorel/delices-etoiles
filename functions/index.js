// ════════════════════════════════════════════════════════════
//  Cloud Functions — Délices Étoiles
//  Région : europe-west1 (latence réduite depuis CI)
//
//  Variables d'environnement à configurer :
//    firebase functions:config:set
//      whatsapp.token="TON_META_ACCESS_TOKEN"
//      whatsapp.phone_id="TON_PHONE_NUMBER_ID"
//      whatsapp.staff_numbers="2250700000000,2250600000000"
//      whatsapp.template="commande_nouvelle"
//      email.user="admin@delices-etoiles.ci"
//      email.pass="MOT_DE_PASSE_APP_GMAIL"
//      email.dest="patron@delices-etoiles.ci"
// ════════════════════════════════════════════════════════════

const functions = require('firebase-functions/v1');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions }   = require('firebase-functions/v2');
const admin                  = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── Région CI-optimisée ───────────────────────────────────
const region = functions.region('europe-west1');

// ── Helper : format FCFA ──────────────────────────────────
const fcfa = n => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

// ─────────────────────────────────────────────────────────
//  1. TRIGGER : Nouvelle commande → Notification WhatsApp
// ─────────────────────────────────────────────────────────
exports.onNewOrder = region.firestore.document('commandes/{orderId}').onCreate(async (snap, context) => {
    const order   = snap.data();
    const orderId = context.params.orderId;
    const shortId = orderId.slice(-6).toUpperCase();
    const config  = functions.config();

    // Construire le message
    let msg;
    if (order.type === 'salle') {
      msg = `🍽️ *NOUVELLE COMMANDE — TABLE ${order.tableId}*\n\n`
          + `*N° :* ${shortId}\n`
          + `*Items :*\n`
          + (order.items || []).map(i => `  • ${i.name} ×${i.qty}`).join('\n')
          + `\n\n*Total :* ${fcfa(order.total || 0)}`
          + (order.comment ? `\n*Note :* ${order.comment}` : '');
    } else {
      msg = `🚴 *NOUVELLE LIVRAISON*\n\n`
          + `*N° :* ${shortId}\n`
          + `*Client :* ${order.livraison?.nom} · ${order.livraison?.telephone}\n`
          + `*Zone :* ${order.livraison?.zoneName}\n`
          + `*Adresse :* ${order.livraison?.adresse}\n`
          + `*Paiement :* ${order.livraison?.operateur?.toUpperCase()}\n`
          + `*Items :*\n`
          + (order.items || []).map(i => `  • ${i.name} ×${i.qty}`).join('\n')
          + `\n\n*Total :* ${fcfa(order.total || 0)}`
          + (order.comment ? `\n*Note :* ${order.comment}` : '');
    }

    // Envoyer à tous les numéros staff
    const numbers = (config.whatsapp?.staff_numbers || '').split(',').filter(Boolean);
    const token   = config.whatsapp?.token;
    const phoneId = config.whatsapp?.phone_id;

    if (!token || !phoneId || !numbers.length) {
      console.warn('WhatsApp non configuré — skipping notification');
      return null;
    }

    const promises = numbers.map(number =>
      axios.post(
        `https://graph.facebook.com/v19.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: number.trim(),
          type: 'text',
          text: { body: msg },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      ).catch(e => console.error(`WhatsApp error for ${number}:`, e.response?.data || e.message))
    );

    await Promise.allSettled(promises);

    // Log dans Firestore pour débogage
    await db.collection('notifications-log').add({
      orderId, type: 'whatsapp', sentAt: admin.firestore.FieldValue.serverTimestamp(),
      recipients: numbers.length,
    });

    return null;
  });

// ─────────────────────────────────────────────────────────
//  2. WEBHOOK : Confirmation paiement Mobile Money
// ─────────────────────────────────────────────────────────
exports.paymentWebhook = functions.https.onRequest(async (req, res) => {
  // Vérification basique du secret (à renforcer selon l'opérateur)
  const secret = req.headers['x-webhook-secret'];
  const expectedSecret = functions.config().payment?.webhook_secret;

  if (expectedSecret && secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { orderId, transactionId, status, operator, amount } = req.body;

    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const orderRef = db.collection('commandes').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ error: 'Order not found' });

    // Mettre à jour le statut de paiement
    if (status === 'success') {
      await orderRef.update({
        paymentStatus:   'paid',
        status:          'pending',   // Maintenant en file d'attente cuisine
        'livraison.transactionId': transactionId,
        'livraison.paidAt':        admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:                 admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (status === 'failed') {
      await orderRef.update({
        paymentStatus: 'failed',
        updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Log
    await db.collection('payment-log').add({
      orderId, transactionId, operator, amount, status,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true });

  } catch (e) {
    console.error('Payment webhook error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
//  3. CRON : Rapport quotidien par email (23h59 heure CI)
// ─────────────────────────────────────────────────────────
exports.dailyReport = region.pubsub.schedule('59 23 * * *').timeZone('Africa/Abidjan').onRun(async (_context) => {
    const config = functions.config();
    if (!config.email?.user) {
      console.warn('Email non configuré — skipping report');
      return null;
    }

    // Calcul de la journée (minuit → minuit)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = admin.firestore.Timestamp.fromDate(today);

    const snap = await db.collection('commandes')
      .where('createdAt', '>=', todayTs)
      .get();

    const orders = snap.docs.map(d => d.data());
    const done   = orders.filter(o => o.status === 'done');
    const ca     = done.reduce((s, o) => s + (o.total || 0), 0);
    const salle  = orders.filter(o => o.type === 'salle').length;
    const liv    = orders.filter(o => o.type === 'livraison').length;

    const dateStr = new Date().toLocaleDateString('fr-FR', {
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    });

    const html = `
      <h2>📊 Rapport Délices Étoiles — ${dateStr}</h2>
      <table border="1" cellpadding="8" style="border-collapse:collapse;font-family:sans-serif">
        <tr><td><strong>Total commandes</strong></td><td>${orders.length}</td></tr>
        <tr><td><strong>Commandes servies</strong></td><td>${done.length}</td></tr>
        <tr><td><strong>Commandes salle</strong></td><td>${salle}</td></tr>
        <tr><td><strong>Livraisons</strong></td><td>${liv}</td></tr>
        <tr><td><strong>CA du jour (servis)</strong></td><td><strong style="color:#F26522">${fcfa(ca)}</strong></td></tr>
      </table>
      <p style="margin-top:16px;color:#7A6356;font-size:12px">
        Rapport automatique — Délices Étoiles · Grand-Bassam
      </p>`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.email.user, pass: config.email.pass },
    });

    await transporter.sendMail({
      from:    `Délices Étoiles <${config.email.user}>`,
      to:      config.email.dest || config.email.user,
      subject: `📊 Rapport du ${dateStr} — ${fcfa(ca)}`,
      html,
    });

    console.log(`Rapport envoyé — ${orders.length} commandes, CA: ${fcfa(ca)}`);
    return null;
  });

// ─────────────────────────────────────────────────────────
//  4. CALLABLE : Définir le rôle admin/staff d'un user
//  Usage client : functions.httpsCallable('setUserRole')({uid, role})
// ─────────────────────────────────────────────────────────
exports.setUserRole = onCall(async (request) => { const data = request.data; const context = { auth: request.auth };
  // Seul un admin peut assigner des rôles
  if (context.auth?.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin requis');
  }
  const { uid, role } = data;
  if (!uid || !['admin', 'staff'].includes(role)) {
    throw new HttpsError('invalid-argument', 'uid et role (admin|staff) requis');
  }
  await admin.auth().setCustomUserClaims(uid, { role });
  await db.collection('staff').doc(uid).set({ uid, role, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { success: true, uid, role };
});

// ─────────────────────────────────────────────────────────
//  5. TRIGGER : Commande préparée → Décrémentation stocks
// ─────────────────────────────────────────────────────────
exports.onOrderStatusChange = region.firestore.document('commandes/{orderId}').onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();
    const orderId = context.params.orderId;

    // Déclencher uniquement quand on passe à 'preparing'
    if (before.status === after.status) return null;
    if (after.status !== 'preparing') return null;

    const DRINK_CATS = ['bieres','eaux','jus','spiritueux','boissons'];
    const items = (after.items || []).filter(i => DRINK_CATS.includes(i.category));
    if (!items.length) return null;

    const batch = db.batch();
    const alerts = [];

    for (const item of items) {
      const stockRef = db.collection('stocks').doc(item.id);
      const stockSnap = await stockRef.get();
      if (!stockSnap.exists) continue;

      const stock     = stockSnap.data();
      const newQty    = Math.max(0, (stock.quantity || 0) - (item.qty || 1));
      const threshold = stock.threshold || 6;

      batch.update(stockRef, {
        quantity:    newQty,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Enregistrer le mouvement
      batch.set(db.collection('stock-movements').doc(), {
        itemId:    item.id,
        name:      item.name,
        type:      'sortie',
        quantity:  -(item.qty || 1),
        reason:    `Commande #${orderId.slice(-6).toUpperCase()}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Lier disponibilité stock → menu (boissons uniquement)
      const DRINK_CATS = ['bieres','eaux','jus','spiritueux','boissons'];
      const itemCat = (stock.category || '').toLowerCase();
      if (DRINK_CATS.includes(itemCat)) {
        const menuRef = db.collection('menus').doc(item.id);
        if (newQty <= 0) {
          batch.update(menuRef, { available: false, stockStatus: 'rupture' });
          console.log(`[STOCK] ${item.name} → rupture, masqué du menu`);
        }
      }

      // Alerte si sous le seuil
      if (newQty <= threshold) {
        alerts.push({ id: item.id, name: item.name, qty: newQty, threshold, supplier: stock.supplierName });
      }
    }

    await batch.commit();

    // Notifier le staff si alertes
    if (alerts.length > 0) {
      const config  = functions.config();
      const token   = config.whatsapp?.token;
      const phoneId = config.whatsapp?.phone_id;
      const numbers = (config.whatsapp?.staff_numbers || '').split(',').filter(Boolean);

      if (token && phoneId && numbers.length) {
        const msg = '⚠️ *ALERTE STOCK BOISSONS*\n\n'
          + alerts.map(a => `• ${a.name} : ${a.qty} unité(s) restante(s) (seuil: ${a.threshold})`).join('\n')
          + '\n\nConnectez-vous à l\'admin pour passer commande.';

        for (const number of numbers) {
          await fetch(
            `https://graph.facebook.com/v19.0/${phoneId}/messages`,
            { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
              body: JSON.stringify({ messaging_product:'whatsapp', to:number.trim(), type:'text', text:{ body: msg } }) }
          ).catch(e => console.error('WhatsApp stock alert error:', e.message));
        }
      }

      // Créer une alerte Firestore
      await db.collection('supplier-orders').add({
        type:      'alert',
        status:    'pending',
        items:     alerts,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return null;
  });

// ─────────────────────────────────────────────────────────
//  6. TRIGGER : Commande prête → Notification FCM client
// ─────────────────────────────────────────────────────────
exports.onOrderReady = region.firestore.document('commandes/{orderId}').onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();

    // Uniquement quand le statut passe à 'ready'
    if (before.status === after.status) return null;
    if (after.status !== 'ready') return null;

    const fcmToken = after.fcmToken;
    if (!fcmToken) return null; // Client n'a pas activé les notifs

    const isLiv  = after.type === 'livraison';
    const table  = after.tableId ? `Table ${after.tableId}` : '';
    const title  = isLiv ? '🚴 Commande en route !' : '🍽️ Votre commande est prête !';
    const body   = isLiv
      ? 'Votre commande est en chemin. Préparez-vous !'
      : `${table ? table + ' — ' : ''}Votre commande est prête à être servie !`;

    const trackingUrl = `https://delices-etoiles.web.app/?order=${context.params.orderId}`;

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        webpush: {
          notification: {
            title, body,
            icon:  'https://delices-etoiles.web.app/img/logo.jpeg',
            badge: 'https://delices-etoiles.web.app/img/logo.jpeg',
            tag:   'order-ready',
            renotify: true,
          },
          fcmOptions: { link: trackingUrl },
        },
        data: { trackingUrl, orderId: context.params.orderId },
      });
      console.log('[FCM] Notification envoyée pour commande', context.params.orderId);
    } catch (e) {
      console.error('[FCM] Erreur envoi notification:', e.message);
    }

    return null;
  });


// ════════════════════════════════════════════════════════════
//  Gestion des utilisateurs — Admin uniquement
// ════════════════════════════════════════════════════════════

// Helper : vérifier que l'appelant est admin
async function checkAdmin(context) {
  if (!context.auth) throw new HttpsError('unauthenticated', 'Non authentifié');
  if (context.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Réservé aux administrateurs');
  }
}

// ── Créer un employé ──────────────────────────────────────
exports.createEmployee = onCall({ cors: ['https://delices-etoiles.web.app', 'https://delices-etoiles.firebaseapp.com'] }, async (request) => { const data = request.data; const context = { auth: request.auth };
  await checkAdmin(context);

  const { email, password, role, displayName } = data;

  if (!email || !password || !role) {
    throw new HttpsError('invalid-argument', 'Email, mot de passe et rôle requis');
  }

  const VALID_ROLES = ['admin', 'serveur', 'bar', 'cuisine', 'livreur', 'caissier'];
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'Rôle invalide');
  }

  try {
    // Créer le compte Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      emailVerified: true,
    });

    // Assigner le rôle (custom claim)
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    // Enregistrer dans Firestore pour listing
    await db.collection('employees').doc(userRecord.uid).set({
      uid:         userRecord.uid,
      email,
      displayName: displayName || email.split('@')[0],
      role,
      active:      true,
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
      createdBy:   context.auth.uid,
    });

    return { success: true, uid: userRecord.uid };
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Cet email est déjà utilisé');
    }
    throw new HttpsError('internal', e.message);
  }
});

// ── Modifier le rôle d'un employé ────────────────────────
exports.updateEmployeeRole = onCall({ cors: ['https://delices-etoiles.web.app', 'https://delices-etoiles.firebaseapp.com'] }, async (request) => { const data = request.data; const context = { auth: request.auth };
  await checkAdmin(context);

  const { uid, role } = data;
  if (!uid || !role) throw new HttpsError('invalid-argument', 'UID et rôle requis');

  const VALID_ROLES = ['admin', 'serveur', 'bar', 'cuisine', 'livreur', 'caissier'];
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'Rôle invalide');
  }

  await admin.auth().setCustomUserClaims(uid, { role });
  await db.collection('employees').doc(uid).update({
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: context.auth.uid,
  });

  return { success: true };
});

// ── Désactiver/Activer un employé ─────────────────────────
exports.toggleEmployee = onCall({ cors: ['https://delices-etoiles.web.app', 'https://delices-etoiles.firebaseapp.com'] }, async (request) => { const data = request.data; const context = { auth: request.auth };
  await checkAdmin(context);

  const { uid, disabled } = data;
  if (!uid) throw new HttpsError('invalid-argument', 'UID requis');

  await admin.auth().updateUser(uid, { disabled });
  await db.collection('employees').doc(uid).update({
    active:    !disabled,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ── Supprimer un employé ──────────────────────────────────
exports.deleteEmployee = onCall({ cors: ['https://delices-etoiles.web.app', 'https://delices-etoiles.firebaseapp.com'] }, async (request) => { const data = request.data; const context = { auth: request.auth };
  await checkAdmin(context);

  const { uid } = data;
  if (!uid) throw new HttpsError('invalid-argument', 'UID requis');

  // Empêcher l'admin de se supprimer lui-même
  if (uid === context.auth.uid) {
    throw new HttpsError('failed-precondition', 'Vous ne pouvez pas supprimer votre propre compte');
  }

  await admin.auth().deleteUser(uid);
  await db.collection('employees').doc(uid).delete();

  return { success: true };
});

// ── Lister tous les employés ──────────────────────────────
exports.listEmployees = onCall({ cors: ['https://delices-etoiles.web.app', 'https://delices-etoiles.firebaseapp.com'] }, async (request) => { const data = request.data; const context = { auth: request.auth };
  await checkAdmin(context);

  const snap = await db.collection('employees').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => d.data());
});
