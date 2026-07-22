#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════
 *  seed-restos.js — Crée les établissements existants dans 'restos'
 *
 *  Transforme les 3 lieux (jusqu'ici codés en dur) en documents Firestore,
 *  source unique désormais gérée par le propriétaire depuis l'admin.
 *
 *  Idempotent (merge) : relançable sans dégât, ne réécrit que les champs
 *  fournis. DRY-RUN par défaut ; --apply pour écrire.
 *
 *  USAGE (PowerShell) :
 *    $env:GOOGLE_APPLICATION_CREDENTIALS = ".\scripts\serviceAccountKey.json"
 *    node .\scripts\seed-restos.js            # simulation
 *    node .\scripts\seed-restos.js --apply    # écriture réelle
 *
 *  ⚠️ Ajuste librement nom / commune / adresse ci-dessous avant le --apply.
 * ════════════════════════════════════════════════════════════
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

// id technique (= restoId utilisé partout comme filtre) → métadonnées
const LIEUX = [
  { id: 'bassam', nom: 'Délices Étoiles — Grand-Bassam', commune: 'Grand-Bassam', adresse: '', actif: true, ordre: 1 },
  { id: 'abobo',  nom: 'Délices Étoiles — Abobo',        commune: 'Abobo',        adresse: '', actif: true, ordre: 2 },
  { id: 'ebimpe', nom: 'Délices Étoiles — Ébimpé',       commune: 'Ébimpé',       adresse: '', actif: true, ordre: 3 },
];

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Seed restos — mode : ${APPLY ? '🟢 APPLY (écriture réelle)' : '🟡 DRY-RUN (aucune écriture)'}`);
  console.log('══════════════════════════════════════════════════════\n');

  for (const { id, ...data } of LIEUX) {
    const ref = db.collection('restos').doc(id);
    const snap = await ref.get();
    const exists = snap.exists;
    console.log(`  ${id.padEnd(8)} ${exists ? 'existe déjà (merge)' : 'à créer'}  → "${data.nom}" (${data.commune}), actif=${data.actif}, ordre=${data.ordre}`);
    if (APPLY) {
      await ref.set(
        { ...data, updatedAt: new Date() },
        { merge: true }
      );
    }
  }

  console.log('\n' + (APPLY
    ? '✅ Terminé. Établissements seedés dans la collection restos.'
    : '🟡 DRY-RUN terminé. Relance avec --apply pour écrire.'));
  console.log('');
}

main().catch(err => { console.error('❌ Erreur :', err); process.exit(1); });
