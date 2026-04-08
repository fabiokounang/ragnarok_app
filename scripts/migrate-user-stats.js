/**
 * Adds stat columns (004) and baseline-1 defaults + row update (005). Usage: npm run db:migrate-stats
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'sql', 'migrations');
const FILES = [
  { name: '004_user_ro_stats.sql', skipDupColumn: true },
  { name: '005_user_stats_baseline_one.sql', skipDupColumn: false },
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
    for (const { name, skipDupColumn } of FILES) {
      const filePath = path.join(MIGRATIONS_DIR, name);
      if (!fs.existsSync(filePath)) {
        console.log(`[db:migrate-stats] Skip missing ${name}`);
        continue;
      }
      let sql = fs.readFileSync(filePath, 'utf8');
      sql = sql.replace(/^\s*USE\s+[^;]+;\s*/im, '');
      try {
        await conn.query(sql);
        console.log(`[db:migrate-stats] ${name} OK.`);
      } catch (e) {
        const dup = e.errno === 1060 || e.code === 'ER_DUP_FIELDNAME';
        if (skipDupColumn && dup) {
          console.log(`[db:migrate-stats] ${name} skipped (columns already exist).`);
          continue;
        }
        throw e;
      }
    }
    console.log('[db:migrate-stats] Finished.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[db:migrate-stats] Failed:', err.message || err);
  process.exit(1);
});
