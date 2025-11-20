// backend/test-orders.js
async function testOrders() {
  const API_BASE = 'http://localhost:3001/api';
  
  console.log('🧪 Test du système de commandes...\n');

  try {
    // 1. Connexion pour obtenir un token
    console.log('1. Connexion...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'client2@delices-etoiles.ci',
        password: 'monmotdepasse'
      })
    });

    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.log('❌ Erreur connexion:', loginData.error);
      return;
    }

    const token = loginData.token;
    console.log('✅ Connecté avec token');

    // 2. Récupérer quelques plats et boissons pour la commande
    console.log('\n2. Récupération du menu...');
    const menuResponse = await fetch(`${API_BASE}/menu/dishes`);
    const menuData = await menuResponse.json();
    
    if (!menuResponse.ok) {
      console.log('❌ Erreur menu:', menuData.error);
      return;
    }

    const dishes = menuData.dishes.slice(0, 2); // Prendre 2 plats
    const drinksResponse = await fetch(`${API_BASE}/menu/drinks`);
    const drinksData = await drinksResponse.json();
    const drinks = drinksData.drinks.slice(0, 1); // Prendre 1 boisson

    console.log(`✅ ${dishes.length} plats et ${drinks.length} boissons sélectionnés`);

    // 3. Créer une commande
    console.log('\n3. Création d\'une commande...');
    const orderData = {
      table_id: null, // Commande à emporter
      order_type: 'takeaway',
      items: dishes.map(dish => ({
        dish_id: dish.id,
        quantity: Math.floor(Math.random() * 2) + 1, // 1-2 portions
        unit_price: dish.price
      })),
      drink_items: drinks.map(drink => ({
        drink_id: drink.id,
        quantity: Math.floor(Math.random() * 2) + 1, // 1-2 boissons
        unit_price: drink.price
      })),
      special_instructions: 'Sans piment s\'il vous plaît'
    };

    const orderResponse = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });

    const orderDataResponse = await orderResponse.json();
    
    if (orderResponse.ok) {
      console.log('✅ Commande créée avec succès!');
      console.log(`   📦 Numéro: ${orderDataResponse.order.order_number}`);
      console.log(`   💰 Total: ${orderDataResponse.order.total_amount} XOF`);
      console.log(`   🔍 Code suivi: ${orderDataResponse.order.tracking_code}`);
    } else {
      console.log('❌ Erreur commande:', orderDataResponse.error);
    }

    // 4. Récupérer les commandes de l'utilisateur
    console.log('\n4. Récupération des commandes utilisateur...');
    const userOrdersResponse = await fetch(`${API_BASE}/orders/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const userOrdersData = await userOrdersResponse.json();
    
    if (userOrdersResponse.ok) {
      console.log(`✅ ${userOrdersData.count} commandes récupérées`);
    } else {
      console.log('❌ Erreur commandes utilisateur:', userOrdersData.error);
    }

    console.log('\n🎉 Tests du système de commandes terminés!');

  } catch (error) {
    console.error('❌ Erreur réseau:', error.message);
  }
}

testOrders();