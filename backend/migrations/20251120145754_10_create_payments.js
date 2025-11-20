export function up(knex) {
  return knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE');
    table.string('payment_method', 50).notNullable();
    table.string('payment_status', 20).defaultTo('pending');
    table.decimal('amount', 10, 2).notNullable();
    table.string('stripe_payment_intent_id', 100);
    table.string('currency', 3).defaultTo('EUR');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['order_id']);
    table.index(['payment_status']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('payments');
}