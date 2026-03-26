// Run this script to create the menu_items table if it doesn't exist
const knex = require('knex');
const fs = require('fs');
require('dotenv').config();

const db = knex({
  client: 'mysql2',
  connection: process.env.DATABASE_URL,
  pool: { min: 0, max: 1 },
});

async function main() {
  const sql = fs.readFileSync('scripts/initMenuTable.sql', 'utf-8');
  await db.raw(sql);
  console.log('menu_items table created or already exists.');
  await db.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
