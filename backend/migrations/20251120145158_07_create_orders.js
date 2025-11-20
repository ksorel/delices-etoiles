// backend/migrations/[timestamp]_07_create_orders.js
export function up(knex) {
  return knex.schema.createTable('orders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('order_number', 20).unique().notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('table_id').references('id').inTable('restaurant_tables').onDelete('SET NULL');
    table.string('order_type', 20).defaultTo('dine_in');
    table.string('status', 50).defaultTo('pending');
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('customer_name', 100);
    table.string('customer_phone', 20);
    table.string('customer_email', 255);
    table.text('special_instructions');
    table.timestamp('estimated_completion_time');
    table.timestamp('actual_completion_time');
    table.timestamps(true, true);
    
    table.index(['status']);
    table.index(['created_at']);
    table.index(['order_number']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('orders');
}