/**
 * Adds task_types.weekly_target_steps for multi-step weekly quests (e.g. 5-day Novice weeklies).
 * Idempotent. Run before re-applying sql/seeds/08_weekly_tasks.sql if INSERT lists the column.
 *
 * Usage: npm run db:migrate-weekly-target
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

function ignorableAlter(err) {
  return err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME');
}

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
    try {
      await conn.query(
        `ALTER TABLE task_types
         ADD COLUMN weekly_target_steps SMALLINT UNSIGNED NOT NULL DEFAULT 1
           COMMENT 'For weekly rows: check-ins before EXP (default 1)'
           AFTER quest_kind`
      );
      console.log('[migrate-012] task_types.weekly_target_steps OK');
    } catch (e) {
      if (!ignorableAlter(e)) throw e;
      console.log('[migrate-012] weekly_target_steps already exists');
    }
    console.log('[migrate-012] Done.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migrate-012] Failed:', e.message || e);
  process.exit(1);
});
