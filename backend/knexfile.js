// backend/knexfile.js
import dotenv from 'dotenv';
dotenv.config();

export default {
  development: {
    client: 'pg',
    connection: {
      host: 'localhost',           // ← IMPORTANT: 'localhost' au lieu de 'database'
      port: 5432,
      user: 'restaurant_user',
      password: 'restaurant_password', 
      database: 'delices_etoiles'
    },
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    },
    pool: {
      min: 2,
      max: 10
    }
  },

  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  }
};