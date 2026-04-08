/**
 * Adds job_progressions requirement columns for advanced job promotion.
 * Idempotent.
 *
 * Usage: npm run db:migrate-job-progression-reqs
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

    const cols = [
      `ADD COLUMN min_job_quests INT UNSIGNED NOT NULL DEFAULT 0
         COMMENT 'Lifetime completed dailies+weeklies for from_job task pool' AFTER min_level`,
      `ADD COLUMN min_weekly_boss_wins INT UNSIGNED NOT NULL DEFAULT 0
         COMMENT 'Weekly boss clears for from_job boss line' AFTER min_job_quests`,
      `ADD COLUMN min_login_streak INT UNSIGNED NOT NULL DEFAULT 0
         COMMENT 'users.login_streak must be >= this at promotion' AFTER min_weekly_boss_wins`,
    ];

    for (const fragment of cols) {
      try {
        await conn.query(`ALTER TABLE job_progressions ${fragment}`);
        console.log('[migrate-013] job_progressions column OK');
      } catch (e) {
        if (!ignorableAlter(e)) throw e;
        console.log('[migrate-013] column already present (skip)');
      }
    }

    await conn.query(
      `UPDATE job_progressions SET min_job_quests = 0, min_weekly_boss_wins = 0, min_login_streak = 0
       WHERE from_job_id = 1`
    );

    console.log('[migrate-013] Done.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migrate-013] Failed:', e.message || e);
  process.exit(1);
});
