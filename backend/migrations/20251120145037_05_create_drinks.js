// backend/migrations/[timestamp]_05_create_drinks.js
export function up(knex) {
  return knex.schema.createTable('drinks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('category_id').references('id').inTable('drink_categories').onDelete('CASCADE');
    table.string('name_fr', 200).notNullable();
    table.string('name_en', 200).notNullable();
    table.text('description_fr');
    table.text('description_en');
    table.decimal('price', 10, 2).notNullable();
    table.integer('volume_ml');
    table.decimal('alcohol_percentage', 4, 2);
    table.string('image_url', 500);
    table.boolean('is_available').defaultTo(true);
    table.string('serving_temperature', 50);
    table.string('glass_type', 100);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['category_id']);
    table.index(['is_available']);
    table.index(['price']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('drinks');
}