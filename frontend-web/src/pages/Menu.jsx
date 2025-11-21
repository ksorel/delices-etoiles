import { useState, useEffect } from 'react';
import Header from '../components/Layout/Header';
import { menuService } from '../services/api';
import { useCart } from '../contexts/CartContext';

export default function Menu() {
  const [dishes, setDishes] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { addToCart } = useCart();

  useEffect(() => {
    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Appels API avec extraction des données du bon format
      const [dishesResponse, drinksResponse, categoriesResponse] = await Promise.all([
        menuService.getDishes(),
        menuService.getDrinks(),
        menuService.getCategories()
      ]);

      // Extraire les tableaux des réponses API
      setDishes(dishesResponse.dishes || dishesResponse.data || []);
      setDrinks(drinksResponse.drinks || drinksResponse.data || []);
      setCategories(categoriesResponse.categories || categoriesResponse.data || []);

      // Debug: afficher la structure des données
      console.log('Dishes:', dishesResponse);
      console.log('Drinks:', drinksResponse);
      console.log('Categories:', categoriesResponse);

    } catch (err) {
      console.error('Error loading menu:', err);
      setError('Erreur lors du chargement du menu');
      setDishes([]);
      setDrinks([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les plats par catégorie et recherche
  const filteredDishes = dishes.filter(dish => {
    const matchesCategory = selectedCategory === 'all' || dish.category_id === selectedCategory;
    const matchesSearch = dish.name_fr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dish.description_fr?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-primary-200 rounded w-1/4 mx-auto mb-4"></div>
            <div className="h-4 bg-primary-200 rounded w-1/2 mx-auto mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-6 shadow-md">
                  <div className="h-48 bg-primary-200 rounded mb-4"></div>
                  <div className="h-4 bg-primary-200 rounded mb-2"></div>
                  <div className="h-4 bg-primary-200 rounded w-3/4 mb-4"></div>
                  <div className="h-8 bg-primary-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
            <span className="text-4xl mb-4 block">😞</span>
            <h2 className="text-xl font-display text-red-800 mb-2">Erreur de chargement</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={loadMenuData}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* En-tête du menu */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-primary-900 mb-4">
            Notre Carte Étoilée
          </h1>
          <p className="text-xl text-primary-700 max-w-2xl mx-auto">
            Découvrez nos spécialités africaines revisitées avec créativité et passion
          </p>
        </div>

        {/* Filtres et recherche */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            {/* Barre de recherche */}
            <div className="flex-1 w-full md:max-w-md">
              <input
                type="text"
                placeholder="Rechercher un plat ou ingrédient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              />
            </div>

            {/* Filtres par catégorie */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                }`}
              >
                Tous
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  }`}
                >
                  {category.name_fr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section Plats */}
        <section className="mb-12">
          <h2 className="text-3xl font-display font-semibold text-primary-800 mb-8 text-center">
            Nos Plats Signature
          </h2>
          
          {filteredDishes.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">🍽️</span>
              <h3 className="text-xl font-display text-primary-700 mb-2">Aucun plat trouvé</h3>
              <p className="text-primary-600">Essayez de modifier vos critères de recherche</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredDishes.map(dish => (
                <div key={dish.id} className="card-elegant group hover:scale-105 transition-transform duration-300">
                  <div className="relative overflow-hidden">
                    {/* Image du plat (placeholder pour l'instant) */}
                    <div className="h-48 bg-gradient-to-br from-primary-200 to-primary-300 flex items-center justify-center">
                      <span className="text-6xl text-primary-600">
                        {getDishEmoji(dish.name_fr)}
                      </span>
                    </div>
                    
                    {/* Badges */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                      {dish.is_vegetarian && (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          🌱 Végétarien
                        </span>
                      )}
                      {dish.is_spicy && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          🌶️ Épicé
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-display font-semibold text-primary-900">
                        {dish.name_fr}
                      </h3>
                      <span className="text-lg font-bold text-primary-600">
                        {dish.price} XOF
                      </span>
                    </div>

                    <p className="text-primary-600 mb-4 line-clamp-2">
                      {dish.description_fr}
                    </p>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-primary-500 capitalize">
                        {categories.find(cat => cat.id === dish.category_id)?.name_fr}
                      </span>
                      <button
                        onClick={() => addToCart({
                          id: dish.id,
                          name: dish.name_fr,
                          price: dish.price,
                          type: 'dish',
                          description: dish.description_fr
                        })}
                        className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
                      >
                        <span>+</span>
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section Boissons */}
        <section>
          <h2 className="text-3xl font-display font-semibold text-primary-800 mb-8 text-center">
            Nos Boissons
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {drinks.map(drink => (
              <div key={drink.id} className="card-elegant text-center p-6">
                <div className="w-16 h-16 bg-primary-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{getDrinkEmoji(drink.name_fr)}</span>
                </div>
                
                <h3 className="font-display font-semibold text-primary-900 mb-2">
                  {drink.name_fr}
                </h3>
                
                <p className="text-primary-600 text-sm mb-4">
                  {drink.description_fr}
                </p>
                
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-primary-600">
                    {drink.price} XOF
                  </span>
                  <button
                    onClick={() => addToCart({
                      id: drink.id,
                      name: drink.name_fr,
                      price: drink.price,
                      type: 'drink',
                      description: drink.description_fr
                    })}
                    className="bg-primary-500 text-white w-8 h-8 rounded-full hover:bg-primary-600 transition-colors flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// Helper functions pour les emojis
function getDishEmoji(dishName) {
  const emojiMap = {
    'riz': '🍚',
    'poulet': '🍗',
    'poisson': '🐟',
    'viande': '🥩',
    'légumes': '🥬',
    'pâtes': '🍝',
    'soupe': '🍲'
  };
  
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (dishName.toLowerCase().includes(key)) {
      return emoji;
    }
  }
  return '🍽️';
}

function getDrinkEmoji(drinkName) {
  const emojiMap = {
    'jus': '🧃',
    'bière': '🍺',
    'vin': '🍷',
    'cocktail': '🍹',
    'soda': '🥤',
    'eau': '💧',
    'café': '☕',
    'thé': '🍵'
  };
  
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (drinkName.toLowerCase().includes(key)) {
      return emoji;
    }
  }
  return '🥤';
}