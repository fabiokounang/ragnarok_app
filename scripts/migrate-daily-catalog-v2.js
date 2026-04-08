/**
 * Resets jobs, task catalog, job↔task links, and progressions to v2 seeds.
 * Clears user_daily_tasks and adventurer_jobs; sets every user to Novice (re-pick class).
 *
 * Usage: npm run db:migrate-catalog-v2   (alias: npm run db:reset-all)
 * Requires: .env DB_* and sql/seeds/01–04 as updated for v2.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..');
const SEEDS = [
  path.join(ROOT, 'sql', 'seeds', '01_jobs.sql'),
  path.join(ROOT, 'sql', 'seeds', '02_task_types.sql'),
  path.join(ROOT, 'sql', 'seeds', '03_job_task_types.sql'),
  path.join(ROOT, 'sql', 'seeds', '04_job_progressions.sql'),
];

const RESET_SQL = `
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM user_daily_tasks;
DELETE FROM adventurer_jobs;
DELETE FROM job_task_types;
DELETE FROM job_progressions;
DELETE FROM task_types;
DELETE FROM jobs;
SET FOREIGN_KEY_CHECKS = 1;
`;

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
    process.stdout.write('[migrate-daily-catalog-v2] Resetting tables ... ');
    await conn.query(RESET_SQL);
    console.log('OK');

    for (const file of SEEDS) {
      if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
      let sql = fs.readFileSync(file, 'utf8');
      sql = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      sql = sql.replace(/^\s*USE\s+[^;]+;\s*/gim, '');
      const label = path.relative(ROOT, file);
      process.stdout.write(`[migrate-daily-catalog-v2] ${label} ... `);
      await conn.query(sql);
      console.log('OK');
    }

    process.stdout.write('[migrate-daily-catalog-v2] users → Novice (id=1) ... ');
    await conn.query('UPDATE users SET current_job_id = 1');
    console.log('OK');

    const [testRows] = await conn.query(
      "SELECT id FROM users WHERE email = 'test@reborn.local' LIMIT 1"
    );
    if (testRows.length) {
      const uid = testRows[0].id;
      process.stdout.write('[migrate-daily-catalog-v2] restore dev test user (Knight slot) ... ');
      await conn.query(
        `INSERT INTO adventurer_jobs
          (user_id, slot_num, job_id, total_exp, level, stat_str, stat_agi, stat_vit, stat_int, stat_dex, stat_luk, stat_points_unspent)
         VALUES (?, 1, 2, 120, 3, 1, 1, 1, 1, 1, 1, 0)
         ON DUPLICATE KEY UPDATE job_id = 2, total_exp = 120, level = 3,
           stat_str = 1, stat_agi = 1, stat_vit = 1, stat_int = 1, stat_dex = 1, stat_luk = 1, stat_points_unspent = 0`,
        [uid]
      );
      await conn.query(
        'UPDATE users SET current_job_id = 2, level = 3, total_exp = 120 WHERE id = ?',
        [uid]
      );
      console.log('OK');
    }

    console.log(
      '[migrate-daily-catalog-v2] Done. Users set to Novice; daily quests cleared. After level 10 they must use /choose-job (test account restored to Knight if present).'
    );
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migrate-daily-catalog-v2] Failed:', e.message || e);
  process.exit(1);
});
