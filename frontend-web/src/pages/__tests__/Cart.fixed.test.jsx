import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cart from '../Cart';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// IMPORTANT: Les mocks doivent être hoisted ou définis inline
// Solution: utiliser vi.hoisted() pour les variables partagées
const mockUseCart = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

// Mock pour react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock pour CartContext - utiliser la variable hoisted
vi.mock('../../contexts/CartContext', () => ({
  useCart: mockUseCart,
  CartProvider: ({ children }) => <>{children}</>,
}));

describe('Cart Page', () => {
  const mockCartItems = [
    {
      id: '1',
      name: 'Riz Tchép au Poulet',
      price: 4500,
      type: 'dish',
      quantity: 2,
    },
    {
      id: '2',
      name: 'Bissap Frais',
      price: 2000,
      type: 'drink',
      quantity: 1,
    },
  ];

  const getMockCartContext = (items = []) => ({
    cartItems: items,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    increaseQuantity: vi.fn(),
    decreaseQuantity: vi.fn(),
    clearCart: vi.fn(),
    addToCart: vi.fn(),
    getCartTotal: vi.fn(() => items.reduce((total, item) => total + (item.price * item.quantity), 0)),
    getCartItemsCount: vi.fn(() => items.reduce((count, item) => count + item.quantity, 0)),
    isItemInCart: vi.fn(() => false),
    getItemQuantity: vi.fn(() => 0),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Cart State', () => {
    it('displays empty cart message when cart is empty', () => {
      mockUseCart.mockReturnValue(getMockCartContext([]));

      render(
        <BrowserRouter>
          <Cart />
        </BrowserRouter>
      );

      expect(screen.getByText('Votre panier est vide')).toBeInTheDocument();
      expect(screen.getByText('Découvrir notre menu')).toBeInTheDocument();
    });

    it('navigates to menu when button is clicked', async () => {
      mockUseCart.mockReturnValue(getMockCartContext([]));
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <Cart />
        </BrowserRouter>
      );

      const menuButton = screen.getByText('Découvrir notre menu');
      await user.click(menuButton);

      expect(mockNavigate).toHaveBeenCalledWith('/menu');
    });
  });

  describe('Cart with Items', () => {
    it('displays cart items correctly', () => {
      mockUseCart.mockReturnValue(getMockCartContext(mockCartItems));

      render(
        <BrowserRouter>
          <Cart />
        </BrowserRouter>
      );

      expect(screen.getByText('Riz Tchép au Poulet')).toBeInTheDocument();
      expect(screen.getByText('Bissap Frais')).toBeInTheDocument();
    });
  });
});