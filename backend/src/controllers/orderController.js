// backend/src/controllers/orderController.js
import Order from '../models/Order.js';
import db from '../config/database.js';

export const createOrder = async (req, res) => {
  try {
    const {
      table_id,
      order_type = 'dine_in',
      customer_name,
      customer_phone,
      customer_email,
      special_instructions,
      items,
      drink_items
    } = req.body;

    // Validation des données
    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'Panier vide',
        message: 'Votre panier est vide'
      });
    }

    // Vérifier que les plats existent et sont disponibles
    for (const item of items) {
      const dish = await db('dishes')
        .where('id', item.dish_id)
        .where('is_available', true)
        .first();

      if (!dish) {
        return res.status(400).json({
          error: 'Plat indisponible',
          message: `Le plat ${item.dish_id} n'est pas disponible`
        });
      }

      // Utiliser le prix actuel du plat
      item.unit_price = dish.price;
    }

    // Vérifier que les boissons existent et sont disponibles
    for (const item of drink_items || []) {
      const drink = await db('drinks')
        .where('id', item.drink_id)
        .where('is_available', true)
        .first();

      if (!drink) {
        return res.status(400).json({
          error: 'Boisson indisponible',
          message: `La boisson ${item.drink_id} n'est pas disponible`
        });
      }

      // Utiliser le prix actuel de la boisson
      item.unit_price = drink.price;
    }

    // Créer la commande
    const orderData = {
      user_id: req.user.id,
      table_id,
      order_type,
      customer_name: customer_name || `${req.user.first_name} ${req.user.last_name}`,
      customer_phone: customer_phone || req.user.phone,
      customer_email: customer_email || req.user.email,
      special_instructions,
      items,
      drink_items: drink_items || []
    };

    const order = await Order.create(orderData);

    res.status(201).json({
      message: 'Commande créée avec succès',
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        status: order.status,
        tracking_code: order.tracking_code,
        created_at: order.created_at
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de créer la commande'
    });
  }
};

export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        error: 'Commande non trouvée',
        message: 'La commande demandée n\'existe pas'
      });
    }

    // Vérifier que l'utilisateur peut voir cette commande
    if (order.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette commande'
      });
    }

    res.json({
      message: 'Commande récupérée avec succès',
      order
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer la commande'
    });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const orders = await Order.findByUserId(req.user.id, parseInt(limit));

    res.json({
      message: 'Commandes récupérées avec succès',
      count: orders.length,
      orders
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de récupérer vos commandes'
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, status_message } = req.body;

    // Vérifier que la commande existe
    const order = await Order.findById(id, false);
    if (!order) {
      return res.status(404).json({
        error: 'Commande non trouvée',
        message: 'La commande demandée n\'existe pas'
      });
    }

    // Vérifier les permissions (admin/staff seulement)
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({
        error: 'Permission refusée',
        message: 'Seul le staff peut modifier le statut des commandes'
      });
    }

    // Mettre à jour le statut
    await Order.updateStatus(id, status, status_message);

    res.json({
      message: 'Statut de commande mis à jour avec succès',
      order_id: id,
      new_status: status
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de mettre à jour le statut de la commande'
    });
  }
};

export const trackOrder = async (req, res) => {
  try {
    const { tracking_code } = req.params;

    const tracking = await db('order_tracking')
      .select('*')
      .where('public_tracking_code', tracking_code)
      .first();

    if (!tracking) {
      return res.status(404).json({
        error: 'Code de suivi invalide',
        message: 'Aucune commande trouvée avec ce code de suivi'
      });
    }

    // Mettre à jour le compteur d'accès
    await db('order_tracking')
      .where('id', tracking.id)
      .update({
        access_count: db.raw('access_count + 1'),
        last_accessed_at: new Date()
      });

    // Récupérer les informations de la commande (limitées pour le public)
    const order = await db('orders')
      .select(
        'orders.id',
        'orders.order_number',
        'orders.status',
        'orders.total_amount',
        'orders.created_at',
        'order_status_history.status_message_fr',
        'order_status_history.status_message_en',
        'order_status_history.estimated_time',
        'order_status_history.created_at as status_updated_at'
      )
      .leftJoin('order_status_history', function() {
        this.on('orders.id', '=', 'order_status_history.order_id')
          .andOn('order_status_history.id', '=', 
            db.raw('(SELECT id FROM order_status_history WHERE order_id = orders.id ORDER BY created_at DESC LIMIT 1)')
          );
      })
      .where('orders.id', tracking.order_id)
      .first();

    if (!order) {
      return res.status(404).json({
        error: 'Commande non trouvée',
        message: 'Impossible de récupérer les informations de la commande'
      });
    }

    res.json({
      message: 'Informations de suivi récupérées',
      order: {
        order_number: order.order_number,
        status: order.status,
        status_message_fr: order.status_message_fr,
        status_message_en: order.status_message_en,
        estimated_time: order.estimated_time,
        total_amount: order.total_amount,
        created_at: order.created_at,
        last_updated: order.status_updated_at
      }
    });

  } catch (error) {
    console.error('Erreur lors du suivi de commande:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de suivre la commande'
    });
  }
};