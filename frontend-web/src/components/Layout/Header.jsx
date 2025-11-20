export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-600">
            🍽️ Délices Étoilés
          </h1>
          <nav className="flex space-x-6">
            <a href="/" className="text-gray-600 hover:text-primary-600">Accueil</a>
            <a href="/menu" className="text-gray-600 hover:text-primary-600">Menu</a>
          </nav>
        </div>
      </div>
    </header>
  )
}