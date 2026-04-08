/**
 * Deletes all accounts and related rows (daily tasks, adventurer_jobs cascade).
 * Does not touch jobs, tasks, seeds. Usage: npm run db:reset-users
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

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
    await conn.query('DELETE FROM user_daily_tasks');
    await conn.query('DELETE FROM adventurer_jobs');
    await conn.query('DELETE FROM users');
    const [rows] = await conn.query('SELECT COUNT(*) AS c FROM users');
    const c = Number(rows[0]?.c);
    if (c !== 0) {
      throw new Error(`Expected 0 users after reset, got ${c}`);
    }
    console.log('[db:reset-users] All user accounts removed. Register a new account to continue.');
    console.log('[db:reset-users] Optional: npm run db:seed-test — restores dev test@reborn.local');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[db:reset-users] Failed:', err.message || err);
  process.exit(1);
});
