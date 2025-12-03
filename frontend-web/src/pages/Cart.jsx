import { useState } from 'react';
import Header from '../components/Layout/Header';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';

export default function Cart() {
  const { 
    cartItems, 
    removeFromCart, 
    updateQuantity, 
    getCartTotal, 
    clearCart,
    increaseQuantity,
    decreaseQuantity 
  } = useCart();
  
  const navigate = useNavigate();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleProceedToCheckout = () => {
    setIsCheckingOut(true);
    // Plus tard: rediriger vers la page de commande
    console.log('Passage à la commande avec:', cartItems);
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="w-32 h-32 bg-primary-200 rounded-full flex items-center justify-center mx-auto mb-8">
              <span className="text-6xl">🛒</span>
            </div>
            <h1 className="text-4xl font-display font-bold text-primary-900 mb-4">
              Votre panier est vide
            </h1>
            <p className="text-xl text-primary-700 mb-8 max-w-md mx-auto">
              Découvrez nos délicieux plats africains et remplissez votre panier
            </p>
            <button 
              onClick={() => navigate('/menu')}
              className="btn-primary text-lg px-8 py-4"
            >
              Découvrir notre menu
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Calcul des totaux
  const subtotal = getCartTotal();
  const deliveryFee = subtotal > 0 ? 1500 : 0; // 1500 XOF de frais de livraison
  const total = subtotal + deliveryFee;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-primary-900 mb-2">
            Votre Panier
          </h1>
          <p className="text-primary-700">
            {cartItems.length} article{cartItems.length > 1 ? 's' : ''} dans votre panier
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Section des articles */}
          <div className="lg:w-2/3">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="divide-y divide-primary-100">
                {cartItems.map((item) => (
                  <div key={`${item.id}-${item.type}`} className="p-6">
                    <div className="flex flex-col sm:flex-row gap-6">
                      {/* Image/Emoji */}
                      <div className="flex-shrink-0">
                        <div className="w-24 h-24 bg-primary-200 rounded-lg flex items-center justify-center">
                          <span className="text-4xl">
                            {item.type === 'dish' ? '🍽️' : '🥤'}
                          </span>
                        </div>
                      </div>

                      {/* Détails */}
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-xl font-display font-semibold text-primary-900">
                              {item.name}
                            </h3>
                            <p className="text-primary-600 text-sm mt-1">
                              {item.description}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-primary-600">
                            {item.price} XOF
                          </span>
                        </div>

                        <div className="flex justify-between items-center mt-4">
                          {/* Contrôle quantité */}
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => decreaseQuantity(item.id, item.type)}
                              className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors flex items-center justify-center"
                              aria-label="Réduire la quantité"
                            >
                              -
                            </button>
                            <span className="text-lg font-semibold w-8 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => increaseQuantity(item.id, item.type)}
                              className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors flex items-center justify-center"
                              aria-label="Augmenter la quantité"
                            >
                              +
                            </button>
                          </div>

                          {/* Bouton supprimer */}
                          <button
                            onClick={() => removeFromCart(item.id, item.type)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                          >
                            <span>🗑️</span>
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bouton vider panier */}
              <div className="p-6 border-t border-primary-100">
                <button
                  onClick={clearCart}
                  className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center gap-2"
                >
                  <span>🗑️</span>
                  Vider tout le panier
                </button>
              </div>
            </div>
          </div>

          {/* Résumé de commande */}
          <div className="lg:w-1/3">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
              <h2 className="text-2xl font-display font-bold text-primary-900 mb-6">
                Résumé de la commande
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-primary-700">Sous-total</span>
                  <span className="font-semibold">{subtotal} XOF</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-primary-700">Frais de livraison</span>
                  <span className="font-semibold">{deliveryFee} XOF</span>
                </div>

                <div className="border-t border-primary-200 pt-4">
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-primary-900">Total</span>
                    <span className="font-bold text-primary-600">{total} XOF</span>
                  </div>
                  <p className="text-sm text-primary-500 mt-2">
                    Tous les prix sont en Francs CFA (XOF)
                  </p>
                </div>
              </div>

              {/* Bouton de commande */}
              <button
                onClick={handleProceedToCheckout}
                disabled={isCheckingOut}
                className="w-full btn-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                    Traitement...
                  </span>
                ) : (
                  `Passer commande - ${total} XOF`
                )}
              </button>

              {/* Continuer les achats */}
              <button
                onClick={() => navigate('/menu')}
                className="w-full btn-secondary mt-4"
              >
                Continuer mes achats
              </button>

              {/* Informations */}
              <div className="mt-6 pt-6 border-t border-primary-100">
                <p className="text-sm text-primary-600">
                  💳 Paiement sécurisé
                </p>
                <p className="text-sm text-primary-600 mt-2">
                  🚚 Livraison sous 45-60 minutes
                </p>
                <p className="text-sm text-primary-600 mt-2">
                  📞 Contactez-nous au (+225) 0505454866 / (+225) 0789802290
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}