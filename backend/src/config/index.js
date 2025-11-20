// backend/src/config/index.js
import dotenv from 'dotenv';

dotenv.config();

export default {
  port: process.env.PORT || 3001,
  database: {
    url: process.env.DATABASE_URL
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret_change_in_production',
    expiresIn: '24h'
  },
  environment: process.env.NODE_ENV || 'development',
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};