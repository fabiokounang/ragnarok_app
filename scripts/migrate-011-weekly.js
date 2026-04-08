/**
 * Adds quest_kind, weekly tables, login streak columns. Idempotent (skips duplicates).
 * Then runs sql/seeds/08_weekly_tasks.sql if present.
 *
 * Usage: npm run db:migrate-weekly
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..');
const SEED_WEEKLY = path.join(ROOT, 'sql', 'seeds', '08_weekly_tasks.sql');

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
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

    try {
      await conn.query(
        `ALTER TABLE task_types
         ADD COLUMN quest_kind ENUM('daily','weekly','weekly_boss') NOT NULL DEFAULT 'daily' AFTER sort_order,
         ADD KEY idx_task_types_quest_kind (quest_kind)`
      );
      console.log('[migrate-011] task_types.quest_kind OK');
    } catch (e) {
      if (!ignorableAlter(e)) throw e;
      console.log('[migrate-011] task_types.quest_kind already exists');
    }

    try {
      await conn.query(
        `ALTER TABLE task_types
         ADD COLUMN weekly_target_steps SMALLINT UNSIGNED NOT NULL DEFAULT 1
           COMMENT 'For weekly rows: check-ins before EXP (default 1)'
           AFTER quest_kind`
      );
      console.log('[migrate-011] task_types.weekly_target_steps OK');
    } catch (e) {
      if (!ignorableAlter(e)) throw e;
      console.log('[migrate-011] weekly_target_steps already exists');
    }

    try {
      await conn.query(
        `ALTER TABLE users
         ADD COLUMN login_streak INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Consecutive login days' AFTER music_enabled,
         ADD COLUMN last_login_streak_date DATE NULL COMMENT 'Last streak bump' AFTER login_streak`
      );
      console.log('[migrate-011] users streak columns OK');
    } catch (e) {
      if (!ignorableAlter(e)) throw e;
      console.log('[migrate-011] users streak columns already exist');
    }

    await conn.query(`CREATE TABLE IF NOT EXISTS job_weekly_regular (
      job_id INT UNSIGNED NOT NULL,
      task_type_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (job_id, task_type_id),
      CONSTRAINT fk_jwr_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
      CONSTRAINT fk_jwr_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('[migrate-011] job_weekly_regular OK');

    await conn.query(`CREATE TABLE IF NOT EXISTS job_weekly_boss (
      job_id INT UNSIGNED NOT NULL,
      task_type_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (job_id),
      KEY idx_jwb_task (task_type_id),
      CONSTRAINT fk_jwb_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
      CONSTRAINT fk_jwb_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('[migrate-011] job_weekly_boss OK');

    await conn.query(`CREATE TABLE IF NOT EXISTS user_weekly_tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      task_type_id INT UNSIGNED NOT NULL,
      week_start_date DATE NOT NULL,
      is_weekly_boss TINYINT(1) NOT NULL DEFAULT 0,
      target_value SMALLINT UNSIGNED NOT NULL DEFAULT 1,
      current_value SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      reward_exp SMALLINT UNSIGNED NOT NULL DEFAULT 25,
      completed_at TIMESTAMP NULL DEFAULT NULL,
      accepted_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_week_task (user_id, task_type_id, week_start_date),
      KEY idx_user_week (user_id, week_start_date),
      CONSTRAINT fk_uwt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_uwt_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('[migrate-011] user_weekly_tasks OK');

    if (fs.existsSync(SEED_WEEKLY)) {
      let sql = fs.readFileSync(SEED_WEEKLY, 'utf8');
      sql = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      sql = sql.replace(/^\s*USE\s+[^;]+;\s*/gim, '');
      process.stdout.write('[migrate-011] seed 08_weekly_tasks.sql ... ');
      await conn.query(sql);
      console.log('OK');
    } else {
      console.log('[migrate-011] skip seed (08_weekly_tasks.sql missing)');
    }

    console.log('[migrate-011] Done.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migrate-011] Failed:', e.message || e);
  process.exit(1);
});
