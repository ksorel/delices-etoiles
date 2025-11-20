import Header from '../components/Layout/Header'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🍽️ Délices Étoilés
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Bienvenue dans notre restaurant d'exception
          </p>
          <a 
            href="/menu" 
            className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition"
          >
            Découvrir notre carte
          </a>
        </div>
      </main>
    </div>
  )
}