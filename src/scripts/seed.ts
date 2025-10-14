#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as path from 'path';

// charge .env.local situé à la racine du projet
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// test rapide
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI absente du .env.local');
  process.exit(1);
}

import clientPromise from '@/lib/mongodb';
import { Category, Dish } from '@/types';

(async () => {
  const client = await clientPromise;
  const db = client.db('delices');

  // 1. Catégories
  const categories: Category[] = [
    { name: { fr: 'Riz', en: 'Rice' }, order: 1 },
    { name: { fr: 'Viandes', en: 'Meat' }, order: 2 },
    { name: { fr: 'Poissons', en: 'Fish' }, order: 3 },
    { name: { fr: 'Jus', en: 'Drinks' }, order: 4 },
  ];
  const catRes = await db.collection<Category>('categories').insertMany(categories);
  const riceId = catRes.insertedIds[0].toString();

  // 2. Plats
  const dishes: Dish[] = [
    {
      name: { fr: 'Riz gras poulet', en: 'Jollof rice & chicken' },
      price: { full: 6000, half: 3000 },
      category: riceId,
      available: true,
      spicy: true,
    },
    {
      name: { fr: 'Riz gras poisson', en: 'Jollof rice & fish' },
      price: { full: 6500, half: 3500 },
      category: riceId,
      available: true,
      spicy: true,
    },
  ];
  await db.collection<Dish>('dishes').insertMany(dishes);

  console.log('✅ Seed terminé');
  process.exit(0);
})();