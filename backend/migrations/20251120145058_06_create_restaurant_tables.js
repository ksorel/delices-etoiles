// backend/migrations/[timestamp]_06_create_restaurant_tables.js
export function up(knex) {
  return knex.schema.createTable('restaurant_tables', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('table_number', 10).unique().notNullable();
    table.string('table_name_fr', 100);
    table.string('table_name_en', 100);
    table.integer('capacity').notNullable();
    table.string('location', 100);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['table_number']);
    table.index(['is_active']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('restaurant_tables');
}