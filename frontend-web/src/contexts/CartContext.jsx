import React, { createContext, useContext, useState, useEffect } from 'react';

// Créer le contexte
const CartContext = createContext();

// Hook personnalisé pour utiliser le contexte
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// Provider du contexte
export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Charger le panier depuis le localStorage au démarrage
  useEffect(() => {
    const savedCart = localStorage.getItem('delices-etoiles-cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Erreur lors du chargement du panier:', error);
        localStorage.removeItem('delices-etoiles-cart');
      }
    }
  }, []);

  // Sauvegarder le panier dans le localStorage à chaque modification
  useEffect(() => {
    localStorage.setItem('delices-etoiles-cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // Ajouter un article au panier
  const addToCart = (item) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(i => 
        i.id === item.id && i.type === item.type
      );
      
      if (existingItem) {
        // Si l'article existe déjà, augmenter la quantité
        return prevItems.map(i =>
          i.id === item.id && i.type === item.type
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      
      // Sinon, ajouter le nouvel article
      return [...prevItems, { 
        ...item, 
        quantity: item.quantity || 1 
      }];
    });
  };

  // Retirer un article du panier
  const removeFromCart = (itemId, itemType) => {
    setCartItems(prevItems => 
      prevItems.filter(item => !(item.id === itemId && item.type === itemType))
    );
  };

  // Mettre à jour la quantité d'un article
  const updateQuantity = (itemId, itemType, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId, itemType);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId && item.type === itemType
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  // Augmenter la quantité d'un article
  const increaseQuantity = (itemId, itemType) => {
    updateQuantity(itemId, itemType, 
      (cartItems.find(item => item.id === itemId && item.type === itemType)?.quantity || 0) + 1
    );
  };

  // Diminuer la quantité d'un article
  const decreaseQuantity = (itemId, itemType) => {
    const currentItem = cartItems.find(item => 
      item.id === itemId && item.type === itemType
    );
    if (currentItem) {
      updateQuantity(itemId, itemType, currentItem.quantity - 1);
    }
  };

  // Vider complètement le panier
  const clearCart = () => {
    setCartItems([]);
  };

  // Calculer le total du panier
  const getCartTotal = () => {
    return cartItems.reduce((total, item) => 
      total + (item.price * item.quantity), 0
    );
  };

  // Obtenir le nombre total d'articles dans le panier
  const getCartItemsCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  // Vérifier si un article est dans le panier
  const isItemInCart = (itemId, itemType) => {
    return cartItems.some(item => 
      item.id === itemId && item.type === itemType
    );
  };

  // Obtenir la quantité d'un article spécifique
  const getItemQuantity = (itemId, itemType) => {
    const item = cartItems.find(i => 
      i.id === itemId && i.type === itemType
    );
    return item ? item.quantity : 0;
  };

  // Valeur du contexte
  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    increaseQuantity,
    decreaseQuantity,
    clearCart,
    getCartTotal,
    getCartItemsCount,
    isItemInCart,
    getItemQuantity
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;