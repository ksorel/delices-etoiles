import { render, screen } from '@testing-library/react';
import { CartProvider } from '../../../contexts/CartContext';
import CartIcon from '../CartIcon';
import { describe, it, expect, vi } from 'vitest';

// Mock du contexte CartContext
const mockUseCart = {
  getCartItemsCount: vi.fn()
};

vi.mock('../../../contexts/CartContext', async () => {
  const actual = await vi.importActual('../../../contexts/CartContext');
  return {
    ...actual,
    useCart: () => mockUseCart
  };
});

describe('CartIcon Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cart icon without badge when cart is empty', () => {
    mockUseCart.getCartItemsCount.mockReturnValue(0);

    render(
      <CartProvider>
        <CartIcon />
      </CartProvider>
    );

    // Vérifie que l'icône est présente
    const cartIcon = document.querySelector('svg');
    expect(cartIcon).toBeInTheDocument();

    // Vérifie que le badge n'est pas affiché
    const badge = screen.queryByText('0');
    expect(badge).not.toBeInTheDocument();
  });

  it('renders cart icon with badge when cart has items', () => {
    mockUseCart.getCartItemsCount.mockReturnValue(3);

    render(
      <CartProvider>
        <CartIcon />
      </CartProvider>
    );

    // Vérifie que le badge est affiché avec le bon nombre
    const badge = screen.getByText('3');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-primary-400');
    expect(badge).toHaveClass('text-primary-900');
  });

  it('shows 9+ badge when cart has more than 9 items', () => {
    mockUseCart.getCartItemsCount.mockReturnValue(12);

    render(
      <CartProvider>
        <CartIcon />
      </CartProvider>
    );

    // Vérifie que le badge affiche "9+" pour plus de 9 articles
    const badge = screen.getByText('9+');
    expect(badge).toBeInTheDocument();
  });

  it('has correct button styling', () => {
    mockUseCart.getCartItemsCount.mockReturnValue(0);

    render(
      <CartProvider>
        <CartIcon />
      </CartProvider>
    );

    const button = document.querySelector('button');
    expect(button).toHaveClass('p-2');
    expect(button).toHaveClass('rounded-full');
    expect(button).toHaveClass('hover:bg-primary-800');
  });

  it('cart icon SVG is properly displayed', () => {
    mockUseCart.getCartItemsCount.mockReturnValue(0);

    render(
      <CartProvider>
        <CartIcon />
      </CartProvider>
    );

    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('w-6');
    expect(svg).toHaveClass('h-6');
    expect(svg).toHaveClass('text-primary-200');
  });
});