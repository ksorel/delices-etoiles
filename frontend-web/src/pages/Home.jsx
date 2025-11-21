import Header from '../components/Layout/Header';
import Logo from '../components/Layout/Logo';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto mb-16">
          <div className="mb-8">
            <span className="inline-block bg-primary-400 text-primary-900 px-4 py-2 rounded-full text-sm font-semibold uppercase tracking-wider mb-6">
              Restaurant Gastronomique Africain
            </span>
            <h1 className="text-5xl md:text-6xl font-display font-bold text-primary-900 mb-6 leading-tight">
              DÉLICES <span className="text-primary-600">ÉTOILÉS</span>
            </h1>
            <p className="text-xl text-primary-700 font-body leading-relaxed mb-8 max-w-2xl mx-auto">
              Une expérience culinaire africaine d'exception, 
              où la tradition rencontre l'innovation dans un cadre raffiné
            </p>
          </div>

          {/* Call-to-Action */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <a 
              href="/menu" 
              className="btn-primary text-lg px-8 py-4"
            >
              Découvrir notre carte
            </a>
            <a 
              href="/reservation" 
              className="btn-secondary"
            >
              Réserver une table
            </a>
          </div>
        </section>

        {/* Features Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="card-elegant p-8 text-center">
            <div className="w-20 h-20 bg-primary-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🍽️</span>
            </div>
            <h3 className="font-display font-semibold text-primary-800 text-xl mb-4">Cuisine Étoilée</h3>
            <p className="text-primary-600 leading-relaxed">
              Saveurs africaines réinventées par notre chef étoilé. 
              Des plats traditionnels revisités avec créativité.
            </p>
          </div>
          
          <div className="card-elegant p-8 text-center">
            <div className="w-20 h-20 bg-primary-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🎨</span>
            </div>
            <h3 className="font-display font-semibold text-primary-800 text-xl mb-4">Cadre Élégant</h3>
            <p className="text-primary-600 leading-relaxed">
              Ambiance raffinée et intimiste. Design contemporain 
              marié à des éléments traditionnels africains.
            </p>
          </div>
          
          <div className="card-elegant p-8 text-center">
            <div className="w-20 h-20 bg-primary-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⭐</span>
            </div>
            <h3 className="font-display font-semibold text-primary-800 text-xl mb-4">Service Prestige</h3>
            <p className="text-primary-600 leading-relaxed">
              Excellence et attention aux détails. Un service 
              personnalisé pour une expérience mémorable.
            </p>
          </div>
        </section>

        {/* Informations pratiques */}
        <section className="bg-primary-800 rounded-2xl p-8 text-primary-50 text-center">
          <h2 className="font-display font-bold text-3xl mb-6">Informations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div>
              <h3 className="font-semibold text-primary-200 mb-2">Horaires</h3>
              <p className="text-primary-100">Lundi - Samedi</p>
              <p className="text-primary-100">12h - 24h00</p>
            </div>
            <div>
              <h3 className="font-semibold text-primary-200 mb-2">Contact</h3>
              <p className="text-primary-100">(+225) 0505454866 / 0789802290</p>
              <p className="text-primary-100">etoiles.delices@gmail.com</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}