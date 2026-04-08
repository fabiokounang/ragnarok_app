/**
 * Adds per-job EXP/level/stats on adventurer_jobs (007). Usage: npm run db:migrate-job-progress
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FILE = path.join(__dirname, '..', 'sql', 'migrations', '007_adventurer_jobs_progression.sql');

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'reborn';

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    let sql = fs.readFileSync(FILE, 'utf8');
    sql = sql.replace(/\r\n/g, '\n').replace(/USE\s+[^;]+;\s*/i, '');
    await conn.query(sql);
    console.log('[db:migrate-job-progress] 007_adventurer_jobs_progression.sql OK.');
    console.log('[db:migrate-job-progress] Finished.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
    console.log('[db:migrate-job-progress] Columns already exist — skipped.');
    process.exit(0);
  }
  console.error('[db:migrate-job-progress] Failed:', err.message || err);
  process.exit(1);
});
