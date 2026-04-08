/**
 * Adds the dev test user only (no full schema reset).
 * Usage: npm run db:seed-test
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const file = path.join(__dirname, '..', 'sql', 'seeds', '05_test_user.sql');
  const sql = fs.readFileSync(file, 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
    console.log('[db:seed-test] OK — test@reborn.local / testpass123');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[db:seed-test]', err.message || err);
  process.exit(1);
});
