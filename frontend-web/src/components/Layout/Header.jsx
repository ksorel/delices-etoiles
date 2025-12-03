import Logo from './Logo';
import CartIcon from './CartIcon';

export default function Header() {
  return (
    <header className="bg-primary-900 text-primary-50 shadow-lg border-b border-primary-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/">
              <Logo />
            </a>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8 items-center">
            <a href="/" className="nav-link">Accueil</a>
            <a href="/menu" className="nav-link">Menu</a>
            <a href="/reservation" className="btn-primary">Réserver</a>
          </nav>

          {/* Panier et compte */}
          <div className="flex items-center space-x-4">
            <CartIcon />
          </div>
        </div>
      </div>
    </header>
  );
}