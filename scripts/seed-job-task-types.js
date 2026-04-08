/**
 * Re-runs sql/seeds/03_job_task_types.sql (DELETE + INSERT). Usage: npm run db:seed-job-tasks
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FILE = path.join(__dirname, '..', 'sql', 'seeds', '03_job_task_types.sql');

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'reborn';

  const sql = fs.readFileSync(FILE, 'utf8');

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
    console.log('[db:seed-job-tasks] OK — job_task_types refreshed from 03_job_task_types.sql');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[db:seed-job-tasks] Failed:', e.message || e);
  process.exit(1);
});
