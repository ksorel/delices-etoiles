// ════════════════════════════════════════════════════════════
//  seed.js — Menu réel Délices Étoiles
//  Vide les anciennes données et recharge le vrai menu
//  Usage : node seed.js
// ════════════════════════════════════════════════════════════

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function clearCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`   🗑️  "${name}" vidée (${snap.size} docs)`);
}

// ════════════════════════════════════════════════════════════
//  MENU — Structure :
//    price        = prix ENTIER (portion complète)
//    formats.demi = prix DEMI (si disponible)
//    prixVariable = true si "selon arrivage"
// ════════════════════════════════════════════════════════════
const menuItems = [

  // ── NOS RIZ : Riz Tchep (portion) ───────────────────────
  { category:'riz', subcategory:'Riz Tchep (portion)', order:1,
    name_fr:'Riz Tchep — Poisson Carpe',   name_en:'Thieboudienne — Carp Fish',
    description_fr:'Riz Tchep avec poisson carpe. Prix à la portion.',
    description_en:'Thieboudienne rice with carp fish. Per portion.',
    price:2000, available:true },
  { category:'riz', subcategory:'Riz Tchep (portion)', order:2,
    name_fr:'Riz Tchep — Poulet Chair',    name_en:'Thieboudienne — Chicken',
    description_fr:'Riz Tchep avec poulet chair. Prix à la portion.',
    description_en:'Thieboudienne rice with chicken. Per portion.',
    price:2000, available:true },
  { category:'riz', subcategory:'Riz Tchep (portion)', order:3,
    name_fr:'Riz Tchep — Viande de Bœuf', name_en:'Thieboudienne — Beef',
    description_fr:'Riz Tchep avec viande de bœuf.',
    description_en:'Thieboudienne rice with beef.',
    price:2000, formats:{ demi:1000 }, available:true },

  // ── NOS RIZ : Riz Gras (1kg) ────────────────────────────
  { category:'riz', subcategory:'Riz Gras (1kg)', order:10,
    name_fr:'Riz Gras — Poisson Fumé',     name_en:'Fatty Rice — Smoked Fish',
    description_fr:'Riz gras au poisson fumé. Entier (1kg) ou demi.',
    description_en:'Fatty rice with smoked fish. Whole (1kg) or half.',
    price:6000, formats:{ demi:3000 }, available:true },
  { category:'riz', subcategory:'Riz Gras (1kg)', order:11,
    name_fr:'Riz Gras — Poulet Chair',     name_en:'Fatty Rice — Chicken',
    description_fr:'Riz gras au poulet chair. Entier (1kg) ou demi.',
    description_en:'Fatty rice with chicken. Whole (1kg) or half.',
    price:5000, formats:{ demi:2500 }, available:true },
  { category:'riz', subcategory:'Riz Gras (1kg)', order:12,
    name_fr:'Riz Gras — Viande de Bœuf',  name_en:'Fatty Rice — Beef',
    description_fr:'Riz gras à la viande de bœuf. Entier (1kg) ou demi.',
    description_en:'Fatty rice with beef. Whole (1kg) or half.',
    price:8000, formats:{ demi:4000 }, available:true },
  { category:'riz', subcategory:'Riz Gras (1kg)', order:13,
    name_fr:'Riz Gras — Viande de Mouton', name_en:'Fatty Rice — Mutton',
    description_fr:'Riz gras à la viande de mouton. Entier (1kg) ou demi.',
    description_en:'Fatty rice with mutton. Whole (1kg) or half.',
    price:10000, formats:{ demi:5000 }, available:true },

  // ── NOS RIZ : Riz Cantonais (1kg) ───────────────────────
  { category:'riz', subcategory:'Riz Cantonais (1kg)', order:20,
    name_fr:'Riz Cantonais — Crevette',    name_en:'Fried Rice — Shrimp',
    description_fr:'Riz cantonais aux crevettes. Entier (1kg).',
    description_en:'Cantonese fried rice with shrimps. Whole (1kg).',
    price:10000, available:true },
  { category:'riz', subcategory:'Riz Cantonais (1kg)', order:21,
    name_fr:'Riz Cantonais — Poisson Carpe', name_en:'Fried Rice — Carp Fish',
    description_fr:'Riz cantonais au poisson carpe. Entier (1kg) ou demi.',
    description_en:'Cantonese fried rice with carp fish. Whole or half.',
    price:10000, formats:{ demi:5000 }, available:true },
  { category:'riz', subcategory:'Riz Cantonais (1kg)', order:22,
    name_fr:'Riz Cantonais — Poulet Chair', name_en:'Fried Rice — Chicken',
    description_fr:'Riz cantonais au poulet chair. Entier (1kg) ou demi.',
    description_en:'Cantonese fried rice with chicken. Whole or half.',
    price:10000, formats:{ demi:5000 }, available:true },

  // ── NOS RIZ : Riz Soumbala (1kg) ────────────────────────
  { category:'riz', subcategory:'Riz Soumbala (1kg)', order:30,
    name_fr:'Riz Soumbala — Poisson Carpe',  name_en:'Soumbala Rice — Carp Fish',
    description_fr:'Riz soumbala au poisson carpe.',
    description_en:'Soumbala rice with carp fish.',
    price:6000, available:true },
  { category:'riz', subcategory:'Riz Soumbala (1kg)', order:31,
    name_fr:'Riz Soumbala — Poulet Chair',   name_en:'Soumbala Rice — Chicken',
    description_fr:'Riz soumbala au poulet chair. Entier (1kg) ou demi.',
    description_en:'Soumbala rice with chicken. Whole or half.',
    price:8000, formats:{ demi:4000 }, available:true },
  { category:'riz', subcategory:'Riz Soumbala (1kg)', order:32,
    name_fr:'Riz Soumbala — Poulet Pondeuse', name_en:'Soumbala Rice — Laying Hen',
    description_fr:'Riz soumbala au poulet pondeuse.',
    description_en:'Soumbala rice with laying hen.',
    price:10000, available:true },
  { category:'riz', subcategory:'Riz Soumbala (1kg)', order:33,
    name_fr:'Riz Soumbala — Pintade',        name_en:'Soumbala Rice — Guinea Fowl',
    description_fr:'Riz soumbala à la pintade.',
    description_en:'Soumbala rice with guinea fowl.',
    price:12000, available:true },
  { category:'riz', subcategory:'Riz Soumbala (1kg)', order:34,
    name_fr:'Riz Soumbala — Viande de Bœuf', name_en:'Soumbala Rice — Beef',
    description_fr:'Riz soumbala à la viande de bœuf. Entier (1kg) ou demi.',
    description_en:'Soumbala rice with beef. Whole or half.',
    price:10000, formats:{ demi:5000 }, available:true },
  { category:'riz', subcategory:'Riz Soumbala (1kg)', order:35,
    name_fr:'Riz Soumbala — Viande de Mouton', name_en:'Soumbala Rice — Mutton',
    description_fr:'Riz soumbala à la viande de mouton. Entier (1kg) ou demi.',
    description_en:'Soumbala rice with mutton. Whole or half.',
    price:15000, formats:{ demi:7500 }, available:true },
  { category:'riz', subcategory:'Riz Soumbala (1kg)', order:36,
    name_fr:'Riz Soumbala — Lapin',          name_en:'Soumbala Rice — Rabbit',
    description_fr:'Riz soumbala au lapin.',
    description_en:'Soumbala rice with rabbit.',
    price:15000, available:true },

  // ── NOS VOLAILLES ────────────────────────────────────────
  { category:'volailles', subcategory:'Sauté et Soupe', order:1,
    name_fr:'Poulet Chair Braisé',           name_en:'Grilled Chicken',
    description_fr:'Poulet chair braisé sur charbon. Entier ou demi.',
    description_en:'Charcoal grilled chicken. Whole or half.',
    price:6000, formats:{ demi:3000 }, available:true },
  { category:'volailles', subcategory:'Sauté et Soupe', order:2,
    name_fr:'Poulet Chair Sauté',            name_en:'Sautéed Chicken',
    description_fr:'Poulet chair sauté aux épices. Entier ou demi.',
    description_en:'Spiced sautéed chicken. Whole or half.',
    price:6000, formats:{ demi:3000 }, available:true },
  { category:'volailles', subcategory:'Sauté et Soupe', order:3,
    name_fr:'Poulet en Soupe + Attiéké',     name_en:'Chicken Soup + Attiéké',
    description_fr:'Soupe de poulet avec attiéké. Entier ou demi.',
    description_en:'Chicken soup with attiéké. Whole or half.',
    price:5000, formats:{ demi:2500 }, available:true },
  { category:'volailles', subcategory:'Sauté et Soupe', order:4,
    name_fr:'Poulet en Soupe + Riz',         name_en:'Chicken Soup + Rice',
    description_fr:'Soupe de poulet avec riz. Entier ou demi.',
    description_en:'Chicken soup with rice. Whole or half.',
    price:6000, formats:{ demi:3000 }, available:true },
  { category:'volailles', subcategory:'Sauté et Soupe', order:5,
    name_fr:'Poulet Pondeuse Kedjenou',      name_en:'Laying Hen Kedjenou',
    description_fr:'Poulet pondeuse mijoté en jarre, tradition ivoirienne.',
    description_en:'Laying hen slow-cooked in a clay pot, Ivorian tradition.',
    price:8000, available:true },
  { category:'volailles', subcategory:'Sauté et Soupe', order:6,
    name_fr:'Pintade Kedjenou',              name_en:'Guinea Fowl Kedjenou',
    description_fr:'Pintade mijotée en jarre avec épices ivoiriennes.',
    description_en:'Guinea fowl slow-cooked in a clay pot with Ivorian spices.',
    price:12000, available:true },

  // ── NOS POISSONS ─────────────────────────────────────────
  { category:'poissons', subcategory:'Braisé et Soupe', order:1,
    name_fr:'Soupe Carpe Eau Douce',         name_en:'Freshwater Carp Soup',
    description_fr:'Soupe de carpe eau douce. Prix selon arrivage — appelez-nous.',
    description_en:'Freshwater carp soup. Price on request — call us.',
    price:0, prixVariable:true, available:true },
  { category:'poissons', subcategory:'Braisé et Soupe', order:2,
    name_fr:'Braisé Carpe Eau Douce',        name_en:'Grilled Freshwater Carp',
    description_fr:'Carpe eau douce braisée. Prix selon arrivage — appelez-nous.',
    description_en:'Grilled freshwater carp. Price on request — call us.',
    price:0, prixVariable:true, available:true },
  { category:'poissons', subcategory:'Braisé et Soupe', order:3,
    name_fr:'Soupe Carpe Chinoise',          name_en:'Chinese Carp Soup',
    description_fr:'Soupe de carpe chinoise. Prix selon arrivage — appelez-nous.',
    description_en:'Chinese carp soup. Price on request — call us.',
    price:0, prixVariable:true, available:true },
  { category:'poissons', subcategory:'Braisé et Soupe', order:4,
    name_fr:'Braisé Carpe Chinoise',         name_en:'Grilled Chinese Carp',
    description_fr:'Carpe chinoise braisée. Prix selon arrivage — appelez-nous.',
    description_en:'Grilled Chinese carp. Price on request — call us.',
    price:0, prixVariable:true, available:true },
  { category:'poissons', subcategory:'Braisé et Soupe', order:5,
    name_fr:'Soupe Saint-Pierre',            name_en:'John Dory Soup',
    description_fr:'Soupe de poisson Saint-Pierre. Prix selon arrivage — appelez-nous.',
    description_en:'John Dory fish soup. Price on request — call us.',
    price:0, prixVariable:true, available:true },
  { category:'poissons', subcategory:'Braisé et Soupe', order:6,
    name_fr:'Braisé Saint-Pierre',           name_en:'Grilled John Dory',
    description_fr:'Saint-Pierre braisé. Prix selon arrivage — appelez-nous.',
    description_en:'Grilled John Dory. Price on request — call us.',
    price:0, prixVariable:true, available:true },

  // ── NOS SPAGHETTI ────────────────────────────────────────
  { category:'spaghetti', subcategory:'Nos Spaghetti', order:1,
    name_fr:'Spaghetti Bolognaise',          name_en:'Spaghetti Bolognese',
    description_fr:'Spaghetti à la sauce bolognaise maison.',
    description_en:'Spaghetti with homemade bolognese sauce.',
    price:4000, available:true },
  { category:'spaghetti', subcategory:'Nos Spaghetti', order:2,
    name_fr:'Spaghetti Fromage & Poulet',    name_en:'Spaghetti Cheese & Chicken',
    description_fr:'Spaghetti au fromage fondu et poulet.',
    description_en:'Spaghetti with melted cheese and chicken.',
    price:2000, available:true },
  { category:'spaghetti', subcategory:'Nos Spaghetti', order:3,
    name_fr:'Spaghetti Fromage & Bœuf',     name_en:'Spaghetti Cheese & Beef',
    description_fr:'Spaghetti au fromage fondu et viande de bœuf.',
    description_en:'Spaghetti with melted cheese and beef.',
    price:2000, available:true },

  // ── VIANDES EXOTIQUES ────────────────────────────────────
  { category:'viandes', subcategory:'Viandes Exotiques', order:1,
    name_fr:'Viande de Brousse Kedjenou',    name_en:'Bush Meat Kedjenou',
    description_fr:'Viande de brousse en kedjenou. Prix selon arrivage — appelez-nous.',
    description_en:'Bush meat kedjenou. Price on request — call us.',
    price:0, prixVariable:true, available:true },
  { category:'viandes', subcategory:'Viandes Exotiques', order:2,
    name_fr:'Escargot Sauté',               name_en:'Sautéed Snails',
    description_fr:'Escargots sautés aux épices africaines.',
    description_en:'Snails sautéed with African spices.',
    price:10000, available:true },

  // ── NOS CHOUKOUYA ────────────────────────────────────────
  { category:'viandes', subcategory:'Choukouya', order:10,
    name_fr:'Choukouya — Poulet Chair',      name_en:'Choukouya — Chicken',
    description_fr:'Poulet chair grillé façon choukouya. Entier ou demi.',
    description_en:'Grilled chicken choukouya style. Whole or half.',
    price:3500, formats:{ demi:2000 }, available:true },
  { category:'viandes', subcategory:'Choukouya', order:11,
    name_fr:'Choukouya — Poulet Fourré Pomme de Terre', name_en:'Choukouya — Stuffed Chicken & Potato',
    description_fr:'Poulet fourré pommes de terre, grillé choukouya. Entier ou demi.',
    description_en:'Potato-stuffed chicken, grilled choukouya style. Whole or half.',
    price:5000, formats:{ demi:2500 }, available:true },
  { category:'viandes', subcategory:'Choukouya', order:12,
    name_fr:'Choukouya — Poulet Fourré Petits Pois',    name_en:'Choukouya — Stuffed Chicken & Peas',
    description_fr:'Poulet fourré petits pois, grillé choukouya. Entier ou demi.',
    description_en:'Pea-stuffed chicken, grilled choukouya style. Whole or half.',
    price:5000, formats:{ demi:2500 }, available:true },
  { category:'viandes', subcategory:'Choukouya', order:13,
    name_fr:'Choukouya — Mouton (1kg)',      name_en:'Choukouya — Mutton (1kg)',
    description_fr:'Viande de mouton grillée choukouya. Vendu au kilo.',
    description_en:'Grilled mutton choukouya style. Per kilogram.',
    price:5500, available:true },
  { category:'viandes', subcategory:'Choukouya', order:14,
    name_fr:'Choukouya — Bœuf (1kg)',        name_en:'Choukouya — Beef (1kg)',
    description_fr:'Viande de bœuf grillée choukouya. Vendu au kilo.',
    description_en:'Grilled beef choukouya style. Per kilogram.',
    price:4500, available:true },


  // ── BIÈRES ───────────────────────────────────────────────
  { category:'bieres', subcategory:'Bières', order:1,
    name_fr:'Flag Lager',                   name_en:'Flag Lager Beer',
    description_fr:'Bière ivoirienne Flag bien fraîche. Petite ou grande bouteille.',
    description_en:'Ivorian Flag lager beer, ice cold. Small or large bottle.',
    price:500, formats:{ demi:800 }, available:true },
  { category:'bieres', subcategory:'Bières', order:2,
    name_fr:'Castel Beer',                  name_en:'Castel Beer',
    description_fr:'Bière Castel fraîche. Petite ou grande bouteille.',
    description_en:'Fresh Castel beer. Small or large bottle.',
    price:500, formats:{ demi:800 }, available:true },
  { category:'bieres', subcategory:'Bières', order:3,
    name_fr:'Heineken',                     name_en:'Heineken',
    description_fr:'Heineken importée bien fraîche.',
    description_en:'Imported Heineken, ice cold.',
    price:1000, available:true },
  { category:'bieres', subcategory:'Bières', order:4,
    name_fr:'Bock (bière pression)',        name_en:'Draft Beer',
    description_fr:'Bière pression servie en bock.',
    description_en:'Draft beer served in a mug.',
    price:300, available:true },
  { category:'bieres', subcategory:'Bières', order:5,
    name_fr:'Beaufort',                     name_en:'Beaufort Beer',
    description_fr:'Bière Beaufort fraîche.',
    description_en:'Fresh Beaufort beer.',
    price:500, available:true },

  // ── SPIRITUEUX ────────────────────────────────────────────
  { category:'spiritueux', subcategory:'Spiritueux', order:1,
    name_fr:'Whisky (le verre)',            name_en:'Whisky (glass)',
    description_fr:'Whisky servi au verre. Prix selon la marque — nous contacter.',
    description_en:'Whisky served by the glass. Price varies by brand.',
    price:0, prixVariable:true, available:true },
  { category:'spiritueux', subcategory:'Spiritueux', order:2,
    name_fr:'Rhum (le verre)',              name_en:'Rum (glass)',
    description_fr:'Rhum agricole servi au verre.',
    description_en:'Agricultural rum served by the glass.',
    price:0, prixVariable:true, available:true },
  { category:'spiritueux', subcategory:'Spiritueux', order:3,
    name_fr:'Gin (le verre)',               name_en:'Gin (glass)',
    description_fr:'Gin servi au verre avec tonic ou nature.',
    description_en:'Gin served with tonic or straight.',
    price:0, prixVariable:true, available:true },
  { category:'spiritueux', subcategory:'Spiritueux', order:4,
    name_fr:'Vin rouge (le verre)',         name_en:'Red Wine (glass)',
    description_fr:'Vin rouge servi au verre.',
    description_en:'Red wine served by the glass.',
    price:0, prixVariable:true, available:true },
  { category:'spiritueux', subcategory:'Spiritueux', order:5,
    name_fr:'Champagne / Mousseux',         name_en:'Champagne / Sparkling',
    description_fr:'Champagne ou vin mousseux. Prix selon disponibilité.',
    description_en:'Champagne or sparkling wine. Price on request.',
    price:0, prixVariable:true, available:true },

  // ── EAUX & SODAS ─────────────────────────────────────────
  { category:'eaux', subcategory:'Eaux & Sodas', order:1,
    name_fr:'Eau Minérale (petite)',        name_en:'Mineral Water (small)',
    description_fr:'Eau minérale en bouteille 50cl.',
    description_en:'Mineral water 50cl bottle.',
    price:300, available:true },
  { category:'eaux', subcategory:'Eaux & Sodas', order:2,
    name_fr:'Eau Minérale (grande)',        name_en:'Mineral Water (large)',
    description_fr:'Eau minérale en bouteille 1.5L.',
    description_en:'Mineral water 1.5L bottle.',
    price:600, available:true },
  { category:'eaux', subcategory:'Eaux & Sodas', order:3,
    name_fr:'Coca-Cola',                   name_en:'Coca-Cola',
    description_fr:'Coca-Cola bien frais. Petite ou grande bouteille.',
    description_en:'Ice cold Coca-Cola. Small or large bottle.',
    price:500, formats:{ demi:800 }, available:true },
  { category:'eaux', subcategory:'Eaux & Sodas', order:4,
    name_fr:'Fanta Orange',                name_en:'Fanta Orange',
    description_fr:'Fanta Orange bien frais.',
    description_en:'Ice cold Fanta Orange.',
    price:500, available:true },
  { category:'eaux', subcategory:'Eaux & Sodas', order:5,
    name_fr:'Sprite',                      name_en:'Sprite',
    description_fr:'Sprite bien frais.',
    description_en:'Ice cold Sprite.',
    price:500, available:true },
  { category:'eaux', subcategory:'Eaux & Sodas', order:6,
    name_fr:'Schweppes Tonic',             name_en:'Schweppes Tonic',
    description_fr:'Schweppes Tonic bien frais.',
    description_en:'Ice cold Schweppes Tonic.',
    price:500, available:true },
  { category:'eaux', subcategory:'Eaux & Sodas', order:7,
    name_fr:'Malta (boisson maltée)',      name_en:'Malta (malt drink)',
    description_fr:'Boisson maltée sans alcool, énergisante.',
    description_en:'Non-alcoholic malt drink, energising.',
    price:400, available:true },

  // ── NOS JUS NATURELS ─────────────────────────────────────
  { category:'jus', subcategory:'Jus Naturels', order:1,
    name_fr:'Jus de Gnamakou',              name_en:'Gnamakou Juice',
    description_fr:'Jus naturel de gnamakou (gingembre-citron). Prix selon saison — appelez-nous.',
    description_en:'Natural gnamakou (ginger-lemon) juice. Price on request.',
    price:0, prixVariable:true, available:true },
  { category:'jus', subcategory:'Jus Naturels', order:2,
    name_fr:'Jus d\'Orange Naturel',        name_en:'Natural Orange Juice',
    description_fr:'Jus d\'orange frais pressé. Prix selon saison — appelez-nous.',
    description_en:'Freshly squeezed orange juice. Price on request.',
    price:0, prixVariable:true, available:true },
  { category:'jus', subcategory:'Jus Naturels', order:3,
    name_fr:'Jus de Citron Naturel',        name_en:'Natural Lemon Juice',
    description_fr:'Jus de citron frais pressé. Prix selon saison — appelez-nous.',
    description_en:'Freshly squeezed lemon juice. Price on request.',
    price:0, prixVariable:true, available:true },
  { category:'jus', subcategory:'Jus Naturels', order:4,
    name_fr:'Jus de Passion Naturel',       name_en:'Natural Passion Fruit Juice',
    description_fr:'Jus de fruit de la passion frais. Prix selon saison — appelez-nous.',
    description_en:'Fresh passion fruit juice. Price on request.',
    price:0, prixVariable:true, available:true },
];

