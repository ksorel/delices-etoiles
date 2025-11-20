export function up(knex) {
  return knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE');
    table.string('type', 50).notNullable();
    table.string('title_fr', 200);
    table.string('title_en', 200);
    table.text('message_fr');
    table.text('message_en');
    table.boolean('is_read').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['user_id']);
    table.index(['order_id']);
    table.index(['is_read']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('notifications');
}