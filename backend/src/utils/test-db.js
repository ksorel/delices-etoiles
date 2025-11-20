// backend/src/utils/test-db.js
import db from '../config/database.js';

async function testConnection() {
  try {
    const result = await db.raw('SELECT 1 as test');
    console.log('✅ Database connection successful!');
    console.log('Test result:', result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();