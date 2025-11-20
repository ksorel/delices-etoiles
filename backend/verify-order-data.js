// backend/verify-order-data.js
import db from './src/config/database.js';

async function verifyOrderData() {
  try {
    console.log('🔍 Vérification des données de commande...\n');

    // 1. Commandes
    const orders = await db('orders')
      .select('id', 'order_number', 'total_amount', 'status', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(5);

    console.log('📦 Dernières commandes:');
    orders.forEach(order => {
      console.log(`   ${order.order_number} - ${order.total_amount} XOF - ${order.status}`);
    });

    // 2. Items de commande
    if (orders.length > 0) {
      const orderId = orders[0].id;
      
      const orderItems = await db('order_items')
        .select(
          'order_items.quantity',
          'order_items.unit_price',
          'dishes.name_fr'
        )
        .leftJoin('dishes', 'order_items.dish_id', 'dishes.id')
        .where('order_items.order_id', orderId);

      console.log('\n🍽️ Items de la dernière commande:');
      orderItems.forEach(item => {
        console.log(`   ${item.quantity}x ${item.name_fr} - ${item.unit_price} XOF`);
      });
    }

    // 3. Suivi de commande
    const tracking = await db('order_tracking')
      .select('public_tracking_code', 'order_id', 'access_count')
      .orderBy('created_at', 'desc')
      .limit(3);

    console.log('\n🔍 Codes de suivi:');
    tracking.forEach(track => {
      console.log(`   ${track.public_tracking_code} - Accès: ${track.access_count}`);
    });

    console.log('\n🎉 Données de commande vérifiées avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

verifyOrderData();