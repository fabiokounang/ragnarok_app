/**
 * Per–task-type streak counters (daily + weekly).
 * Usage: npm run db:migrate-quest-streaks
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
    multipleStatements: true,
  });

  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_quest_streaks (
        user_id INT UNSIGNED NOT NULL,
        task_type_id INT UNSIGNED NOT NULL,
        daily_streak INT UNSIGNED NOT NULL DEFAULT 0,
        last_daily_date DATE NULL,
        weekly_streak INT UNSIGNED NOT NULL DEFAULT 0,
        last_weekly_week_start DATE NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, task_type_id),
        KEY idx_uqs_user_daily (user_id, last_daily_date),
        CONSTRAINT fk_uqs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_uqs_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[migrate-015] user_quest_streaks OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
