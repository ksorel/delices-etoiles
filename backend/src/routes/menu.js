// backend/src/routes/menu.js
import express from 'express';
import {
  getAllDishes,
  getDishById,
  getAllDrinks,
  getCategories,
  getDrinkCategories
} from '../controllers/menuController.js';

const router = express.Router();

// Routes publiques pour le menu
router.get('/dishes', getAllDishes);
router.get('/dishes/:id', getDishById);
router.get('/drinks', getAllDrinks);
router.get('/categories', getCategories);
router.get('/drink-categories', getDrinkCategories);

export default router;