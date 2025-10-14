import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!uri) throw new Error('Please add MONGODB_URI to .env.local');

if (process.env.NODE_ENV === 'development') {
  // Hot-reload friendly
  const globalWithMongo = global as typeof globalThis & { _mongoClient?: Promise<MongoClient> };
  if (!globalWithMongo._mongoClient) globalWithMongo._mongoClient = new MongoClient(uri, options).connect();
  clientPromise = globalWithMongo._mongoClient;
} else {
  clientPromise = new MongoClient(uri, options).connect();
}

export default clientPromise;