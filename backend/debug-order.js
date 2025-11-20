// backend/debug-order.js
async function debugOrder() {
  const API_BASE = 'http://localhost:3001/api';
  
  console.log('🔧 Débogage de la création de commande...\n');

  try {
    // 1. Connexion
    console.log('1. Connexion...');
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
      console.log('❌ Erreur connexion:', loginData.error);
      return;
    }
    const token = loginData.token;
    console.log('✅ Connecté');

    // 2. Récupérer un plat spécifique (premier de la liste)
    console.log('\n2. Récupération d\'un plat spécifique...');
    const menuResponse = await fetch(`${API_BASE}/menu/dishes`);
    const menuData = await menuResponse.json();
    
    if (!menuResponse.ok) {
      console.log('❌ Erreur menu:', menuData.error);
      return;
    }

    const dish = menuData.dishes[0];
    console.log(`✅ Plat sélectionné: ${dish.name_fr} (ID: ${dish.id})`);

    // 3. Test de création avec des données simplifiées
    console.log('\n3. Test avec données simplifiées...');
    const simpleOrderData = {
      order_type: 'takeaway',
      items: [
        {
          dish_id: dish.id,
          quantity: 1,
          unit_price: dish.price
        }
      ],
      drink_items: [] // Pas de boissons pour simplifier
    };

    console.log('Données envoyées:', JSON.stringify(simpleOrderData, null, 2));

    const orderResponse = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(simpleOrderData)
    });

    const orderResult = await orderResponse.json();
    console.log('Réponse du serveur:', orderResult);

    if (orderResponse.ok) {
      console.log('✅ Commande créée avec succès!');
    } else {
      console.log('❌ Erreur détaillée:', orderResult);
    }

  } catch (error) {
    console.error('❌ Erreur réseau:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugOrder();