/**
 * Delete today's user_daily_tasks for a user by display name.
 * Next /daily visit recreates rows via ensureTodayTasks.
 * Usage: node scripts/reset-user-daily-today.js Fayt
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

const needle = process.argv[2];
if (!needle || !String(needle).trim()) {
  console.error('Usage: node scripts/reset-user-daily-today.js <display_name>');
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'reborn',
  });

  try {
    const q = String(needle).trim();
    const [users] = await conn.execute(
      `SELECT id, display_name, email FROM users WHERE display_name = ? OR display_name LIKE ?`,
      [q, `%${q}%`]
    );
    if (!users.length) {
      console.log(`[reset-daily] No user matching display name "${q}".`);
      return;
    }
    if (users.length > 1) {
      console.log('[reset-daily] Multiple matches — using first:');
      users.forEach((r) => console.log('  ', r.id, r.display_name, r.email));
    }
    const u = users[0];
    try {
      await conn.execute(`DELETE FROM user_daily_offers WHERE user_id = ? AND offer_date = CURDATE()`, [u.id]);
    } catch (e) {
      if (e.errno !== 1146) throw e;
    }
    try {
      await conn.execute(`DELETE FROM user_daily_reflections WHERE user_id = ? AND reflection_date = CURDATE()`, [
        u.id,
      ]);
    } catch (e) {
      if (e.errno !== 1146) throw e;
    }
    const [del] = await conn.execute(
      `DELETE FROM user_daily_tasks WHERE user_id = ? AND task_date = CURDATE()`,
      [u.id]
    );
    console.log(
      `[reset-daily] Deleted ${del.affectedRows} task row(s) for "${u.display_name}" (id ${u.id}). Open /daily for a fresh morning board or roll.`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[reset-daily]', err.message || err);
  process.exit(1);
});
