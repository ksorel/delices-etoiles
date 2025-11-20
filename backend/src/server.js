// backend/src/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Routes
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';  // ← AJOUT

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de base
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);  // ← AJOUT

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Délices Étoiles API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Erreur serveur interne',
    message: 'Quelque chose s\'est mal passé!'
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    message: 'La route demandée n\'existe pas'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth`);
});