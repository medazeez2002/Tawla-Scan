// Automated schema deployer for Tawla Scan (Knex.js)
// Usage: node scripts/deploySchemaKnex.cjs

const knex = require('knex');
const fs = require('fs');
require('dotenv').config();

const db = knex({
  client: 'mysql2',
  connection: process.env.DATABASE_URL,
  multipleStatements: true,
});

async function main() {
  const sql = fs.readFileSync('database.sql', 'utf-8');
  // Remove comments and blank lines for safety
  const statements = sql
    .split(';')
    .map(s => s.replace(/--.*$/gm, '').trim())
    .filter(Boolean);
  for (const stmt of statements) {
    if (stmt) {
      try {
        await db.raw(stmt);
      } catch (e) {
        if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DB_CREATE_EXISTS') {
          // Ignore if table/db already exists
          continue;
        }
        console.error('Error running statement:', stmt, '\n', e.message);
      }
    }
  }
  await db.destroy();
  console.log('Schema deployed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
