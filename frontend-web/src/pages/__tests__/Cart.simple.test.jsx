import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Cart from '../Cart';
import { BrowserRouter } from 'react-router-dom';

// Mock minimal
vi.mock('../../contexts/CartContext', () => ({
  useCart: () => ({
    cartItems: [],
    getCartItemsCount: () => 0,
    getCartTotal: () => 0,
    clearCart: vi.fn(),
    removeFromCart: vi.fn(),
    increaseQuantity: vi.fn(),
    decreaseQuantity: vi.fn(),
    addToCart: vi.fn(),
    updateQuantity: vi.fn(),
    isItemInCart: vi.fn(),
    getItemQuantity: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Cart Page - Simple Test', () => {
  it('renders without crashing', () => {
    render(
      <BrowserRouter>
        <Cart />
      </BrowserRouter>
    );
    
    // Utilisez un texte plus spécifique
    expect(screen.getByText('Votre panier est vide')).toBeInTheDocument();
  });
  
  it('shows empty cart message', () => {
    render(
      <BrowserRouter>
        <Cart />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Votre panier est vide')).toBeInTheDocument();
    expect(screen.getByText('Découvrir notre menu')).toBeInTheDocument();
  });
});