/**
 * backfill-restoid.js
 * ───────────────────────────────────────────────────────────
 * Estampille restoId sur toutes les données existantes qui n'en ont pas.
 * Toutes les données actuelles appartiennent à Grand-Bassam → restoId = 'bassam'.
 *
 * Usage (PowerShell, depuis ~\delices-etoiles) :
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = ".\scripts\serviceAccountKey.json"
 *
 *   node .\scripts\backfill-restoid.js            # DRY-RUN : montre ce qui serait modifié, n'écrit rien
 *   node .\scripts\backfill-restoid.js --apply    # applique réellement les modifications
 *
 * Options :
 *   --resto=bassam     change l'établissement cible (défaut : bassam)
 * ───────────────────────────────────────────────────────────
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const APPLY = process.argv.includes('--apply');
const RESTO = (process.argv.find(a => a.startsWith('--resto=')) || '--resto=bassam').split('=')[1];

// Collections « scopées par établissement » qui doivent porter un restoId.
const COLLECTIONS = [
  'menus',
  'zones-livraison',
  'upselling-rules',
  'commandes',
  'paiements',
  'depenses',
  'stocks',
  'plat-du-jour',
];

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

(async () => {
  console.log(`\n=== Backfill restoId → '${RESTO}' ${APPLY ? '(APPLY)' : '(DRY-RUN — aucune écriture)'} ===\n`);
  let grandTotal = 0;

  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).get();
    // On ne touche QUE les documents sans restoId (ou restoId vide/null).
    const toFix = snap.docs.filter(d => {
      const r = d.data().restoId;
      return r === undefined || r === null || r === '';
    });

    console.log(`• ${col} : ${snap.size} document(s), ${toFix.length} sans restoId`);
    grandTotal += toFix.length;

    if (APPLY && toFix.length) {
      // Écriture par lots de 400 (limite Firestore : 500 ops/batch).
      for (let i = 0; i < toFix.length; i += 400) {
        const batch = db.batch();
        for (const d of toFix.slice(i, i + 400)) {
          batch.update(d.ref, { restoId: RESTO });
        }
        await batch.commit();
      }
      console.log(`    → ${toFix.length} document(s) estampillé(s) restoId='${RESTO}'`);
    }
  }

  console.log(`\n=== Total : ${grandTotal} document(s) ${APPLY ? 'mis à jour' : 'à mettre à jour'} ===`);
  if (!APPLY && grandTotal) {
    console.log("Relance avec --apply pour écrire réellement : node .\\scripts\\backfill-restoid.js --apply\n");
  }
  process.exit(0);
})().catch(e => { console.error('Erreur :', e); process.exit(1); });
