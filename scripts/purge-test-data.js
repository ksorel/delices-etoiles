// ════════════════════════════════════════════════════════════
//  purge-test-data.js — Vide les collections de test/transactionnelles
//  et les comptes staff/anonymes de développement, avant mise en prod
//  réelle. Garde : menus, menu-dispo (articles), restos, config,
//  zones-livraison, floor-plan, tables, upselling-rules, stocks, et le
//  compte Auth admin (propriétaire).
//
//  Fait TOUJOURS une sauvegarde JSON locale (scripts/backups/) avant
//  toute suppression.
//
//  Usage :
//    node scripts/purge-test-data.js          # simulation (dry-run)
//    node scripts/purge-test-data.js --apply   # applique réellement
// ════════════════════════════════════════════════════════════
// Le firebase-admin racine (v14, package.json) n'expose plus l'API CJS
// classique (admin.credential/admin.firestore()) — on réutilise celui de
// functions/, qui fonctionne avec ce style (mêmes scripts ad hoc que
// l'audit du 22/08).
const admin = require('../functions/node_modules/firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ADMIN_UID = 'upv5aYwmGuVyQHZgzc8oNnFUNlr1'; // admin@delices-etoiles.ci — jamais touché

// Collections vidées entièrement (données transactionnelles/test).
const COLLECTIONS_TO_WIPE = [
  'commandes', 'sessions', 'reservations', 'avis', 'devis', 'clients',
  'stats-visites', 'notifications', 'assistant-usage', 'supplier-orders',
  'annonces', 'plat-du-jour', 'staff', 'employees',
];

// Comptes Auth nommés (non-admin) à supprimer explicitement — validés un
// par un avec Sorel le 22/08 (mélange d'employés test et de comptes legacy
// avec un rôle "staff" qui n'existe plus dans le système de rôles actuel).
const NAMED_UIDS_TO_DELETE = [
  '09WWBMY5H5XWGT1PTglCwjq8BtR2', // cuisine@gmail.com
  '2UL3qiInbGZe1o63YdSyUhcvWkM2', // cuisine@delices-etoiles.ci (legacy)
  '3neeWLg4CAddwypinQVOVzqApAo2', // sorel@delices-etoiles.staff
  '5BRrIOkhAuYI2qtlS7068ZaYDmU2', // kouakou@delices-etoiles.staff
  'AjrG3Nny3yWjYdxPTVVVrLmz2Qy1', // estelle@delices-etoiles.staff
  'adbzzuvAyaQyM9wYjaO5HSMd4pu1', // bar@gmail.test
  'ezkLYdbEhwUmrBusTthSu6FEutE2', // amouin@delices-etoiles.staff
  'm62Ty1HUYeVzdAWi77HdeeMmI0H2', // franky@delices-etoiles.staff
  'p3sq8KjhJOeTbuXNrMFKeHbAq6J2', // serveur@delices-etoiles.ci (legacy)
  'xUDZcg8AujVOWiCJ1uAcjapAZys1', // bar@delices-etoiles.ci (legacy)
  'zeLnfRUhVLTrn8ETrsZbD4CRazh1', // livreur@delices-etoiles.ci (legacy)
];

async function backupCollections() {
  const backup = {};
  for (const col of COLLECTIONS_TO_WIPE) {
    const snap = await db.collection(col).get();
    backup[col] = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  }
  return backup;
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

async function deleteCollection(colName) {
  const snap = await db.collection(colName).get();
  const batches = [];
  let batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 450 === 0) { batches.push(batch.commit()); batch = db.batch(); }
  }
  batches.push(batch.commit());
  await Promise.all(batches);
  return snap.size;
}

async function deleteAuthUsers(uids) {
  let deleted = 0, errors = [];
  for (let i = 0; i < uids.length; i += 1000) {
    const chunk = uids.slice(i, i + 1000);
    const res = await admin.auth().deleteUsers(chunk);
    deleted += res.successCount;
    errors.push(...res.errors);
  }
  return { deleted, errors };
}

(async () => {
  console.log(APPLY ? '=== MODE APPLICATION (suppression réelle) ===' : '=== MODE SIMULATION (dry-run, rien ne sera supprimé) ===');

  const allUsers = await listAllAuthUsers();
  const anonymousUids = allUsers.filter(u => !u.email && u.uid !== ADMIN_UID).map(u => u.uid);
  const namedSet = new Set(NAMED_UIDS_TO_DELETE);
  // Garde-fou : n'importe quel uid nommé qui ne serait plus dans la liste
  // attendue (compte supprimé entre-temps) est simplement ignoré ci-dessous
  // par deleteUsers (il renverra une erreur "not found", sans bloquer le reste).

  console.log('\n--- Sauvegarde ---');
  const firestoreBackup = await backupCollections();
  const totalDocs = Object.values(firestoreBackup).reduce((s, arr) => s + arr.length, 0);
  const authBackup = allUsers
    .filter(u => namedSet.has(u.uid) || anonymousUids.includes(u.uid))
    .map(u => ({ uid: u.uid, email: u.email || null, customClaims: u.customClaims || null }));

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `purge-${ts}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ firestore: firestoreBackup, authUsers: authBackup }, null, 2));
  console.log('Sauvegarde écrite :', backupFile, `(${totalDocs} docs Firestore, ${authBackup.length} comptes Auth)`);

  console.log('\n--- Firestore : collections à vider ---');
  for (const col of COLLECTIONS_TO_WIPE) {
    const n = firestoreBackup[col].length;
    console.log(`${col} : ${n} document(s)` + (APPLY ? '' : ' [simulation]'));
    if (APPLY && n > 0) {
      const deletedCount = await deleteCollection(col);
      console.log(`  → ${deletedCount} document(s) supprimé(s)`);
    }
  }

  console.log('\n--- Auth : comptes nommés (non-admin) ---');
  console.log(NAMED_UIDS_TO_DELETE.length, 'compte(s) ciblé(s)');
  if (APPLY) {
    const { deleted, errors } = await deleteAuthUsers(NAMED_UIDS_TO_DELETE);
    console.log(`  → ${deleted} supprimé(s)`, errors.length ? `, ${errors.length} erreur(s) : ${JSON.stringify(errors)}` : '');
  }

  console.log('\n--- Auth : comptes anonymes ---');
  console.log(anonymousUids.length, 'compte(s) anonyme(s) ciblé(s)');
  if (APPLY) {
    const { deleted, errors } = await deleteAuthUsers(anonymousUids);
    console.log(`  → ${deleted} supprimé(s)`, errors.length ? `, ${errors.length} erreur(s)` : '');
  }

  console.log('\n--- Terminé ---');
  console.log(APPLY ? 'Suppression appliquée.' : 'Simulation terminée — relancer avec --apply pour exécuter réellement.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
