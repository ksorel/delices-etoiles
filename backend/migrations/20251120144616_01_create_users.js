export function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('email', 255).unique().notNullable();
    table.string('password', 255).notNullable();
    table.string('first_name', 100);
    table.string('last_name', 100);
    table.string('phone', 20);
    table.string('role', 50).defaultTo('client');
    table.timestamps(true, true);
    
    table.index(['email']);
    table.index(['role']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('users');
}