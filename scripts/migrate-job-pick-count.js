/**
 * Adds jobs.pick_count if missing (stops console warning + enables community favorite).
 * Usage: npm run db:migrate-pick
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATION = path.join(__dirname, '..', 'sql', 'migrations', '001_add_jobs_pick_count.sql');

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;

  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    console.log('[db:migrate-pick] OK — jobs.pick_count added (or migration applied).');
  } catch (err) {
    const msg = String(err.message || '');
    if (err.errno === 1060 || msg.includes('Duplicate column') || msg.includes('pick_count')) {
      console.log('[db:migrate-pick] Column already exists — nothing to do.');
      return;
    }
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[db:migrate-pick] Failed:', e.message || e);
  process.exit(1);
});
