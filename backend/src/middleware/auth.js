// backend/src/middleware/auth.js
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Token d\'accès requis',
      message: 'Vous devez être connecté pour accéder à cette ressource'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_in_production');
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role')
      .where('id', decoded.userId)
      .first();

    if (!user) {
      return res.status(401).json({
        error: 'Token invalide',
        message: 'Utilisateur non trouvé'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      error: 'Token invalide',
      message: 'Votre session a expiré, veuillez vous reconnecter'
    });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Non authentifié',
        message: 'Vous devez être connecté'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Permission refusée',
        message: `Rôle ${req.user.role} non autorisé pour cette action`
      });
    }

    next();
  };
};