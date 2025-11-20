export function up(knex) {
  return knex.schema.createTable('categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name_fr', 100).notNullable();
    table.string('name_en', 100).notNullable();
    table.text('description_fr');
    table.text('description_en');
    table.string('image_url', 500);
    table.integer('display_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['display_order']);
    table.index(['is_active']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('categories');
}