#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════
 *  copy-menu-dispo.js — Copie les fiches dispo (prix/variantes) d'un
 *  établissement source vers un ou plusieurs établissements cible, pour
 *  démarrer rapidement leur carte à partir du catalogue partagé.
 *
 *  Les fiches copiées sont créées DÉSACTIVÉES (available:false) — à
 *  activer/ajuster ensuite dans Admin → Articles (ou avec l'écran
 *  "Activer un article existant").
 *
 *  Idempotent : ignore les couples (article, établissement cible) qui
 *  ont déjà une fiche dispo. Relançable sans dégât.
 *  DRY-RUN par défaut ; --apply pour écrire.
 *
 *  USAGE (PowerShell) :
 *    $env:GOOGLE_APPLICATION_CREDENTIALS = ".\scripts\serviceAccountKey.json"
 *    node .\scripts\copy-menu-dispo.js --from=bassam --to=abobo,ebimpe
 *    node .\scripts\copy-menu-dispo.js --from=bassam --to=abobo,ebimpe --apply
 * ════════════════════════════════════════════════════════════
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const argVal = (name) => {
  const arg = process.argv.find(a => a.startsWith('--' + name + '='));
  return arg ? arg.split('=')[1] : null;
};
const FROM = argVal('from');
const TO   = (argVal('to') || '').split(',').map(s => s.trim()).filter(Boolean);

if (!FROM || !TO.length) {
  console.error('Usage: node copy-menu-dispo.js --from=<restoId> --to=<restoId1,restoId2,...> [--apply]');
  process.exit(1);
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Copie dispo menu — ${FROM} → ${TO.join(', ')} — mode : ${APPLY ? '🟢 APPLY (écriture réelle)' : '🟡 DRY-RUN (aucune écriture)'}`);
  console.log('══════════════════════════════════════════════════════\n');

  const sourceSnap = await db.collection('menu-dispo').where('restoId', '==', FROM).get();
  if (sourceSnap.empty) {
    console.log(`Aucune fiche dispo trouvée pour "${FROM}".`);
    return;
  }
  console.log(`Source : ${sourceSnap.size} articles chez "${FROM}"`);

  for (const target of TO) {
    console.log(`\n--- Vers "${target}" ---`);
    let created = 0, skipped = 0;
    for (const doc of sourceSnap.docs) {
      const src = doc.data();
      const targetId = src.menuItemId + '_' + target;
      const existing = await db.collection('menu-dispo').doc(targetId).get();
      if (existing.exists) { skipped++; continue; }

      const data = {
        menuItemId:   src.menuItemId,
        restoId:      target,
        price:        src.price,
        prixVariable: src.prixVariable,
        order:        src.order || 0,
        available:    false, // désactivé par défaut — à activer manuellement
      };
      if (src.formats != null) data.formats = src.formats;
      if (src.variantePrix != null) data.variantePrix = src.variantePrix;

      created++;
      console.log(`  ${src.menuItemId} → ${targetId} (prix ${src.price})`);
      if (APPLY) {
        await db.collection('menu-dispo').doc(targetId).set({ ...data, updatedAt: FieldValue.serverTimestamp() });
      }
    }
    console.log(`  ${APPLY ? 'Créées' : 'À créer'} : ${created} · déjà existantes (ignorées) : ${skipped}`);
  }

  console.log('\n' + (APPLY
    ? '✅ Terminé. Les articles copiés sont DÉSACTIVÉS — active-les dans Admin → Articles pour ' + TO.join(', ') + '.'
    : '🟡 DRY-RUN terminé. Relance avec --apply pour écrire.'));
  console.log('');
}

main().catch(err => { console.error('❌ Erreur :', err); process.exit(1); });
