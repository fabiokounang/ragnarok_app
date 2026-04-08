/**
 * Training mini-reward: session log + focus charge columns.
 * Usage: npm run db:migrate-train-reward
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
    charset: 'utf8mb4',
  });

  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

    const [colRows] = await conn.query(
      `SELECT column_name AS c
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'users'
         AND column_name IN ('train_focus_charges', 'train_focus_expires_date')`
    );
    const existing = new Set(colRows.map((r) => String(r.c)));
    if (!existing.has('train_focus_charges')) {
      await conn.query(
        `ALTER TABLE users
         ADD COLUMN train_focus_charges TINYINT UNSIGNED NOT NULL DEFAULT 0
         COMMENT 'Next-task focus bonus charges from Train'`
      );
    }
    if (!existing.has('train_focus_expires_date')) {
      await conn.query(
        `ALTER TABLE users
         ADD COLUMN train_focus_expires_date DATE NULL
         COMMENT 'Server date when focus charges expire'`
      );
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_train_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        session_date DATE NOT NULL,
        reward_exp SMALLINT UNSIGNED NOT NULL DEFAULT 8,
        focus_bonus_pct TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT '5 = +5% on next task',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_uts_user_day (user_id, session_date),
        CONSTRAINT fk_uts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('[migrate-020] train reward columns + user_train_sessions OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
