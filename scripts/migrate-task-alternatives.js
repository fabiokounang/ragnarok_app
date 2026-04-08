/**
 * Adds task_types.alternatives (JSON). Run once on existing DBs. Usage: npm run db:migrate-task-alt
 * Then load swap-in text: npm run db:seed-alternatives   (or full db:setup for fresh installs)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FILE = path.join(__dirname, '..', 'sql', 'migrations', '003_task_type_alternatives.sql');

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
    console.log('[db:migrate-task-alt] OK (column added if it was missing).');
  } catch (e) {
    if (
      e.code === 'ER_DUP_FIELDNAME' ||
      e.errno === 1060 ||
      /Duplicate column name/i.test(String(e.message))
    ) {
      console.log('[db:migrate-task-alt] Skip: alternatives column already exists.');
      return;
    }
    throw e;
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[db:migrate-task-alt] Failed:', e.message || e);
  process.exit(1);
});
