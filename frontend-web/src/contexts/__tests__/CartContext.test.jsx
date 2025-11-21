import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartProvider, useCart } from '../CartContext';

const TestComponent = () => {
  const { 
    addToCart, 
    removeFromCart, 
    getCartTotal,
    getCartItemsCount 
  } = useCart();

  return (
    <div>
      <div data-testid="cart-count">{getCartItemsCount()}</div>
      <div data-testid="cart-total">{getCartTotal()}</div>
      <button 
        onClick={() => addToCart({ 
          id: '1', 
          name: 'Riz Tchép', 
          price: 4500, 
          type: 'dish' 
        })}
      >
        Add Item
      </button>
      <button 
        onClick={() => removeFromCart('1', 'dish')}
      >
        Remove Item
      </button>
    </div>
  );
};

describe('CartContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('adds item to cart', async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await act(async () => {
      await user.click(screen.getByText('Add Item'));
    });

    expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
    expect(screen.getByTestId('cart-total')).toHaveTextContent('4500');
  });

  it('removes item from cart', async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await act(async () => {
      await user.click(screen.getByText('Add Item'));
    });

    await act(async () => {
      await user.click(screen.getByText('Remove Item'));
    });

    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
    expect(screen.getByTestId('cart-total')).toHaveTextContent('0');
  });
});