// backend/test-connection.js
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

async function test() {
  try {
    const result = await db.raw('SELECT 1 as test');
    console.log('✅ Connexion réussie!');
    console.log('Résultat:', result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    process.exit(1);
  }
}

test();