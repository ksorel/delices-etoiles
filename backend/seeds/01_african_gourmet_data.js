// backend/seeds/01_african_gourmet_data.js
export async function seed(knex) {
  // Désactiver les contraintes FK temporairement
  await knex.raw('SET session_replication_role = replica;');
  
  // Supprimer les données existantes dans l'ordre inverse
  await knex('notifications').del();
  await knex('order_status_history').del();
  await knex('order_tracking').del();
  await knex('payments').del();
  await knex('order_drink_items').del();
  await knex('order_items').del();
  await knex('orders').del();
  await knex('drinks').del();
  await knex('dishes').del();
  await knex('restaurant_tables').del();
  await knex('drink_categories').del();
  await knex('categories').del();
  await knex('users').del();

  // Réactiver les contraintes
  await knex.raw('SET session_replication_role = DEFAULT;');

  // 1. UTILISATEURS
  console.log('👥 Création des utilisateurs...');
  const users = await knex('users').insert([
    {
      email: 'admin@delices-etoiles.ci',
      password: '$2b$10$examplehashedpassword', // À hasher plus tard
      first_name: 'Kouamé',
      last_name: 'Traoré',
      phone: '+2250700000001',
      role: 'admin'
    },
    {
      email: 'client@delices-etoiles.ci',
      password: '$2b$10$examplehashedpassword',
      first_name: 'Aïcha',
      last_name: 'Koné',
      phone: '+2250500000001',
      role: 'client'
    },
    {
      email: 'chef@delices-etoiles.ci',
      password: '$2b$10$examplehashedpassword',
      first_name: 'Mamadou',
      last_name: 'Diarrassouba',
      phone: '+2250700000002',
      role: 'chef'
    }
  ]).returning('id');

  // 2. CATÉGORIES DE PLATS
  console.log('📁 Création des catégories...');
  const categories = await knex('categories').insert([
    {
      name_fr: 'Riz et Plats Principaux',
      name_en: 'Rice and Main Dishes',
      description_fr: 'Nos délicieux plats de riz et spécialités principales',
      description_en: 'Our delicious rice dishes and main specialties',
      display_order: 1,
      is_active: true
    },
    {
      name_fr: 'Volailles',
      name_en: 'Poultry',
      description_fr: 'Plats de poulet et volailles préparés avec soin',
      description_en: 'Chicken and poultry dishes prepared with care',
      display_order: 2,
      is_active: true
    },
    {
      name_fr: 'Poissons',
      name_en: 'Fish',
      description_fr: 'Poissons frais de nos rivières et mers',
      description_en: 'Fresh fish from our rivers and seas',
      display_order: 3,
      is_active: true
    },
    {
      name_fr: 'Viandes Exotiques',
      name_en: 'Exotic Meats',
      description_fr: 'Viandes savoureuses et spécialités locales',
      description_en: 'Flavorful meats and local specialties',
      display_order: 4,
      is_active: true
    },
    {
      name_fr: 'Pâtes et Accompagnements',
      name_en: 'Pasta and Side Dishes',
      description_fr: 'Spaghetti et accompagnements délicieux',
      description_en: 'Spaghetti and delicious side dishes',
      display_order: 5,
      is_active: true
    },
    {
      name_fr: 'Choukouya et Grillades',
      name_en: 'Choukouya and Grills',
      description_fr: 'Viandes grillées et choukouya traditionnel',
      description_en: 'Grilled meats and traditional choukouya',
      display_order: 6,
      is_active: true
    }
  ]).returning('id');

  // 3. PLATS GASTRONOMIQUES AFRICAINS
  console.log('🍽️ Création des plats...');
  await knex('dishes').insert([
    // === RIZ ET PLATS PRINCIPAUX ===
    {
      category_id: categories[0].id,
      name_fr: 'Riz Tchép avec Poisson Carpe',
      name_en: 'Thieboudienne with Carp Fish',
      description_fr: 'Riz traditionnel sénégalais avec poisson carpe, légumes et sauce maison',
      description_en: 'Traditional Senegalese rice with carp fish, vegetables and house sauce',
      price: 2000.00,
      preparation_time: 25,
      tags: ['{"traditionnel", "poisson", "riz"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[0].id,
      name_fr: 'Riz Tchép avec Poulet Chair',
      name_en: 'Thieboudienne with Chicken',
      description_fr: 'Riz parfumé avec poulet braisé et légumes frais',
      description_en: 'Fragrant rice with braised chicken and fresh vegetables',
      price: 2000.00,
      preparation_time: 20,
      tags: ['{"poulet", "riz", "populaire"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[0].id,
      name_fr: 'Riz Gras avec Poisson Fumé (1KG)',
      name_en: 'Jollof Rice with Smoked Fish (1KG)',
      description_fr: 'Riz gras parfumé au poisson fumé, spécialité ivoirienne',
      description_en: 'Fragrant jollof rice with smoked fish, Ivorian specialty',
      price: 6000.00,
      preparation_time: 30,
      tags: ['{"fumé", "riz", "traditionnel"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[0].id,
      name_fr: 'Riz Gras avec Viande de Bœuf (1KG)',
      name_en: 'Jollof Rice with Beef (1KG)',
      description_fr: 'Riz gras savoureux avec viande de bœuf tendre',
      description_en: 'Flavorful jollof rice with tender beef',
      price: 8000.00,
      preparation_time: 35,
      tags: ['{"bœuf", "riz", "copieux"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[0].id,
      name_fr: 'Riz Cantonais aux Crevettes (1KG)',
      name_en: 'Shrimp Fried Rice (1KG)',
      description_fr: 'Riz cantonais avec crevettes fraîches et légumes croquants',
      description_en: 'Fried rice with fresh shrimp and crunchy vegetables',
      price: 10000.00,
      preparation_time: 15,
      tags: ['{"crevettes", "asiatique", "riz"}'],
      is_vegetarian: false,
      is_gluten_free: false
    },
    {
      category_id: categories[0].id,
      name_fr: 'Riz au Soumbala avec Viande de Mouton (1KG)',
      name_en: 'Soumbala Rice with Mutton (1KG)',
      description_fr: 'Riz parfumé au soumbala avec viande de mouton tendre',
      description_en: 'Rice flavored with soumbala and tender mutton',
      price: 15000.00,
      preparation_time: 40,
      tags: ['{"soumbala", "mouton", "parfumé"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },

    // === VOLAILLES ===
    {
      category_id: categories[1].id,
      name_fr: 'Poulet Chair Braisé',
      name_en: 'Braised Chicken',
      description_fr: 'Poulet braisé avec épices africaines et accompagnement',
      description_en: 'Chicken braised with African spices and side dish',
      price: 6000.00,
      preparation_time: 20,
      tags: ['{"poulet", "braisé", "épicé"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[1].id,
      name_fr: 'Poulet Chair Sauté',
      name_en: 'Sautéed Chicken',
      description_fr: 'Poulet sauté avec légumes frais et sauce maison',
      description_en: 'Sautéed chicken with fresh vegetables and house sauce',
      price: 6000.00,
      preparation_time: 15,
      tags: ['{"poulet", "sauté", "légumes"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[1].id,
      name_fr: 'Pintade Kedjenou',
      name_en: 'Guinea Fowl Kedjenou',
      description_fr: 'Pintade préparée en kedjenou, cuisson lente aux herbes',
      description_en: 'Guinea fowl prepared kedjenou style, slow cooked with herbs',
      price: 12000.00,
      preparation_time: 45,
      tags: ['{"pintade", "kedjenou", "traditionnel"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },

    // === POISSONS ===
    {
      category_id: categories[2].id,
      name_fr: 'Carpe Eau Douce Braisée',
      name_en: 'Braised Freshwater Carp',
      description_fr: 'Carpe d\'eau douce braisée avec épices et légumes',
      description_en: 'Freshwater carp braised with spices and vegetables',
      price: 8000.00,
      preparation_time: 25,
      tags: ['{"carpe", "braisé", "eau douce"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[2].id,
      name_fr: 'Saint-Pierre Braisé',
      name_en: 'Braised John Dory',
      description_fr: 'Poisson Saint-Pierre braisé, sauce épicée maison',
      description_en: 'Braised John Dory fish with house spicy sauce',
      price: 10000.00,
      preparation_time: 20,
      tags: ['{"saint-pierre", "braisé", "sauce"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },

    // === VIANDES EXOTIQUES ===
    {
      category_id: categories[3].id,
      name_fr: 'Escargot Sauté',
      name_en: 'Sautéed Snails',
      description_fr: 'Escargots frais sautés avec ail et persil',
      description_en: 'Fresh snails sautéed with garlic and parsley',
      price: 10000.00,
      preparation_time: 15,
      tags: ['{"escargot", "sauté", "spécialité"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },

    // === PÂTES ===
    {
      category_id: categories[4].id,
      name_fr: 'Spaghetti Bolognaise',
      name_en: 'Spaghetti Bolognese',
      description_fr: 'Spaghetti avec sauce bolognaise maison et fromage',
      description_en: 'Spaghetti with homemade bolognese sauce and cheese',
      price: 2000.00,
      preparation_time: 12,
      tags: ['{"spaghetti", "bolognaise", "fromage"}'],
      is_vegetarian: false,
      is_gluten_free: false
    },
    {
      category_id: categories[4].id,
      name_fr: 'Spaghetti au Fromage et Poulet',
      name_en: 'Spaghetti with Cheese and Chicken',
      description_fr: 'Spaghetti crémeux avec fromage et poulet',
      description_en: 'Creamy spaghetti with cheese and chicken',
      price: 2000.00,
      preparation_time: 10,
      tags: ['{"spaghetti", "fromage", "poulet"}'],
      is_vegetarian: false,
      is_gluten_free: false
    },

    // === CHOUKOUYA ===
    {
      category_id: categories[5].id,
      name_fr: 'Choukouya de Bœuf',
      name_en: 'Beef Choukouya',
      description_fr: 'Viande de bœuf grillée et épicée, spécialité nigériane',
      description_en: 'Grilled and spiced beef, Nigerian specialty',
      price: 3500.00,
      preparation_time: 18,
      tags: ['{"bœuf", "grillé", "épicé"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[5].id,
      name_fr: 'Choukouya de Poulet Chair',
      name_en: 'Chicken Choukouya',
      description_fr: 'Poulet grillé épicé, servi avec accompagnement',
      description_en: 'Spicy grilled chicken, served with side dish',
      price: 5000.00,
      preparation_time: 20,
      tags: ['{"poulet", "grillé", "épicé"}'],
      is_vegetarian: false,
      is_gluten_free: true
    },
    {
      category_id: categories[5].id,
      name_fr: 'Viande de Mouton Choukouya (1KG)',
      name_en: 'Mutton Choukouya (1KG)',
      description_fr: 'Viande de mouton grillée et épicée, portion généreuse',
      description_en: 'Grilled and spiced mutton, generous portion',
      price: 5500.00,
      preparation_time: 25,
      tags: ['{"mouton", "grillé", "copieux"}'],
      is_vegetarian: false,
      is_gluten_free: true
    }
  ]);

  // 4. CATÉGORIES DE BOISSONS
  console.log('🥤 Création des catégories de boissons...');
  const drinkCategories = await knex('drink_categories').insert([
    {
      name_fr: 'Jus Naturels',
      name_en: 'Natural Juices',
      display_order: 1,
      is_alcoholic: false
    },
    {
      name_fr: 'Boissons Gazeuses',
      name_en: 'Soft Drinks',
      display_order: 2,
      is_alcoholic: false
    },
    {
      name_fr: 'Bières Locales',
      name_en: 'Local Beers',
      display_order: 3,
      is_alcoholic: true
    },
    {
      name_fr: 'Eaux et Rafraîchissements',
      name_en: 'Waters and Refreshments',
      display_order: 4,
      is_alcoholic: false
    }
  ]).returning('id');

  // 5. BOISSONS
  console.log('🍹 Création des boissons...');
  await knex('drinks').insert([
    {
      category_id: drinkCategories[0].id,
      name_fr: 'Jus de Bissap',
      name_en: 'Hibiscus Juice',
      description_fr: 'Jus naturel de bissap, rafraîchissant et vitaminé',
      description_en: 'Natural hibiscus juice, refreshing and vitamin-rich',
      price: 1500.00,
      volume_ml: 500,
      serving_temperature: 'froid',
      glass_type: 'verre à jus'
    },
    {
      category_id: drinkCategories[0].id,
      name_fr: 'Jus de Gnamankou',
      name_en: 'Gnamankou Juice',
      description_fr: 'Jus traditionnel de gnamankou, saveur unique',
      description_en: 'Traditional gnamankou juice, unique flavor',
      price: 2000.00,
      volume_ml: 500,
      serving_temperature: 'froid',
      glass_type: 'verre à jus'
    },
    {
      category_id: drinkCategories[0].id,
      name_fr: 'Jus de Ginger',
      name_en: 'Ginger Juice',
      description_fr: 'Jus de gingembre frais, piquant et revigorant',
      description_en: 'Fresh ginger juice, spicy and invigorating',
      price: 1800.00,
      volume_ml: 500,
      serving_temperature: 'froid',
      glass_type: 'verre à jus'
    },
    {
      category_id: drinkCategories[1].id,
      name_fr: 'Coca-Cola',
      name_en: 'Coca-Cola',
      description_fr: 'Boisson gazeuse classique',
      description_en: 'Classic carbonated drink',
      price: 1000.00,
      volume_ml: 330,
      serving_temperature: 'froid',
      glass_type: 'bouteille'
    },
    {
      category_id: drinkCategories[2].id,
      name_fr: 'Bière Flag',
      name_en: 'Flag Beer',
      description_fr: 'Bière locale ivoirienne, légère et rafraîchissante',
      description_en: 'Ivorian local beer, light and refreshing',
      price: 1500.00,
      volume_ml: 650,
      alcohol_percentage: 5.0,
      serving_temperature: 'très froid',
      glass_type: 'bouteille'
    },
    {
      category_id: drinkCategories[3].id,
      name_fr: 'Eau Minérale 1L',
      name_en: 'Mineral Water 1L',
      description_fr: 'Eau minérale naturelle',
      description_en: 'Natural mineral water',
      price: 800.00,
      volume_ml: 1000,
      serving_temperature: 'froid',
      glass_type: 'bouteille'
    }
  ]);

  // 6. TABLES DU RESTAURANT
  console.log('🪑 Création des tables...');
  await knex('restaurant_tables').insert([
    {
      table_number: 'T01',
      table_name_fr: 'Table Baobab',
      table_name_en: 'Baobab Table',
      capacity: 2,
      location: 'terrasse'
    },
    {
      table_number: 'T02',
      table_name_fr: 'Table Ananas',
      table_name_en: 'Pineapple Table',
      capacity: 4,
      location: 'salon'
    },
    {
      table_number: 'T03',
      table_name_fr: 'Table VIP',
      table_name_en: 'VIP Table',
      capacity: 6,
      location: 'salon_principal'
    },
    {
      table_number: 'T04',
      table_name_fr: 'Table Familiale',
      table_name_en: 'Family Table',
      capacity: 8,
      location: 'salle_privée'
    }
  ]);

  console.log('🎉 Données de test africaines créées avec succès!');
}