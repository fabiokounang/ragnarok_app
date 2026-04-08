/**
 * Adds users.music_enabled (008). Usage: npm run db:migrate-music
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FILE = path.join(__dirname, '..', 'sql', 'migrations', '008_users_music_enabled.sql');

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
    console.log('[db:migrate-music] 008_users_music_enabled.sql OK.');
    console.log('[db:migrate-music] Finished.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
    console.log('[db:migrate-music] Column already exists — skipped.');
    process.exit(0);
  }
  console.error('[db:migrate-music] Failed:', err.message || err);
  process.exit(1);
});
