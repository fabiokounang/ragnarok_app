/**
 * Fills task_types.alternatives JSON. Usage: npm run db:seed-alternatives
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FILE = path.join(__dirname, '..', 'sql', 'seeds', '06_task_type_alternatives.sql');

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'reborn';

  let sql = fs.readFileSync(FILE, 'utf8');
  sql = sql.replace(/^\s*USE\s+[^;]+;\s*/im, '');

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    console.log('[db:seed-alternatives] OK.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[db:seed-alternatives] Failed:', e.message || e);
  process.exit(1);
});
