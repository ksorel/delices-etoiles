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

async function verifyCompleteSchema() {
  try {
    const expectedTables = [
      'users', 'categories', 'dishes', 'drink_categories', 'drinks',
      'restaurant_tables', 'orders', 'order_items', 'order_drink_items',
      'payments', 'order_tracking', 'order_status_history', 'notifications'
    ];

    const result = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const existingTables = result.rows.map(row => row.table_name);
    
    console.log('📊 VÉRIFICATION DU SCHÉMA COMPLET:\n');
    
    expectedTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ ${table} - MANQUANTE`);
      }
    });

    console.log(`\n🎯 ${existingTables.filter(t => expectedTables.includes(t)).length}/${expectedTables.length} tables créées`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyCompleteSchema();