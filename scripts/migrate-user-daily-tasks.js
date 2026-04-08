/**
 * Applies daily-task migrations (002 table, 003 accepted_at). Usage: npm run db:migrate-daily
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'sql', 'migrations');
const FILES = ['002_user_daily_tasks.sql', '003_user_daily_tasks_accepted_at.sql'];

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
    for (const name of FILES) {
      const filePath = path.join(MIGRATIONS_DIR, name);
      if (!fs.existsSync(filePath)) continue;
      let sql = fs.readFileSync(filePath, 'utf8');
      sql = sql.replace(/^\s*USE\s+[^;]+;\s*/im, '');
      try {
        await conn.query(sql);
        console.log(`[db:migrate-daily] ${name} OK.`);
      } catch (e) {
        const dupCol = e.errno === 1060 || e.code === 'ER_DUP_FIELDNAME';
        if (name.startsWith('003') && dupCol) {
          console.log(`[db:migrate-daily] ${name} skipped (column already exists).`);
          continue;
        }
        throw e;
      }
    }
    console.log('[db:migrate-daily] Finished.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[db:migrate-daily] Failed:', e.message || e);
  process.exit(1);
});
