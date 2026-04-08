/**
 * Add usernames to users table and backfill unique values.
 * Usage: npm run db:migrate-usernames
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

function baseFromEmail(email, id) {
  const raw = String(email || '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  const base = raw || `user${id}`;
  return base.slice(0, 24) || `user${id}`;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'reborn',
    charset: 'utf8mb4',
  });

  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    const [cols] = await conn.query(
      `SELECT column_name AS c
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users'`
    );
    const existing = new Set(cols.map((r) => String(r.c)));

    if (!existing.has('username')) {
      await conn.query(`ALTER TABLE users ADD COLUMN username VARCHAR(32) NULL AFTER email`);
    }

    const [rows] = await conn.query(
      `SELECT id, email, username
       FROM users
       ORDER BY id ASC`
    );

    const used = new Set();
    for (const row of rows) {
      const id = Number(row.id);
      const current = String(row.username || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
      let username = current || baseFromEmail(row.email, id);
      if (username.length < 3) username = `user${id}`;
      username = username.slice(0, 32);

      let candidate = username;
      let suffix = 1;
      while (used.has(candidate)) {
        const room = Math.max(1, 32 - String(suffix).length - 1);
        candidate = `${username.slice(0, room)}_${suffix}`;
        suffix += 1;
      }
      used.add(candidate);
      await conn.query('UPDATE users SET username = ? WHERE id = ?', [candidate, id]);
    }

    const [nullRows] = await conn.query(
      `SELECT COUNT(*) AS c FROM users WHERE username IS NULL OR TRIM(username) = ''`
    );
    if ((Number(nullRows[0]?.c) || 0) > 0) {
      throw new Error('username_backfill_incomplete');
    }

    const [idxRows] = await conn.query(
      `SELECT index_name AS idx
       FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'users'
         AND index_name = 'uq_users_username'`
    );
    if (!idxRows.length) {
      await conn.query('ALTER TABLE users ADD UNIQUE KEY uq_users_username (username)');
    }

    await conn.query('ALTER TABLE users MODIFY COLUMN username VARCHAR(32) NOT NULL');
    console.log('[migrate-023] users.username ready');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
