const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "database",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "delices_etoiles",
  user: process.env.DB_USER || "restaurant_user",
  password: process.env.DB_PASSWORD || "restaurant_password",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("connect", () => {
  console.log("✅ Connexion à PostgreSQL établie");
});

pool.on("error", (err) => {
  console.error("❌ Erreur de connexion PostgreSQL:", err);
});

module.exports = pool;