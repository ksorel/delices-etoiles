import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../Layout/Header';
import { CartProvider } from '../../contexts/CartContext';

const renderWithRouter = (component) => {
  return render(
    <CartProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </CartProvider>
  );
};

describe('Header Component', () => {
  test('renders restaurant name', () => {
    renderWithRouter(<Header />);
    
    const restaurantName = screen.getByText('Délices Étoilés');
    expect(restaurantName).toBeInTheDocument();
  });

  test('renders navigation links', () => {
    renderWithRouter(<Header />);
    
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Réserver')).toBeInTheDocument();
  });

  test('navigation links have correct href', () => {
    renderWithRouter(<Header />);
    
    const homeLink = screen.getByText('Accueil');
    const menuLink = screen.getByText('Menu');
    const reserveLink = screen.getByText('Réserver');
    
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');
    expect(menuLink.closest('a')).toHaveAttribute('href', '/menu');
    expect(reserveLink.closest('a')).toHaveAttribute('href', '/reservation');
  });

  test('renders logo image', () => {
    renderWithRouter(<Header />);
    
    const logoImage = screen.getByAltText('Délices Étoilés - Restaurant Gastronomique');
    expect(logoImage).toBeInTheDocument();
  });

  test('renders restaurant subtitle', () => {
    renderWithRouter(<Header />);
    
    const subtitle = screen.getByText('Restaurant Gastronomique');
    expect(subtitle).toBeInTheDocument();
  });

  test('renders cart icon', () => {
    renderWithRouter(<Header />);
    
    const cartIcon = document.querySelector('svg');
    expect(cartIcon).toBeInTheDocument();
  });
});