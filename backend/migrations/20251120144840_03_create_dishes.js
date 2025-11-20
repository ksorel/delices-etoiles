// backend/migrations/[timestamp]_03_create_dishes.js
export function up(knex) {
  return knex.schema.createTable('dishes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('category_id').references('id').inTable('categories').onDelete('CASCADE');
    table.string('name_fr', 200).notNullable();
    table.string('name_en', 200).notNullable();
    table.text('description_fr').notNullable();
    table.text('description_en').notNullable();
    table.decimal('price', 10, 2).notNullable();
    table.string('image_url', 500);
    table.boolean('is_available').defaultTo(true);
    table.integer('preparation_time');
    table.boolean('is_vegetarian').defaultTo(false);
    table.boolean('is_vegan').defaultTo(false);
    table.boolean('is_gluten_free').defaultTo(false);
    table.specificType('tags', 'text[]');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['category_id']);
    table.index(['is_available']);
    table.index(['price']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('dishes');
}