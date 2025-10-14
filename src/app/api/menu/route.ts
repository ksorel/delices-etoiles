import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  const client = await clientPromise;
  const db = client.db('delices');

  const [categories, dishes] = await Promise.all([
    db.collection('categories').find().sort({ order: 1 }).toArray(),
    db.collection('dishes').find({ available: true }).toArray(),
  ]);

  return NextResponse.json({ categories, dishes });
}