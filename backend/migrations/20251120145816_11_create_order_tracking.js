export function up(knex) {
  return knex.schema.createTable('order_tracking', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE');
    table.string('public_tracking_code', 20).unique().notNullable();
    table.text('qr_code_data');
    table.timestamp('last_accessed_at');
    table.integer('access_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['public_tracking_code']);
    table.index(['order_id']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('order_tracking');
}