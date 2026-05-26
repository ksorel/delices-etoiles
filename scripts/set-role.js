// ════════════════════════════════════════════════════════════
//  set-role.js — Assigne un rôle à un utilisateur Firebase
//  Usage : node set-role.js <uid> <role>
//  Exemple : node set-role.js upv5aYwmGuVyQHZgzc8oNnFUNlr1 admin
// ════════════════════════════════════════════════════════════

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const uid  = process.argv[2];
const role = process.argv[3];

if (!uid || !['admin', 'staff'].includes(role)) {
  console.error('Usage : node set-role.js <uid> <role>');
  console.error('Roles disponibles : admin, staff');
  process.exit(1);
}

async function setRole() {
  // 1. Assigner le custom claim
  await admin.auth().setCustomUserClaims(uid, { role });

  // 2. Enregistrer dans Firestore
  await admin.firestore().collection('staff').doc(uid).set({
    uid, role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const user = await admin.auth().getUser(uid);
  console.log(`\n✅ Rôle "${role}" assigné à ${user.email} (${uid})`);
  console.log('⚠️  L\'utilisateur doit se déconnecter et se reconnecter pour que le rôle prenne effet.\n');
  process.exit(0);
}

setRole().catch(e => { console.error('❌ Erreur :', e.message); process.exit(1); });
