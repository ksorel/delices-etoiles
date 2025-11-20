// backend/src/config/database.js
import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'restaurant_user',
    password: process.env.DB_PASSWORD || 'restaurant_password',
    database: process.env.DB_NAME || 'delices_etoiles'
  },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

const db = knex(dbConfig);

// Test connection
db.raw('SELECT 1')
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => console.error('❌ Database connection failed:', err));

export default db;