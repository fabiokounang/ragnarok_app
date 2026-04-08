/**
 * Add board quest accept requirements: min level and min job tier.
 * Usage: npm run db:migrate-quest-reqs
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

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
    const [rows] = await conn.query(
      `SELECT column_name AS c
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'board_quests'
         AND column_name IN ('min_receiver_level', 'min_receiver_job_tier')`
    );
    const existing = new Set(rows.map((r) => String(r.c)));

    if (!existing.has('min_receiver_level')) {
      await conn.query(
        `ALTER TABLE board_quests
         ADD COLUMN min_receiver_level SMALLINT UNSIGNED NOT NULL DEFAULT 1
         AFTER cadence`
      );
    }
    if (!existing.has('min_receiver_job_tier')) {
      await conn.query(
        `ALTER TABLE board_quests
         ADD COLUMN min_receiver_job_tier TINYINT UNSIGNED NOT NULL DEFAULT 0
         COMMENT '0=any,1=first+,2=second+,3=third+'
         AFTER min_receiver_level`
      );
    }
    console.log('[migrate-024] board quest requirements OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
