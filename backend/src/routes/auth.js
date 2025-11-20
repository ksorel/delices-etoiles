// backend/src/routes/auth.js
import express from 'express';
import { register, login, getProfile, updateProfile } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Routes publiques
router.post('/register', register);
router.post('/login', login);

// Routes protégées
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

export default router;