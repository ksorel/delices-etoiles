// backend/migrations/[timestamp]_09_create_order_drink_items.js
export function up(knex) {
  return knex.schema.createTable('order_drink_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE');
    table.uuid('drink_id').references('id').inTable('drinks');
    table.integer('quantity').notNullable().defaultTo(1);
    table.decimal('unit_price', 10, 2).notNullable();
    table.text('serving_notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['order_id']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('order_drink_items');
}