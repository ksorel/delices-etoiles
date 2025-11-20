// backend/src/utils/auth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Hasher un mot de passe
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Vérifier un mot de passe
export const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Générer un token JWT
export const generateToken = (userId, email, role) => {
  return jwt.sign(
    { 
      userId, 
      email, 
      role,
      iss: 'delices-etoiles-api',
      aud: 'delices-etoiles-app'
    },
    process.env.JWT_SECRET || 'default_secret_change_in_production',
    { expiresIn: '24h' }
  );
};

// Valider un email
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Valider un mot de passe (min 6 caractères)
export const isValidPassword = (password) => {
  return password && password.length >= 6;
};