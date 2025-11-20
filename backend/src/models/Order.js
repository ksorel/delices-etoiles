// backend/src/models/Order.js
import db from '../config/database.js';

export default class Order {
  // Créer une nouvelle commande
  static async create(orderData) {
    const {
      user_id,
      table_id,
      order_type = 'dine_in',
      customer_name,
      customer_phone,
      customer_email,
      special_instructions,
      items = [],
      drink_items = []
    } = orderData;

    const trx = await db.transaction();

    try {
      // Générer un numéro de commande unique
      const timestamp = Date.now().toString().slice(-6); // 6 derniers chiffres
      const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
      const orderNumber = `CMD${timestamp}${randomStr}`;
      // Calculer le montant total
      let totalAmount = 0;

      // Calculer le total des plats
      items.forEach(item => {
        totalAmount += item.quantity * item.unit_price;
      });

      // Calculer le total des boissons
      drink_items.forEach(item => {
        totalAmount += item.quantity * item.unit_price;
      });

      // Créer la commande principale
      const [order] = await trx('orders')
        .insert({
          order_number: orderNumber,
          user_id,
          table_id,
          order_type,
          total_amount: totalAmount,
          customer_name,
          customer_phone,
          customer_email,
          special_instructions,
          status: 'pending'
        })
        .returning('*');

      // Ajouter les plats à la commande
      if (items.length > 0) {
        const orderItems = items.map(item => ({
          order_id: order.id,
          dish_id: item.dish_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          customizations: item.customizations || null
        }));

        await trx('order_items').insert(orderItems);
      }

      // Ajouter les boissons à la commande
      if (drink_items.length > 0) {
        const orderDrinkItems = drink_items.map(item => ({
          order_id: order.id,
          drink_id: item.drink_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          serving_notes: item.serving_notes || null
        }));

        await trx('order_drink_items').insert(orderDrinkItems);
      }

      // Créer le suivi de commande
      const publicTrackingCode = `TRK${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      await trx('order_tracking').insert({
        order_id: order.id,
        public_tracking_code: publicTrackingCode
      });

      // Ajouter le statut initial dans l'historique
      await trx('order_status_history').insert({
        order_id: order.id,
        status: 'pending',
        status_message_fr: 'Commande reçue',
        status_message_en: 'Order received',
        estimated_time: 5
      });

      await trx.commit();

      return {
        ...order,
        tracking_code: publicTrackingCode
      };

    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Récupérer une commande par ID
  static async findById(id, includeItems = true) {
    const order = await db('orders')
      .select(
        'orders.*',
        'restaurant_tables.table_number',
        'restaurant_tables.table_name_fr',
        'restaurant_tables.table_name_en',
        'users.first_name as user_first_name',
        'users.last_name as user_last_name',
        'users.email as user_email',
        'order_tracking.public_tracking_code'
      )
      .leftJoin('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .leftJoin('users', 'orders.user_id', 'users.id')
      .leftJoin('order_tracking', 'orders.id', 'order_tracking.order_id')
      .where('orders.id', id)
      .first();

    if (!order) return null;

    if (includeItems) {
      // Récupérer les plats de la commande
      const items = await db('order_items')
        .select(
          'order_items.*',
          'dishes.name_fr as dish_name_fr',
          'dishes.name_en as dish_name_en',
          'dishes.image_url as dish_image'
        )
        .leftJoin('dishes', 'order_items.dish_id', 'dishes.id')
        .where('order_items.order_id', id);

      // Récupérer les boissons de la commande
      const drinkItems = await db('order_drink_items')
        .select(
          'order_drink_items.*',
          'drinks.name_fr as drink_name_fr',
          'drinks.name_en as drink_name_en',
          'drinks.image_url as drink_image'
        )
        .leftJoin('drinks', 'order_drink_items.drink_id', 'drinks.id')
        .where('order_drink_items.order_id', id);

      // Récupérer l'historique des statuts
      const statusHistory = await db('order_status_history')
        .select('*')
        .where('order_id', id)
        .orderBy('created_at', 'asc');

      return {
        ...order,
        items,
        drink_items: drinkItems,
        status_history: statusHistory
      };
    }

    return order;
  }

  // Récupérer les commandes d'un utilisateur
  static async findByUserId(userId, limit = 10) {
    const orders = await db('orders')
      .select(
        'orders.*',
        'restaurant_tables.table_number',
        'order_tracking.public_tracking_code'
      )
      .leftJoin('restaurant_tables', 'orders.table_id', 'restaurant_tables.id')
      .leftJoin('order_tracking', 'orders.id', 'order_tracking.order_id')
      .where('orders.user_id', userId)
      .orderBy('orders.created_at', 'desc')
      .limit(limit);

    return orders;
  }

  // Mettre à jour le statut d'une commande
  static async updateStatus(orderId, status, statusMessage = {}) {
    const trx = await db.transaction();

    try {
      // Mettre à jour le statut de la commande
      await trx('orders')
        .where('id', orderId)
        .update({
          status,
          updated_at: new Date()
        });

      // Ajouter à l'historique des statuts
      await trx('order_status_history').insert({
        order_id: orderId,
        status,
        status_message_fr: statusMessage.fr || this.getDefaultStatusMessage(status, 'fr'),
        status_message_en: statusMessage.en || this.getDefaultStatusMessage(status, 'en'),
        estimated_time: this.getEstimatedTimeForStatus(status)
      });

      await trx.commit();

      return true;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Messages de statut par défaut
  static getDefaultStatusMessage(status, language) {
    const messages = {
      pending: {
        fr: 'Commande reçue',
        en: 'Order received'
      },
      confirmed: {
        fr: 'Commande confirmée',
        en: 'Order confirmed'
      },
      preparing: {
        fr: 'En préparation',
        en: 'Being prepared'
      },
      ready: {
        fr: 'Prête à être servie',
        en: 'Ready to serve'
      },
      completed: {
        fr: 'Commande terminée',
        en: 'Order completed'
      },
      cancelled: {
        fr: 'Commande annulée',
        en: 'Order cancelled'
      }
    };

    return messages[status]?.[language] || status;
  }

  // Temps estimé par statut
  static getEstimatedTimeForStatus(status) {
    const times = {
      pending: 5,
      confirmed: 10,
      preparing: 25,
      ready: 5,
      completed: 0
    };

    return times[status] || 0;
  }
}