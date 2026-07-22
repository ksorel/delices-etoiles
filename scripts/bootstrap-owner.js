#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════
 *  bootstrap-owner.js — Désigne le PREMIER propriétaire
 *
 *  Pose le custom claim { role: 'admin' } sur le compte propriétaire.
 *  Rappel du modèle : 'admin' = PROPRIÉTAIRE (accès global, AUCUN restoId).
 *  Les rôles manager / serveur / bar / cuisine / livreur / caissier sont,
 *  eux, rattachés à un établissement (restoId) — gérés depuis l'admin.
 *
 *  Idempotent : relançable sans dégât.
 *  DRY-RUN par défaut ; --apply pour écrire réellement.
 *
 *  USAGE (PowerShell) :
 *    $env:GOOGLE_APPLICATION_CREDENTIALS = ".\scripts\serviceAccountKey.json"
 *    node .\scripts\bootstrap-owner.js            # simulation
 *    node .\scripts\bootstrap-owner.js --apply    # écriture réelle
 *
 *  ⚠️ Après --apply, le compte doit se DÉCONNECTER / RECONNECTER
 *     (ou rafraîchir son token) pour que le nouveau claim prenne effet.
 * ════════════════════════════════════════════════════════════
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });

// ── Le propriétaire à désigner ───────────────────────────────
const OWNER_UID   = 'upv5aYwmGuVyQHZgzc8oNnFUNlr1';
const OWNER_EMAIL = 'admin@delices-etoiles.ci';   // pour vérification/affichage seulement

const APPLY = process.argv.includes('--apply');

(async () => {
  const auth = getAuth();
  const db   = getFirestore();

  let user;
  try {
    user = await auth.getUser(OWNER_UID);
  } catch (e) {
    console.error(`❌ UID introuvable (${OWNER_UID}) : ${e.message}`);
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Compte         : ${user.email || '(sans email)'}  [UID ${OWNER_UID}]`);
  if (OWNER_EMAIL && user.email && user.email !== OWNER_EMAIL) {
    console.warn(`⚠️  L'email du compte (${user.email}) diffère de l'attendu (${OWNER_EMAIL}).`);
  }
  console.log(`Claims actuels : ${JSON.stringify(user.customClaims || {})}`);
  console.log(`Cible          : { role: 'admin' }  (propriétaire, global, sans restoId)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!APPLY) {
    console.log('\n🟡 DRY-RUN — rien écrit. Relance avec --apply pour appliquer.');
    return;
  }

  // 1) Claim d'auth (source de vérité pour les règles et l'app)
  await auth.setCustomUserClaims(OWNER_UID, { role: 'admin' });

  // 2) Refléter dans la fiche employees si elle existe (cohérence d'affichage)
  const ref  = db.collection('employees').doc(OWNER_UID);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ role: 'admin', restoId: null });
    console.log('• Fiche employees mise à jour (role: admin, restoId: null).');
  } else {
    console.log('• Pas de fiche employees pour ce compte (aucune action — normal si le compte a été créé hors admin).');
  }

  console.log('\n✅ Propriétaire défini.');
  console.log('⚠️  Déconnecte-toi puis reconnecte-toi dans l\'admin pour que le claim prenne effet.');
})().catch(e => { console.error('❌', e); process.exit(1); });
