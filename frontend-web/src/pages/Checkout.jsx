import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import OrderForm from '../components/Checkout/OrderForm';
import PaymentInfo from '../components/Checkout/PaymentInfo';
import DeliveryInfo from '../components/Checkout/DeliveryInfo';

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Rediriger si le panier est vide
  if (cartItems.length === 0) {
    navigate('/cart');
    return null;
  }
  
  const handleSubmitOrder = async (orderData) => {
    setIsSubmitting(true);
    try {
      // TODO: Intégration avec API backend POST /api/orders
      const response = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...orderData,
          items: cartItems,
          total: getCartTotal() + 1500, // + frais livraison
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la commande');
      }
      
      const result = await response.json();
      
      // Redirection vers la page de confirmation
      navigate('/confirmation', { 
        state: { 
          orderId: result.orderId || '12345',
          orderData,
          estimatedDelivery: '45-60 minutes'
        } 
      });
      
      // Vider le panier après commande réussie
      clearCart();
      
    } catch (error) {
      console.error('Erreur lors de la commande:', error);
      // TODO: Afficher message d'erreur à l'utilisateur
      alert('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const subtotal = getCartTotal();
  const deliveryFee = 1500;
  const total = subtotal + deliveryFee;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-primary-900 mb-2">
          Finaliser votre commande
        </h1>
        <p className="text-primary-700 mb-8">
          Complétez vos informations pour recevoir vos délices
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne gauche : Formulaire */}
          <div className="lg:col-span-2">
            <OrderForm 
              onSubmit={handleSubmitOrder} 
              isSubmitting={isSubmitting}
            />
          </div>
          
          {/* Colonne droite : Récapitulatif */}
          <div className="space-y-6">
            {/* Récapitulatif de commande */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-semibold text-primary-900 mb-4">
                Récapitulatif
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Sous-total ({cartItems.length} article{cartItems.length > 1 ? 's' : ''})</span>
                  <span className="font-medium">{subtotal.toLocaleString()} XOF</span>
                </div>
                <div className="flex justify-between">
                  <span>Frais de livraison</span>
                  <span className="font-medium">{deliveryFee.toLocaleString()} XOF</span>
                </div>
                <div className="border-t border-primary-100 pt-3 mt-3">
                  <div className="flex justify-between font-bold text-lg text-primary-600">
                    <span>Total</span>
                    <span>{total.toLocaleString()} XOF</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Informations de paiement */}
            <PaymentInfo />
            
            {/* Informations de livraison */}
            <DeliveryInfo />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;