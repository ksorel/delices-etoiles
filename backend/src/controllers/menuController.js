// backend/src/controllers/menuController.js
import db from '../config/database.js';

export const getAllDishes = async (req, res) => {
  try {
    const {
      category_id,
      is_vegetarian,
      is_vegan,
      is_gluten_free,
      min_price,
      max_price,
      search
    } = req.query;

    let query = db('dishes')
      .select(
        'dishes.*',
        'categories.name_fr as category_name_fr',
        'categories.name_en as category_name_en'
      )
      .leftJoin('categories', 'dishes.category_id', 'categories.id')
      .where('dishes.is_available', true);

    // Filtres
    if (category_id) {
      query = query.where('dishes.category_id', category_id);
    }

    if (is_vegetarian === 'true') {
      query = query.where('dishes.is_vegetarian', true);
    }

    if (is_vegan === 'true') {
      query = query.where('dishes.is_vegan', true);
    }

    if (is_gluten_free === 'true') {
      query = query.where('dishes.is_gluten_free', true);
    }

    if (min_price) {
      query = query.where('dishes.price', '>=', parseFloat(min_price));
    }

    if (max_price) {
      query = query.where('dishes.price', '<=', parseFloat(max_price));
    }

    if (search) {
      query = query.where(function() {
        this.where('dishes.name_fr', 'ilike', `%${search}%`)
          .orWhere('dishes.name_en', 'ilike', `%${search}%`)
          .orWhere('dishes.description_fr', 'ilike', `%${search}%`)
          .orWhere('dishes.description_en', 'ilike', `%${search}%`);
      });
    }

    const dishes = await query.orderBy('dishes.created_at', 'desc');

    res.json({
      message: 'Plats récupérés avec succès',
      count: dishes.length,
      dishes
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des plats:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les plats'
    });
  }
};

export const getDishById = async (req, res) => {
  try {
    const { id } = req.params;

    const dish = await db('dishes')
      .select(
        'dishes.*',
        'categories.name_fr as category_name_fr',
        'categories.name_en as category_name_en'
      )
      .leftJoin('categories', 'dishes.category_id', 'categories.id')
      .where('dishes.id', id)
      .first();

    if (!dish) {
      return res.status(404).json({
        error: 'Plat non trouvé',
        message: 'Le plat demandé n\'existe pas'
      });
    }

    res.json({
      message: 'Plat récupéré avec succès',
      dish
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du plat:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer le plat'
    });
  }
};

export const getAllDrinks = async (req, res) => {
  try {
    const {
      category_id,
      is_alcoholic,
      min_price,
      max_price,
      search
    } = req.query;

    let query = db('drinks')
      .select(
        'drinks.*',
        'drink_categories.name_fr as category_name_fr',
        'drink_categories.name_en as category_name_en',
        'drink_categories.is_alcoholic'
      )
      .leftJoin('drink_categories', 'drinks.category_id', 'drink_categories.id')
      .where('drinks.is_available', true);

    // Filtres
    if (category_id) {
      query = query.where('drinks.category_id', category_id);
    }

    if (is_alcoholic === 'true') {
      query = query.where('drink_categories.is_alcoholic', true);
    } else if (is_alcoholic === 'false') {
      query = query.where('drink_categories.is_alcoholic', false);
    }

    if (min_price) {
      query = query.where('drinks.price', '>=', parseFloat(min_price));
    }

    if (max_price) {
      query = query.where('drinks.price', '<=', parseFloat(max_price));
    }

    if (search) {
      query = query.where(function() {
        this.where('drinks.name_fr', 'ilike', `%${search}%`)
          .orWhere('drinks.name_en', 'ilike', `%${search}%`)
          .orWhere('drinks.description_fr', 'ilike', `%${search}%`)
          .orWhere('drinks.description_en', 'ilike', `%${search}%`);
      });
    }

    const drinks = await query.orderBy('drinks.created_at', 'desc');

    res.json({
      message: 'Boissons récupérées avec succès',
      count: drinks.length,
      drinks
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des boissons:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les boissons'
    });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await db('categories')
      .select('*')
      .where('is_active', true)
      .orderBy('display_order', 'asc');

    res.json({
      message: 'Catégories récupérées avec succès',
      count: categories.length,
      categories
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les catégories'
    });
  }
};

export const getDrinkCategories = async (req, res) => {
  try {
    const categories = await db('drink_categories')
      .select('*')
      .orderBy('display_order', 'asc');

    res.json({
      message: 'Catégories de boissons récupérées avec succès',
      count: categories.length,
      categories
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des catégories de boissons:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les catégories de boissons'
    });
  }
};