// Unified Knex.js Seeder for Tawla Scan
// Usage: node scripts/seedAllKnex.cjs

const knex = require('knex');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const db = knex({
  client: 'mysql2',
  connection: process.env.DATABASE_URL,
});

// Default app settings (can be loaded from a JSON if needed)
const DEFAULT_APP_SETTINGS = {
  businessName: 'The Local Cafe',
  currencyCode: 'TND',
  taxRate: '0',
  serviceCharge: '0',
  defaultLanguage: 'en',
  enableOrderNotifications: 'true',
};

async function seedMenuItems() {
  if (!fs.existsSync('menu_seed.json')) return;
  const [dbName] = await db.raw('SELECT DATABASE() as db');
  console.log('Seeder is connected to database:', dbName[0].db);
  const data = JSON.parse(fs.readFileSync('menu_seed.json', 'utf-8'));
  // Delete order_items first to avoid FK constraint errors, but keep orders table
  await db('order_items').del();
  await db('menu_items').del();
  for (const item of data.menu_items) {
    try {
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
    } catch (err) {
      console.error('Error inserting menu item:', item.name, err.message);
    }
  }
  console.log('Menu items seeded.');
}

async function seedOffers() {
  if (!fs.existsSync('offers_seed.json')) return;
  const data = JSON.parse(fs.readFileSync('offers_seed.json', 'utf-8'));
  await db('offer_items').del();
  await db('offers').del();
  for (const offer of data.offers) {
    const offerId = uuidv4();
    await db('offers').insert({
      id: offerId,
      type: offer.type,
      value: offer.value,
      description: offer.description,
      image_url: offer.image_url,
      active: offer.active,
    });
    for (const itemId of offer.menu_item_ids) {
      await db('offer_items').insert({
        id: uuidv4(),
        offer_id: offerId,
        menu_item_id: itemId,
      });
    }
  }
  console.log('Offers seeded.');
}

async function seedBundles() {
  if (!fs.existsSync('bundles_seed.json')) return;
  const data = JSON.parse(fs.readFileSync('bundles_seed.json', 'utf-8'));
  await db('bundle_items').del();
  await db('bundles').del();
  for (const bundle of data.bundles) {
    const bundleId = uuidv4();
    await db('bundles').insert({
      id: bundleId,
      name: bundle.name,
      description: bundle.description,
      price: bundle.price,
      original_price: bundle.original_price,
      image_url: bundle.image_url,
      active: bundle.active,
    });
    for (const itemId of bundle.menu_item_ids) {
      await db('bundle_items').insert({
        id: uuidv4(),
        bundle_id: bundleId,
        menu_item_id: itemId,
      });
    }
  }
  console.log('Bundles seeded.');
}

async function seedAppSettings() {
  await db('app_settings').del();
  for (const [key, value] of Object.entries(DEFAULT_APP_SETTINGS)) {
    await db('app_settings').insert({
      setting_key: `app.${key}`,
      setting_value: value,
    });
  }
  // Also seed admin and super admin passwords
  await db('app_settings').insert({
    setting_key: 'security.admin_pass',
    setting_value: 'admin1234',
  });
  await db('app_settings').insert({
    setting_key: 'security.super_admin_pass',
    setting_value: 'j12345678A',
  });
  console.log('App settings seeded (including passwords).');
}

async function main() {
  await seedMenuItems();
  await seedOffers();
  await seedBundles();
  await seedAppSettings();
  await db.destroy();
  console.log('All seeding complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
