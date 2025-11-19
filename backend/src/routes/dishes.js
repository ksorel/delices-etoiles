const express = require("express");
const router = express.Router();
const pool = require("../config/database");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description, price, category, image_url, available, created_at FROM dishes ORDER BY category, name"
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des plats:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT id, name, description, price, category, image_url, available, created_at FROM dishes WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Plat non trouvé",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du plat:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const result = await pool.query(
      "SELECT id, name, description, price, category, image_url, available FROM dishes WHERE category = $1 AND available = true ORDER BY name",
      [category]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
      category: category,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des plats par catégorie:", error);
    res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
});

module.exports = router;