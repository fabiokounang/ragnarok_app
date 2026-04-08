/**
 * Morning quest board (user picks up to 3), optional quest notes, daily reflection.
 * Idempotent.
 *
 * Usage: npm run db:migrate-daily-morning-board
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

function ignorableDup(err) {
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
    multipleStatements: true,
  });

  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS user_daily_offers (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          user_id INT UNSIGNED NOT NULL,
          offer_date DATE NOT NULL,
          task_type_id INT UNSIGNED NOT NULL,
          sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_day_offer_type (user_id, offer_date, task_type_id),
          KEY idx_udo_user_day (user_id, offer_date),
          CONSTRAINT fk_udo_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          CONSTRAINT fk_udo_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('[migrate-014] user_daily_offers OK');
    } catch (e) {
      if (e.errno === 1050 || e.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('[migrate-014] user_daily_offers already exists');
      } else {
        throw e;
      }
    }

    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS user_daily_reflections (
          user_id INT UNSIGNED NOT NULL,
          reflection_date DATE NOT NULL,
          body VARCHAR(2000) NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, reflection_date),
          CONSTRAINT fk_udr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('[migrate-014] user_daily_reflections OK');
    } catch (e) {
      if (e.errno === 1050 || e.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('[migrate-014] user_daily_reflections already exists');
      } else {
        throw e;
      }
    }

    try {
      await conn.query(`
        ALTER TABLE user_daily_tasks
        ADD COLUMN user_note VARCHAR(768) NULL COMMENT 'Optional proof or notes (honor system)' AFTER accepted_at
      `);
      console.log('[migrate-014] user_daily_tasks.user_note OK');
    } catch (e) {
      if (ignorableDup(e)) {
        console.log('[migrate-014] user_note column already present');
      } else {
        throw e;
      }
    }

    console.log('[migrate-014] Done.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migrate-014] Failed:', e.message || e);
  process.exit(1);
});
