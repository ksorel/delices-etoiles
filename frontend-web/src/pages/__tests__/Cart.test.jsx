import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cart from '../Cart';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// Mock simple et efficace avec vi.hoisted()
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

// Mock pour CartContext
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

  beforeEach(() => {
    vi.clearAllMocks();
    // Configuration par défaut pour un panier vide
    mockUseCart.mockReturnValue({
      cartItems: [],
      removeFromCart: vi.fn(),
      updateQuantity: vi.fn(),
      increaseQuantity: vi.fn(),
      decreaseQuantity: vi.fn(),
      clearCart: vi.fn(),
      addToCart: vi.fn(),
      getCartTotal: vi.fn(() => 0),
      getCartItemsCount: vi.fn(() => 0),
      isItemInCart: vi.fn(() => false),
      getItemQuantity: vi.fn(() => 0),
    });
  });

  describe('Empty Cart State', () => {
    it('displays empty cart message when cart is empty', () => {
      render(
        <BrowserRouter>
          <Cart />
        </BrowserRouter>
      );

      expect(screen.getByText('Votre panier est vide')).toBeInTheDocument();
      expect(screen.getByText('Découvrir notre menu')).toBeInTheDocument();
    });

    it('navigates to menu when button is clicked', async () => {
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
    beforeEach(() => {
      // Configuration pour un panier avec articles
      mockUseCart.mockReturnValue({
        cartItems: mockCartItems,
        removeFromCart: vi.fn(),
        updateQuantity: vi.fn(),
        increaseQuantity: vi.fn(),
        decreaseQuantity: vi.fn(),
        clearCart: vi.fn(),
        addToCart: vi.fn(),
        getCartTotal: vi.fn(() => 11000), // 2*4500 + 1*2000
        getCartItemsCount: vi.fn(() => 3), // 2 + 1
        isItemInCart: vi.fn(() => false),
        getItemQuantity: vi.fn(() => 0),
      });
    });

    it('displays cart items correctly', () => {
      render(
        <BrowserRouter>
          <Cart />
        </BrowserRouter>
      );

      expect(screen.getByText('Riz Tchép au Poulet')).toBeInTheDocument();
      expect(screen.getByText('Bissap Frais')).toBeInTheDocument();
      // Utilisez une regex pour être plus flexible sur le formatage
      expect(screen.getByText(/articles dans votre panier/i)).toBeInTheDocument();
    });

    it('calculates and displays totals correctly', () => {
      render(
        <BrowserRouter>
          <Cart />
        </BrowserRouter>
      );

      expect(screen.getByText('Sous-total')).toBeInTheDocument();
      expect(screen.getByText('11000 XOF')).toBeInTheDocument();
      expect(screen.getByText('1500 XOF')).toBeInTheDocument();
      expect(screen.getByText('12500 XOF')).toBeInTheDocument();
    });
  });
});