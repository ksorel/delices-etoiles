import Logo from './Logo';

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

          {/* Navigation principale */}
          <nav className="hidden md:flex space-x-8 items-center">
            <a 
              href="/" 
              className="text-primary-200 hover:text-primary-50 transition-colors duration-300 font-body font-medium py-2 border-b-2 border-transparent hover:border-primary-400"
            >
              Accueil
            </a>
            <a 
              href="/menu" 
              className="text-primary-200 hover:text-primary-50 transition-colors duration-300 font-body font-medium py-2 border-b-2 border-transparent hover:border-primary-400"
            >
              Menu
            </a>
            <a 
              href="/reservation" 
              className="bg-primary-400 text-primary-900 px-6 py-2 rounded-lg hover:bg-primary-300 transition-all duration-300 font-body font-semibold shadow-md hover:shadow-lg"
            >
              Réserver
            </a>
          </nav>

          {/* Panier et compte (à implémenter plus tard) */}
          <div className="flex items-center space-x-4">
            <button className="text-primary-200 hover:text-primary-50 transition-colors">
              <span className="text-lg">🛒</span>
              <span className="ml-1 text-xs bg-primary-400 text-primary-900 rounded-full w-5 h-5 flex items-center justify-center">0</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}