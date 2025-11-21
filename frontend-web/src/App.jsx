import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './contexts/CartContext'
import Home from './pages/Home'
import Menu from './pages/Menu'

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          {/* Nous ajouterons les autres routes plus tard */}
        </Routes>
      </BrowserRouter>
    </CartProvider>
  )
}

export default App