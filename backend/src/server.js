const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de base
app.use(helmet());
app.use(cors());
app.use(express.json());

// Import des routes
const userRoutes = require("./routes/users");
const dishRoutes = require("./routes/dishes");

// Routes de base
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Délices Étoiles API is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api", (req, res) => {
  res.json({
    message: "Bienvenue sur l'API Délices Étoiles",
    version: "1.0.0",
    endpoints: [
      "GET /api/health - Santé de l'API",
      "GET /api/users - Liste des utilisateurs",
      "GET /api/users/:id - Détails d'un utilisateur",
      "GET /api/dishes - Liste des plats",
      "GET /api/dishes/:id - Détails d'un plat",
      "GET /api/dishes/category/:category - Plats par catégorie",
    ],
  });
});

// Utilisation des routes
app.use("/api/users", userRoutes);
app.use("/api/dishes", dishRoutes);

// Gestion des erreurs 404
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Délices Étoiles démarré sur le port ${PORT}`);
  console.log(`📊 Environnement: ${process.env.NODE_ENV}`);
  console.log(`🕒 Heure de démarrage: ${new Date().toISOString()}`);
});