// Knex.js-based menu seeder for MySQL
const knex = require('knex');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const db = knex({
  client: 'mysql2',
  connection: process.env.DATABASE_URL,
});

async function main() {
  const data = JSON.parse(fs.readFileSync('menu_seed.json', 'utf-8'));

  // Delete all menu items
  await db('menu_items').del();

  // Insert new menu items
  for (const item of data.menu_items) {
    await db('menu_items').insert({
      id: uuidv4(),
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image_url: item.image_url,
      is_best_seller: item.is_best_seller,
      is_new: item.is_new,
      available: item.available,
    });
  }

  console.log('Menu items replaced successfully.');
  await db.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
