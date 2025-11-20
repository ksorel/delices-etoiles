// backend/cleanup-database.js
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

async function cleanup() {
  try {
    console.log('🧹 Nettoyage de la base de données...');
    
    // Désactiver les contraintes FK temporairement
    await db.raw('SET session_replication_role = replica;');
    
    // Supprimer les tables dans l'ordre inverse des dépendances
    const tables = [
      'order_drink_items',
      'order_items', 
      'order_status_history',
      'order_tracking',
      'notifications',
      'payments',
      'orders',
      'drinks',
      'dishes',
      'drink_categories', 
      'categories',
      'restaurant_tables',
      'users'
    ];
    
    for (const table of tables) {
      try {
        await db.schema.dropTableIfExists(table);
        console.log(`✅ Table ${table} supprimée`);
      } catch (error) {
        console.log(`ℹ️ Table ${table} non trouvée ou déjà supprimée`);
      }
    }
    
    // Réactiver les contraintes
    await db.raw('SET session_replication_role = DEFAULT;');
    
    console.log('🎉 Base de données nettoyée avec succès!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    process.exit(1);
  }
}

cleanup();