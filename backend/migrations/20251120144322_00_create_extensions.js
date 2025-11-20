// backend/migrations/[timestamp]_00_create_extensions.js
export function up(knex) {
  return knex.raw(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);
}

export function down(knex) {
  return knex.raw(`
    DROP EXTENSION IF EXISTS pgcrypto;
    DROP EXTENSION IF EXISTS "uuid-ossp";
  `);
}