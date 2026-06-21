#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════
 *  backfill-restoid.js — Phase 1 de la migration multi-établissement
 *
 *  Pose restoId sur les documents existants :
 *   - Collections RESTAURANT  → restoId: 'bassam'  (tes données actuelles
 *     SONT Bassam, donc rien ne change fonctionnellement)
 *   - Collections TRAITEUR    → restoId: 'traiteur' (sentinelle explicite,
 *     jamais null — un filtre oublié devient visible au lieu d'être silencieux)
 *
 *  Idempotent : ne réécrit pas un doc qui a déjà le bon restoId.
 *  DRY-RUN par défaut : n'écrit rien tant que --apply n'est pas passé.
 *
 *  USAGE :
 *    # 1) Récupérer une clé de service depuis la console Firebase
 *    #    (Paramètres du projet → Comptes de service → Générer une clé privée)
 *    export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *
 *    # 2) Simulation (n'écrit RIEN, montre ce qui serait fait)
 *    node backfill-restoid.js
 *
 *    # 3) Application réelle
 *    node backfill-restoid.js --apply
 *
 *  ⚠️ Fais un export Firestore (sauvegarde) AVANT le --apply :
 *     gcloud firestore export gs://TON_BUCKET/backup-$(date +%F)
 * ════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

// Collections RESTAURANT → restoId du lieu existant.
// (Tout l'historique actuel appartient à Bassam.)
const RESTO_ID = 'bassam';
const RESTO_COLLECTIONS = [
  'menus',
  'zones-livraison',
  'upselling-rules',
  'plat-du-jour',
  'commandes',
  'sessions',
  'tables',
  'paiements',     // paiements RESTAURANT (collection racine, pas la sous-collection devis)
];

// Collections TRAITEUR (central) → sentinelle 'traiteur'.
const TRAITEUR_ID = 'traiteur';
const TRAITEUR_COLLECTIONS = [
  'devis',
];

// ⚠️ DÉPENSES : ambiguës. Tes dépenses existantes ont été saisies pour le
// restaurant unique d'alors. Par défaut on les rattache à Bassam. Si certaines
// étaient en réalité des dépenses traiteur, corrige-les à la main ensuite,
// ou édite cette ligne avant de lancer.
const DEPENSES_DEFAULT = 'bassam';

async function backfillCollection(name, restoId) {
  const snap = await db.collection(name).get();
  let toUpdate = 0, alreadyOk = 0;
  const batchSize = 400;
  let batch = db.batch();
  let pending = 0;

  for (const docSnap of snap.docs) {
    const cur = docSnap.data().restoId;
    if (cur === restoId) { alreadyOk++; continue; }
    toUpdate++;
    if (APPLY) {
      batch.update(docSnap.ref, { restoId });
      pending++;
      if (pending >= batchSize) { await batch.commit(); batch = db.batch(); pending = 0; }
    }
  }
  if (APPLY && pending > 0) await batch.commit();

  console.log(
    `  ${name.padEnd(18)} total=${String(snap.size).padStart(4)}  ` +
    `à_taguer=${String(toUpdate).padStart(4)}  déjà_ok=${String(alreadyOk).padStart(4)}  → restoId='${restoId}'`
  );
  return toUpdate;
}

// Sous-collection /devis/{id}/paiements → 'traiteur' (uniformité collectionGroup)
async function backfillDevisPaiements() {
  const devisSnap = await db.collection('devis').get();
  let total = 0, toUpdate = 0;
  for (const d of devisSnap.docs) {
    const psnap = await d.ref.collection('paiements').get();
    for (const p of psnap.docs) {
      total++;
      if (p.data().restoId === TRAITEUR_ID) continue;
      toUpdate++;
      if (APPLY) await p.ref.update({ restoId: TRAITEUR_ID });
    }
  }
  console.log(
    `  devis/*/paiements   total=${String(total).padStart(4)}  ` +
    `à_taguer=${String(toUpdate).padStart(4)}  → restoId='${TRAITEUR_ID}'`
  );
  return toUpdate;
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Backfill restoId — mode : ${APPLY ? '🟢 APPLY (écriture réelle)' : '🟡 DRY-RUN (aucune écriture)'}`);
  console.log('══════════════════════════════════════════════════════\n');

  console.log('RESTAURANT (→ bassam) :');
  for (const c of RESTO_COLLECTIONS) await backfillCollection(c, RESTO_ID);

  console.log('\nDÉPENSES (→ ' + DEPENSES_DEFAULT + ', voir avertissement en tête de fichier) :');
  await backfillCollection('depenses', DEPENSES_DEFAULT);

  console.log('\nTRAITEUR (→ traiteur, central) :');
  for (const c of TRAITEUR_COLLECTIONS) await backfillCollection(c, TRAITEUR_ID);
  await backfillDevisPaiements();

  console.log('\n' + (APPLY
    ? '✅ Terminé. Backfill appliqué.'
    : '🟡 DRY-RUN terminé. Relance avec --apply pour écrire (après sauvegarde).'));
  console.log('');
}

main().catch(err => { console.error('❌ Erreur :', err); process.exit(1); });
