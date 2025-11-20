// backend/src/config/database.js
import knex from 'knex';
import knexConfig from '../../knexfile.js';

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

// Surcharger la configuration pour utiliser localhost en développement
const developmentConfig = {
  ...config,
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'restaurant_user',
    password: 'restaurant_password',
    database: 'delices_etoiles'
  }
};

const db = knex(environment === 'development' ? developmentConfig : config);

// Test connection
db.raw('SELECT 1')
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    // Ne pas quitter le processus en développement
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

export default db;