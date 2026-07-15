#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════
 *  migrate-menu-catalog.js — Sépare le menu en catalogue partagé
 *  + disponibilité/prix par établissement
 *
 *  AVANT : menus/{id} = { ...fiche article..., restoId, price,
 *          prixVariable, formats, variantes:[{label,prix}], available, order }
 *          (un doc par établissement, même si le plat est identique ailleurs)
 *
 *  APRÈS :
 *    menus/{id}       = fiche partagée (nom, description, photo, catégorie,
 *                        salleOnly, variantes:[{label}] SANS prix)
 *    menu-dispo/{id}_{restoId} = { menuItemId, restoId, price, prixVariable,
 *                        formats, variantePrix:{label:prix}, available, order,
 *                        stockStatus }
 *
 *  Chaque menus/{id} existant garde le MÊME id (les références —
 *  plat-du-jour.menuItemId, upselling-rules.itemIds, stocks.menuItemId —
 *  continuent de pointer au bon endroit).
 *
 *  Idempotent : un doc menus/{id} sans champ `restoId` est considéré déjà
 *  migré et ignoré. Relançable sans dégât.
 *  DRY-RUN par défaut ; --apply pour écrire.
 *
 *  USAGE (PowerShell) :
 *    $env:GOOGLE_APPLICATION_CREDENTIALS = ".\scripts\serviceAccountKey.json"
 *    node .\scripts\migrate-menu-catalog.js            # simulation
 *    node .\scripts\migrate-menu-catalog.js --apply    # écriture réelle
 * ════════════════════════════════════════════════════════════
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

const CATALOG_FIELDS = ['name_fr', 'name_en', 'description_fr', 'description_en', 'category', 'subcategory', 'imageUrl', 'salleOnly', 'createdAt'];

function splitDoc(id, data) {
  const catalog = {};
  for (const f of CATALOG_FIELDS) {
    if (data[f] !== undefined) catalog[f] = data[f];
  }
  // Variantes : on garde les libellés dans le catalogue, sans le prix.
  if (Array.isArray(data.variantes) && data.variantes.length) {
    catalog.variantes = data.variantes.map(v => ({ label: v.label }));
  }

  const dispo = {
    menuItemId: id,
    restoId:    data.restoId,
    price:      data.price ?? 0,
    prixVariable: !!data.prixVariable,
    available:  data.available !== false,
    order:      data.order || 0,
    updatedAt:  FieldValue.serverTimestamp(),
  };
  if (data.formats != null) dispo.formats = data.formats;
  if (data.stockStatus != null) dispo.stockStatus = data.stockStatus;
  if (Array.isArray(data.variantes) && data.variantes.length) {
    dispo.variantePrix = {};
    for (const v of data.variantes) dispo.variantePrix[v.label] = v.prix;
  }

  return { catalog, dispo };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Migration catalogue menu — mode : ${APPLY ? '🟢 APPLY (écriture réelle)' : '🟡 DRY-RUN (aucune écriture)'}`);
  console.log('══════════════════════════════════════════════════════\n');

  const snap = await db.collection('menus').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  let toMigrate = 0, alreadyDone = 0, dispoConflict = 0;

  for (const doc of docs) {
    if (!doc.restoId) {
      alreadyDone++;
      continue;
    }
    const dispoId = doc.id + '_' + doc.restoId;
    const dispoRef = db.collection('menu-dispo').doc(dispoId);
    const existing = await dispoRef.get();
    if (existing.exists) {
      console.log(`  ⚠️  ${(doc.name_fr || doc.id).padEnd(30)} dispo ${dispoId} existe déjà — ignoré (vérifier manuellement)`);
      dispoConflict++;
      continue;
    }

    const { catalog, dispo } = splitDoc(doc.id, doc);
    toMigrate++;
    console.log(`  ${(doc.name_fr || doc.id).padEnd(30)} [${doc.restoId}] → menus/${doc.id} (catalogue) + menu-dispo/${dispoId} (prix ${dispo.price}, dispo ${dispo.available})`);

    if (APPLY) {
      await dispoRef.set(dispo);
      await db.collection('menus').doc(doc.id).set(catalog); // remplace entièrement (retire restoId/price/etc.)
    }
  }

  console.log('\n' + `Articles déjà migrés (sans restoId)  : ${alreadyDone}`);
  console.log(`Conflits dispo déjà existante         : ${dispoConflict}`);
  console.log(`Articles ${APPLY ? 'migrés' : 'à migrer'}                    : ${toMigrate}`);
  console.log('\n' + (APPLY
    ? '✅ Terminé.'
    : '🟡 DRY-RUN terminé. Relance avec --apply pour écrire.'));
  console.log('');
}

main().catch(err => { console.error('❌ Erreur :', err); process.exit(1); });
