#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════
 *  seed-plats-bassam.js — Crée/actualise 3 plats à variantes
 *  pour l'établissement Grand-Bassam (restoId = 'bassam')
 *
 *  - Poulet Pondeuse Kedjenou (¼ / ½ / entier)
 *  - Sauce Gouagouassou (4 choix de garniture)
 *  - Sauce claire (mêmes 4 choix de garniture)
 *  + un accompagnement « Riz ou attiéké » (+500) suggéré en upselling
 *    pour les catégories « volailles » (Kedjenou) et « sauces ».
 *
 *  Idempotent (recherche par name_fr + restoId avant d'écrire) :
 *  relançable sans dégât, met à jour les champs si l'article existe déjà.
 *  DRY-RUN par défaut ; --apply pour écrire.
 *
 *  USAGE (PowerShell) :
 *    $env:GOOGLE_APPLICATION_CREDENTIALS = ".\scripts\serviceAccountKey.json"
 *    node .\scripts\seed-plats-bassam.js            # simulation
 *    node .\scripts\seed-plats-bassam.js --apply    # écriture réelle
 * ════════════════════════════════════════════════════════════
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const APPLY   = process.argv.includes('--apply');
const RESTO_ID = 'bassam';

// ── Articles à variantes ─────────────────────────────────────
const PLATS = [
  {
    name_fr: 'Poulet Pondeuse Kedjenou',
    name_en: 'Kedjenou Chicken (Layer Hen)',
    description_fr: 'Poulet pondeuse mijoté à l’étouffée, épices et légumes',
    category: 'volailles',
    order: 0,
    variantes: [
      { label: '¼',     prix: 2000 },
      { label: '½',     prix: 4000 },
      { label: 'Entier', prix: 8000 },
    ],
  },
  {
    name_fr: 'Sauce Gouagouassou',
    name_en: 'Gouagouassou Sauce',
    description_fr: 'Sauce traditionnelle, au choix avec patte de bœuf, poisson fumé, poisson frais ou côtelettes',
    category: 'sauces',
    order: 0,
    variantes: [
      { label: 'Patte de bœuf',   prix: 1000 },
      { label: 'Poisson fumé',    prix: 1000 },
      { label: 'Poisson frais',   prix: 1000 },
      { label: 'Côtelettes',      prix: 1000 },
    ],
  },
  {
    name_fr: 'Sauce claire',
    name_en: 'Clear Sauce',
    description_fr: 'Sauce claire traditionnelle, au choix avec patte de bœuf, poisson fumé, poisson frais ou côtelettes',
    category: 'sauces',
    order: 1,
    variantes: [
      { label: 'Patte de bœuf',   prix: 1000 },
      { label: 'Poisson fumé',    prix: 1000 },
      { label: 'Poisson frais',   prix: 1000 },
      { label: 'Côtelettes',      prix: 1000 },
    ],
  },
];

// ── Accompagnement upsell (add-on, pas une variante : cumulable) ──
const ACCOMPAGNEMENT = {
  name_fr: 'Riz ou attiéké',
  name_en: 'Rice or Attiéké',
  description_fr: 'Accompagnement au choix pour le Kedjenou',
  category: 'accompagnements',
  order: 0,
  price: 500,
};

async function findByName(nameFr) {
  const snap = await db.collection('menus')
    .where('restoId', '==', RESTO_ID)
    .where('name_fr', '==', nameFr)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

// createData = doc complet si l'article n'existe pas encore.
// patchData  = champs à corriger si l'article existe déjà (on ne touche pas
// au reste : nom EN, description, ordre, sous-catégorie… déjà gérés par l'admin).
async function upsertMenuItem(createData, patchData) {
  const existing = await findByName(createData.name_fr);
  if (existing) {
    console.log(`  ${createData.name_fr.padEnd(28)} existe déjà (id ${existing.id}) → correction : ${Object.keys(patchData).join(', ')}`);
    if (APPLY) await existing.ref.set(patchData, { merge: true });
    return existing.id;
  }
  console.log(`  ${createData.name_fr.padEnd(28)} à créer`);
  if (!APPLY) return null;
  const ref = await db.collection('menus').add(createData);
  return ref.id;
}

async function upsertAccompRule(triggerCategory, accompId) {
  const label = `${triggerCategory}→accompagnement`;
  const snap = await db.collection('upselling-rules')
    .where('restoId', '==', RESTO_ID)
    .where('triggerCategory', '==', triggerCategory)
    .where('type', '==', 'accompagnement')
    .limit(1)
    .get();

  if (!snap.empty) {
    const rule = snap.docs[0];
    const itemIds = rule.data().itemIds || [];
    if (itemIds.includes(accompId)) {
      console.log(`  Règle upsell ${label} : déjà en place (id ${rule.id})`);
      return;
    }
    console.log(`  Règle upsell ${label} : ajout de l'article (id ${rule.id})`);
    if (APPLY) await rule.ref.update({ itemIds: [...itemIds, accompId] });
    return;
  }

  console.log(`  Règle upsell ${label} : à créer`);
  if (!APPLY) return;
  await db.collection('upselling-rules').add({
    triggerCategory,
    type:      'accompagnement',
    itemIds:   [accompId],
    restoId:   RESTO_ID,
  });
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Seed plats Grand-Bassam — mode : ${APPLY ? '🟢 APPLY (écriture réelle)' : '🟡 DRY-RUN (aucune écriture)'}`);
  console.log('══════════════════════════════════════════════════════\n');

  console.log('Plats à variantes :');
  for (const plat of PLATS) {
    await upsertMenuItem(
      {
        name_fr:        plat.name_fr,
        name_en:        plat.name_en,
        description_fr: plat.description_fr,
        category:       plat.category,
        order:          plat.order,
        price:          0,
        prixVariable:   false,
        variantes:      plat.variantes,
        salleOnly:      false,
        available:      true,
        restoId:        RESTO_ID,
      },
      // Si l'article existe déjà : seulement corriger le prix/variantes,
      // et retirer l'ancien système "formats" (demi) devenu obsolète.
      {
        price:        0,
        prixVariable: false,
        variantes:    plat.variantes,
        formats:      FieldValue.delete(),
      }
    );
  }

  console.log('\nAccompagnement (add-on upsell) :');
  const accompId = await upsertMenuItem(
    {
      name_fr:        ACCOMPAGNEMENT.name_fr,
      name_en:        ACCOMPAGNEMENT.name_en,
      description_fr: ACCOMPAGNEMENT.description_fr,
      category:       ACCOMPAGNEMENT.category,
      order:          ACCOMPAGNEMENT.order,
      price:          ACCOMPAGNEMENT.price,
      prixVariable:   false,
      salleOnly:      false,
      available:      true,
      restoId:        RESTO_ID,
    },
    // Si l'article existe déjà : seulement corriger le prix.
    { price: ACCOMPAGNEMENT.price, prixVariable: false }
  );

  console.log('\nRègles d’upselling :');
  if (accompId) {
    await upsertAccompRule('volailles', accompId);
    await upsertAccompRule('sauces', accompId);
  } else {
    console.log('  (ignorées en DRY-RUN — l’id de l’accompagnement n’existe pas encore)');
  }

  console.log('\n' + (APPLY
    ? '✅ Terminé. Articles et règle créés/mis à jour dans Firestore.'
    : '🟡 DRY-RUN terminé. Relance avec --apply pour écrire.'));
  console.log('');
}

main().catch(err => { console.error('❌ Erreur :', err); process.exit(1); });