const zones = [
  { name:'Grand-Bassam Centre', region:'Grand-Bassam', frais:500,  active:true  },
  { name:'Quartier France',     region:'Grand-Bassam', frais:700,  active:true  },
  { name:'Moossou',             region:'Grand-Bassam', frais:1000, active:true  },
  { name:'Vitré 1 / Vitré 2',  region:'Grand-Bassam', frais:1200, active:true  },
  { name:'Gonzagueville',       region:'Grand-Bassam', frais:1500, active:true  },
  { name:'Port-Bouët',          region:'Abidjan',      frais:2000, active:true  },
  { name:'Marcory',             region:'Abidjan',      frais:2500, active:true  },
  { name:'Treichville',        region:'Abidjan',      frais:2500, active:true  },
  { name:'Koumassi',            region:'Abidjan',      frais:3000, active:true  },
  { name:'Plateau',             region:'Abidjan',      frais:3500, active:false },
  { name:'Cocody',              region:'Abidjan',      frais:4000, active:false },
  { name:'Yopougon',            region:'Abidjan',      frais:5000, active:false },
];

async function seed() {
  console.log('🌱 Démarrage du seeding Firestore…\n');
  console.log('🗑️  Nettoyage des anciennes données…');
  await clearCollection('menus');
  await clearCollection('zones-livraison');
  await clearCollection('upselling-rules');
  console.log('');

  const ts = admin.firestore.FieldValue.serverTimestamp();

  console.log(`📝 Écriture de ${menuItems.length} articles menu…`);
  for (let i = 0; i < menuItems.length; i += 400) {
    const batch = db.batch();
    menuItems.slice(i, i + 400).forEach(item =>
      batch.set(db.collection('menus').doc(), { ...item, createdAt: ts })
    );
    await batch.commit();
  }
  console.log('   ✅ Menu OK\n');

  console.log(`🗺️  Écriture de ${zones.length} zones…`);
  const zBatch = db.batch();
  zones.forEach(z => zBatch.set(db.collection('zones-livraison').doc(), { ...z, createdAt: ts }));
  await zBatch.commit();
  console.log('   ✅ Zones OK\n');

  console.log('⬆️  Création des règles d\'upselling…');
  const docs = (await db.collection('menus').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const getId = name => docs.find(m => m.name_fr === name)?.id;

  const rules = [
    { triggerCategory:'riz',      type:'boisson', itemIds:['Jus de Gnamakou','Jus d\'Orange Naturel','Jus de Citron Naturel','Jus de Passion Naturel'].map(getId).filter(Boolean) },
    { triggerCategory:'volailles',type:'boisson', itemIds:['Jus de Gnamakou','Jus d\'Orange Naturel','Jus de Passion Naturel'].map(getId).filter(Boolean) },
    { triggerCategory:'viandes',  type:'boisson', itemIds:['Jus de Gnamakou','Jus d\'Orange Naturel','Jus de Citron Naturel'].map(getId).filter(Boolean) },
    { triggerCategory:'spaghetti',type:'boisson', itemIds:['Jus de Gnamakou','Jus d\'Orange Naturel','Jus de Passion Naturel'].map(getId).filter(Boolean) },
    { triggerCategory:'poissons', type:'boisson', itemIds:['Jus de Gnamakou','Jus de Citron Naturel'].map(getId).filter(Boolean) },
  ];

  for (const r of rules.filter(r => r.itemIds.length > 0))
    await db.collection('upselling-rules').add({ ...r, createdAt: ts });
  console.log('   ✅ Règles upselling OK\n');

  const avecDemi = menuItems.filter(m => m.formats?.demi).length;
  const variable = menuItems.filter(m => m.prixVariable).length;
  console.log('🎉 Seeding terminé !\n');
  console.log(`   • ${menuItems.length} articles | ${avecDemi} avec Entier/Demi | ${variable} prix variables`);
  console.log(`   • Catégories : ${[...new Set(menuItems.map(m => m.category))].join(', ')}`);
  console.log(`   • ${zones.length} zones de livraison | ${rules.length} règles upselling`);
  process.exit(0);
}

seed().catch(e => { console.error('❌', e); process.exit(1); });
