/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F8F4E9',   // Ivoire très clair
          100: '#F5F1E6',  // Crème
          200: '#E8D9B0',  // Or clair
          300: '#D4C19A',  // Or moyen
          400: '#C9A96E',  // Or principal (couleur logo)
          500: '#B08D57',  // Or foncé
          600: '#967444',  // Bronze
          700: '#7D5C32',  // Bronze foncé
          800: '#2D2D2D',  // Gris anthracite
          900: '#1A1A1A',  // Noir élégant
        }
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],    // Élégant pour les titres
        body: ["Inter", "sans-serif"],             // Moderne pour le texte
        elegant: ["Cormorant Garamond", "serif"],  // Option luxueuse
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #C9A96E 0%, #B08D57 100%)',
        'texture-paper': "url('texture-paper.jpg')",
      }
    },
  },
  plugins: [],
}