// backend/test-menu-api.js
async function testMenuAPI() {
  const API_BASE = 'http://localhost:3001/api';
  
  console.log('🧪 Test de l\'API Menu...\n');

  try {
    // 1. Test des catégories
    console.log('1. Test des catégories...');
    const categoriesResponse = await fetch(`${API_BASE}/menu/categories`);
    const categoriesData = await categoriesResponse.json();
    
    if (categoriesResponse.ok) {
      console.log(`✅ ${categoriesData.count} catégories récupérées`);
      categoriesData.categories.forEach(cat => {
        console.log(`   📂 ${cat.name_fr}`);
      });
    } else {
      console.log('❌ Erreur catégories:', categoriesData.error);
    }

    // 2. Test des plats
    console.log('\n2. Test des plats...');
    const dishesResponse = await fetch(`${API_BASE}/menu/dishes`);
    const dishesData = await dishesResponse.json();
    
    if (dishesResponse.ok) {
      console.log(`✅ ${dishesData.count} plats récupérés`);
      dishesData.dishes.slice(0, 3).forEach(dish => {
        console.log(`   🍛 ${dish.name_fr} - ${dish.price} XOF`);
      });
    } else {
      console.log('❌ Erreur plats:', dishesData.error);
    }

    // 3. Test des boissons
    console.log('\n3. Test des boissons...');
    const drinksResponse = await fetch(`${API_BASE}/menu/drinks`);
    const drinksData = await drinksResponse.json();
    
    if (drinksResponse.ok) {
      console.log(`✅ ${drinksData.count} boissons récupérées`);
      drinksData.drinks.slice(0, 3).forEach(drink => {
        console.log(`   🍹 ${drink.name_fr} - ${drink.price} XOF`);
      });
    } else {
      console.log('❌ Erreur boissons:', drinksData.error);
    }

    console.log('\n🎉 Tests de l\'API Menu terminés!');

  } catch (error) {
    console.error('❌ Erreur réseau:', error.message);
  }
}

testMenuAPI();