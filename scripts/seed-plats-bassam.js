#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════
 *  seed-plats-bassam.js — Crée/actualise 3 plats à variantes
 *  pour l'établissement Grand-Bassam (restoId = 'bassam')
 *
 *  - Poulet Pondeuse Kedjenou (¼ / ½ / entier)
 *  - Sauce Gouagouassou (4 choix de garniture)
 *  - Sauce claire (mêmes 4 choix de garniture)
 *  + des accompagnements individuels (Riz, Attiéké — extensible) suggérés
 *    en upselling (choix exclusif côté client) pour les catégories
 *    « volailles » (Kedjenou) et « sauces ». Remplace l'ancien article
 *    combiné « Riz ou attiéké », désactivé par ce script.
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

// ── Accompagnements upsell (add-ons, choix exclusif côté client) ──
// Pour ajouter un autre accompagnement plus tard (foutou, banane…),
// il suffit d'ajouter une entrée ici et de relancer le script --apply.
const ACCOMPAGNEMENTS = [
  { name_fr: 'Riz',     name_en: 'Rice',     description_fr: 'Portion de riz blanc',              order: 0, price: 500 },
  { name_fr: 'Attiéké', name_en: 'Attiéké',  description_fr: 'Semoule de manioc fermentée',        order: 1, price: 500 },
];

// Ancien article combiné, remplacé par les accompagnements individuels ci-dessus
const OLD_ACCOMPAGNEMENT_NAME = 'Riz ou attiéké';

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

// Remplace entièrement itemIds par la liste courante des accompagnements
// (permet d'ajouter/retirer des accompagnements en relançant le script).
async function upsertAccompRule(triggerCategory, itemIds) {
  const label = `${triggerCategory}→accompagnement`;
  const snap = await db.collection('upselling-rules')
    .where('restoId', '==', RESTO_ID)
    .where('triggerCategory', '==', triggerCategory)
    .where('type', '==', 'accompagnement')
    .limit(1)
    .get();

  if (!snap.empty) {
    const rule = snap.docs[0];
    const current = rule.data().itemIds || [];
    const same = current.length === itemIds.length && current.every(id => itemIds.includes(id));
    if (same) {
      console.log(`  Règle upsell ${label} : déjà à jour (id ${rule.id})`);
      return;
    }
    console.log(`  Règle upsell ${label} : mise à jour des articles (id ${rule.id})`);
    if (APPLY) await rule.ref.update({ itemIds });
    return;
  }

  console.log(`  Règle upsell ${label} : à créer`);
  if (!APPLY) return;
  await db.collection('upselling-rules').add({
    triggerCategory,
    type:      'accompagnement',
    itemIds,
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

  console.log('\nAncien accompagnement combiné :');
  const oldAccomp = await findByName(OLD_ACCOMPAGNEMENT_NAME);
  if (oldAccomp) {
    console.log(`  ${OLD_ACCOMPAGNEMENT_NAME.padEnd(28)} existe (id ${oldAccomp.id}) → désactivation`);
    if (APPLY) await oldAccomp.ref.set({ available: false }, { merge: true });
  } else {
    console.log(`  ${OLD_ACCOMPAGNEMENT_NAME.padEnd(28)} déjà absent`);
  }

  console.log('\nAccompagnements (add-ons upsell, choix exclusif) :');
  const accompIds = [];
  for (const a of ACCOMPAGNEMENTS) {
    const id = await upsertMenuItem(
      {
        name_fr:        a.name_fr,
        name_en:        a.name_en,
        description_fr: a.description_fr,
        category:       'accompagnements',
        order:          a.order,
        price:          a.price,
        prixVariable:   false,
        salleOnly:      false,
        available:      true,
        restoId:        RESTO_ID,
      },
      // Si l'article existe déjà : corriger prix + s'assurer qu'il est actif.
      { price: a.price, prixVariable: false, available: true }
    );
    if (id) accompIds.push(id);
  }

  console.log('\nRègles d’upselling :');
  if (accompIds.length === ACCOMPAGNEMENTS.length) {
    await upsertAccompRule('volailles', accompIds);
    await upsertAccompRule('sauces', accompIds);
  } else {
    console.log('  (ignorées en DRY-RUN — les ids des accompagnements n’existent pas encore)');
  }

  console.log('\n' + (APPLY
    ? '✅ Terminé. Articles et règle créés/mis à jour dans Firestore.'
    : '🟡 DRY-RUN terminé. Relance avec --apply pour écrire.'));
  console.log('');
}

main().catch(err => { console.error('❌ Erreur :', err); process.exit(1); });
