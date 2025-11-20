// backend/test-orders-detailed.js
async function testOrdersDetailed() {
  const API_BASE = 'http://localhost:3001/api';
  
  console.log('🧪 Test détaillé du système de commandes...\n');

  try {
    // 1. Connexion
    console.log('1. 🔐 Connexion...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'client2@delices-etoiles.ci',
        password: 'monmotdepasse'
      })
    });

    const loginData = await loginResponse.json();
    if (!loginResponse.ok) {
      console.log('❌ Erreur connexion:', loginData);
      return;
    }
    const token = loginData.token;
    console.log('✅ Connecté - User ID:', loginData.user.id);

    // 2. Récupérer un plat
    console.log('\n2. 🍽️ Récupération d\'un plat...');
    const menuResponse = await fetch(`${API_BASE}/menu/dishes`);
    const menuData = await menuResponse.json();
    
    if (!menuResponse.ok) {
      console.log('❌ Erreur menu:', menuData);
      return;
    }

    const dish = menuData.dishes[0];
    console.log(`✅ Plat sélectionné: ${dish.name_fr} (ID: ${dish.id})`);

    // 3. Création de commande
    console.log('\n3. 📦 Création de commande...');
    const orderData = {
      order_type: 'takeaway',
      customer_name: 'Test Client',
      customer_phone: '+2250100000000',
      items: [
        {
          dish_id: dish.id,
          quantity: 1,
          unit_price: dish.price
        }
      ],
      drink_items: []
    };

    console.log('📤 Données envoyées:');
    console.log(JSON.stringify(orderData, null, 2));

    const orderResponse = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });

    const result = await orderResponse.text(); // Lire d'abord comme texte
    console.log('📥 Réponse brute:', result);

    let orderResult;
    try {
      orderResult = JSON.parse(result); // Parser en JSON
    } catch (e) {
      console.log('❌ Impossible de parser la réponse JSON');
      return;
    }

    console.log('📋 Réponse parsée:', orderResult);

    if (orderResponse.ok) {
      console.log('✅ Commande créée avec succès!');
      console.log('📦 Détails:', orderResult.order);
    } else {
      console.log('❌ Erreur HTTP:', orderResponse.status);
      console.log('🔍 Détails erreur:', orderResult);
    }

  } catch (error) {
    console.error('💥 Erreur réseau:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOrdersDetailed();