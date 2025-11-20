// backend/migrations/[timestamp]_04_create_drink_categories.js
export function up(knex) {
  return knex.schema.createTable('drink_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name_fr', 100).notNullable();
    table.string('name_en', 100).notNullable();
    table.integer('display_order').defaultTo(0);
    table.boolean('is_alcoholic').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['display_order']);
    table.index(['is_alcoholic']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('drink_categories');
}