/**
 * Creates adventurer_jobs (006) and backfills slot 1 from users.current_job_id. Usage: npm run db:migrate-job-slots
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FILE = path.join(__dirname, '..', 'sql', 'migrations', '006_user_job_slots.sql');

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
    // Normalize newlines; do not use /^.../m here — after \r, ^ can match between \r and \n and swallow the newline before USE.
    sql = sql.replace(/\r\n/g, '\n').replace(/USE\s+[^;]+;\s*/i, '');
    await conn.query(sql);
    console.log('[db:migrate-job-slots] 006_user_job_slots.sql OK.');
    console.log('[db:migrate-job-slots] Finished.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[db:migrate-job-slots] Failed:', err.message || err);
  process.exit(1);
});
