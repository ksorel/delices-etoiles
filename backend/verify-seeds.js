// backend/verify-seeds.js
import knex from 'knex';

const db = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'restaurant_user',
    password: 'restaurant_password',
    database: 'delices_etoiles'
  }
});

async function verifySeeds() {
  try {
    console.log('📊 VÉRIFICATION DES DONNÉES DE TEST:\n');

    // Compter les utilisateurs
    const users = await db('users').count('id as count');
    console.log(`👥 Utilisateurs: ${users[0].count}`);

    // Compter les catégories
    const categories = await db('categories').count('id as count');
    console.log(`📁 Catégories: ${categories[0].count}`);

    // Compter les plats
    const dishes = await db('dishes').count('id as count');
    console.log(`🍽️ Plats: ${dishes[0].count}`);

    // Afficher quelques plats
    console.log('\n📋 Exemples de plats:');
    const sampleDishes = await db('dishes')
      .select('name_fr', 'price')
      .limit(5);
    
    sampleDishes.forEach(dish => {
      console.log(`   🍛 ${dish.name_fr} - ${dish.price} XOF`);
    });

    // Compter les boissons
    const drinks = await db('drinks').count('id as count');
    console.log(`🍹 Boissons: ${drinks[0].count}`);

    // Compter les tables
    const tables = await db('restaurant_tables').count('id as count');
    console.log(`🪑 Tables: ${tables[0].count}`);

    console.log('\n🎉 Données de test vérifiées avec succès!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifySeeds();