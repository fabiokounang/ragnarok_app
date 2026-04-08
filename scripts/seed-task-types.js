/**
 * Full task catalog refresh: 02 (wipe + insert task_types), 03 (job_task_types), 06 (no-op / inline alts).
 * Clears user_daily_tasks rows tied to old task types via CASCADE when task_types are deleted.
 * Usage: npm run db:seed-task-types
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'sql', 'seeds', '02_task_types.sql'),
  path.join(ROOT, 'sql', 'seeds', '03_job_task_types.sql'),
  path.join(ROOT, 'sql', 'seeds', '06_task_type_alternatives.sql'),
];

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
    for (const filePath of FILES) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing file: ${filePath}`);
      }
      let sql = fs.readFileSync(filePath, 'utf8');
      sql = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const label = path.relative(ROOT, filePath);
      process.stdout.write(`[db:seed-task-types] Running ${label} ... `);
      await conn.query(sql);
      console.log('OK');
    }
    console.log('[db:seed-task-types] Finished (tasks + job links + alternatives).');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[db:seed-task-types] Failed:', e.message || e);
  process.exit(1);
});
