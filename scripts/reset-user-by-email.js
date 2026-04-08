/**
 * Reset one user to fresh Novice (job 1, level 1, 0 EXP, base stats), clear dailies + adventurer slots.
 * Password, email, display name unchanged.
 *
 * Usage:
 *   node scripts/reset-user-by-email.js you@example.com
 *   node scripts/reset-user-by-email.js fayt   (partial on email or display_name; fails if ambiguous)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const { STARTING_JOB_ID } = require('../config/constants');

async function main() {
  const raw = String(process.argv[2] || '').trim();
  if (!raw) {
    console.error('Usage: node scripts/reset-user-by-email.js <email-or-partial>');
    process.exit(1);
  }

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
    let rows;
    if (raw.includes('@')) {
      const [r] = await conn.execute(
        'SELECT id, email, display_name FROM users WHERE LOWER(email) = LOWER(?)',
        [raw]
      );
      rows = r;
    } else {
      const [r] = await conn.execute(
        `SELECT id, email, display_name FROM users
         WHERE LOWER(email) LIKE LOWER(?) OR LOWER(display_name) LIKE LOWER(?)`,
        [`%${raw}%`, `%${raw}%`]
      );
      rows = r;
    }

    if (!rows.length) {
      console.error('[reset-user] No user found for:', raw);
      process.exit(1);
    }
    if (rows.length > 1) {
      console.error('[reset-user] Multiple matches — pass full email:');
      rows.forEach((u) => console.error(`  id=${u.id}  ${u.email}  (${u.display_name})`));
      process.exit(1);
    }

    const uid = rows[0].id;
    const email = rows[0].email;
    console.log('[reset-user] Resetting', email, `(id ${uid}) ...`);

    await conn.beginTransaction();
    await conn.execute('DELETE FROM user_daily_tasks WHERE user_id = ?', [uid]);
    await conn.execute('DELETE FROM adventurer_jobs WHERE user_id = ?', [uid]);
    await conn.execute(
      `UPDATE users SET
        current_job_id = ?,
        level = 1,
        total_exp = 0,
        stat_str = 1, stat_agi = 1, stat_vit = 1, stat_int = 1, stat_dex = 1, stat_luk = 1,
        stat_points_unspent = 0
       WHERE id = ?`,
      [STARTING_JOB_ID, uid]
    );
    await conn.commit();
    console.log('[reset-user] OK — Novice, no job slots, dailies cleared.');
  } catch (e) {
    await conn.rollback().catch(() => {});
    console.error('[reset-user] Failed:', e.message || e);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
