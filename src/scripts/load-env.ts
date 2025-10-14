#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as path from 'path';

// 1. charge .env.local **avant tout import**
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// 2. vérif
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI absente du .env.local');
  process.exit(1);
}

// 3. import classique (pas top-level await)
import('./seed').catch((e) => {
  console.error(e);
  process.exit(1);
});