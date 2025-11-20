export function up(knex) {
  return knex.schema.createTable('order_status_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE');
    table.string('status', 50).notNullable();
    table.text('status_message_fr');
    table.text('status_message_en');
    table.integer('estimated_time');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['order_id']);
    table.index(['created_at']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('order_status_history');
}