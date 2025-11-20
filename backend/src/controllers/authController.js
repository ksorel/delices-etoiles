// backend/src/controllers/authController.js
import db from '../config/database.js';
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  isValidEmail, 
  isValidPassword 
} from '../utils/auth.js';

export const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    // Validation des données
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        error: 'Données manquantes',
        message: 'Tous les champs obligatoires doivent être remplis'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Email invalide',
        message: 'Veuillez fournir un email valide'
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'Mot de passe faible',
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db('users')
      .where('email', email)
      .first();

    if (existingUser) {
      return res.status(409).json({
        error: 'Email déjà utilisé',
        message: 'Un compte avec cet email existe déjà'
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await hashPassword(password);

    // Créer l'utilisateur
    const [user] = await db('users')
      .insert({
        email,
        password: hashedPassword,
        first_name,
        last_name,
        phone,
        role: 'client'
      })
      .returning(['id', 'email', 'first_name', 'last_name', 'role']);

    // Générer le token JWT
    const token = generateToken(user.id, user.email, user.role);

    res.status(201).json({
      message: 'Compte créé avec succès',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la création du compte'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation des données
    if (!email || !password) {
      return res.status(400).json({
        error: 'Données manquantes',
        message: 'Email et mot de passe sont requis'
      });
    }

    // Trouver l'utilisateur
    const user = await db('users')
      .where('email', email)
      .first();

    if (!user) {
      return res.status(401).json({
        error: 'Identifiants invalides',
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Identifiants invalides',
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Générer le token JWT
    const token = generateToken(user.id, user.email, user.role);

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la connexion'
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'phone', 'role', 'created_at')
      .where('id', req.user.id)
      .first();

    if (!user) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        message: 'Profil non disponible'
      });
    }

    res.json({
      message: 'Profil récupéré avec succès',
      user
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer le profil'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;
    const userId = req.user.id;

    // Mettre à jour le profil
    const [updatedUser] = await db('users')
      .where('id', userId)
      .update({
        first_name,
        last_name,
        phone,
        updated_at: new Date()
      })
      .returning(['id', 'email', 'first_name', 'last_name', 'phone', 'role']);

    res.json({
      message: 'Profil mis à jour avec succès',
      user: updatedUser
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de mettre à jour le profil'
    });
  }
};