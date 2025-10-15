'use client';

import { useCart } from '@/contexts/CartContext';
import { useState } from 'react';
import './toast.css';
import { formatXOF } from '@/lib/format';
import Link from 'next/link';

export type Dish = {
  id: string;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: { full: number; half?: number };
  image: string;
  category: string;
};

export default function Client({ dish, lng }: { dish: Dish; lng: string }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    if (added) return;
    addToCart({
      id: dish.id,
      name: dish.name[lng as 'fr' | 'en'],
      price: dish.price.full,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <>
      <main className="max-w-4xl mx-auto p-6">
        <Link
            href={`/${lng}/menu`}
            className="inline-flex items-center text-amber-700 hover:underline mb-4"
        >
            ← Retour à la carte
        </Link>
        <h1 className="text-3xl font-bold mb-2">{dish.name[lng as 'fr' | 'en']}</h1>
        {dish.image && (
            <img
                src={dish.image}
                alt={dish.name[lng as 'fr' | 'en']}
                className="w-full max-h-64 object-cover rounded mb-4"
            />
        )}
        <p className="mb-4">{dish.description?.[lng as 'fr' | 'en'] || ''}</p>
        <p className="text-xl mb-2">Entier : {formatXOF(dish.price.full)} F</p>
        {dish.price.half && <p className="text-xl mb-4">Demi : {formatXOF(dish.price.half)} F</p>}

        <button
          onClick={handleAdd}
          disabled={added}
          className={`px-4 py-2 rounded text-white transition ${
            added ? 'bg-green-600' : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          {added ? 'Ajouté ✓' : 'Ajouter au panier'}
        </button>
      </main>

      <Toast show={added} />
    </>
  );
}

function Toast({ show }: { show: boolean }) {
  return <div className={`toast ${show ? 'show' : ''}`}>Ajouté !</div>;
}