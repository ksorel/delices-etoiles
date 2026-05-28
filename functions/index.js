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
//  HELPER : vérifier que l'appelant est admin
// ─────────────────────────────────────────────────────────
async function checkAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }
  if (context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs');
  }
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
//  5. GESTION DES UTILISATEURS (admin uniquement)
// ─────────────────────────────────────────────────────────

exports.createEmployee = region.https.onCall(async (data, context) => {
  await checkAdmin(context);
  const { email, password, role, displayName } = data;
  if (!email || !password || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Email, mot de passe et rôle requis');
  }
  const VALID_ROLES = ['admin','serveur','bar','cuisine','livreur','caissier'];
  if (!VALID_ROLES.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Rôle invalide');
  }
  try {
    const userRecord = await admin.auth().createUser({
      email, password,
      displayName: displayName || email.split('@')[0],
      emailVerified: true,
    });
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });
    await db.collection('employees').doc(userRecord.uid).set({
      uid: userRecord.uid, email,
      displayName: displayName || email.split('@')[0],
      role, active: true,
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
  await checkAdmin(context);
  const { uid, role } = data;
  if (!uid || !role) throw new functions.https.HttpsError('invalid-argument', 'UID et rôle requis');
  const VALID_ROLES = ['admin','serveur','bar','cuisine','livreur','caissier'];
  if (!VALID_ROLES.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Rôle invalide');
  }
  await admin.auth().setCustomUserClaims(uid, { role });
  await db.collection('employees').doc(uid).update({
    role, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: context.auth.uid,
  });
  return { success: true };
});

exports.toggleEmployee = region.https.onCall(async (data, context) => {
  await checkAdmin(context);
  const { uid, disabled } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'UID requis');
  await admin.auth().updateUser(uid, { disabled });
  await db.collection('employees').doc(uid).update({
    active: !disabled, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.deleteEmployee = region.https.onCall(async (data, context) => {
  await checkAdmin(context);
  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'UID requis');
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'Impossible de supprimer son propre compte');
  }
  await admin.auth().deleteUser(uid);
  await db.collection('employees').doc(uid).delete();
  return { success: true };
});

exports.setUserRole = region.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin uniquement');
  }
  const { uid, role } = data;
  await admin.auth().setCustomUserClaims(uid, { role });
  return { success: true };
});
