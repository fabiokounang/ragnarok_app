/**
 * Per–task-type streaks: daily = consecutive server calendar days completed;
 * weekly = consecutive week starts (Monday-aligned) with a completion.
 */

const { getPool } = require('../config/database');

/**
 * @param {import('mysql2/promise').Pool} pool
 */
async function streakTableExists(pool) {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS n FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'user_quest_streaks'`
    );
    return Number(rows[0]?.n) > 0;
  } catch {
    return false;
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {number} userId
 * @param {number} taskTypeId
 */
async function bumpDailyStreak(conn, userId, taskTypeId) {
  await conn.execute(
    `INSERT INTO user_quest_streaks (user_id, task_type_id, daily_streak, last_daily_date, weekly_streak, last_weekly_week_start)
     VALUES (?, ?, 1, CURDATE(), 0, NULL)
     ON DUPLICATE KEY UPDATE
       daily_streak = CASE
         WHEN last_daily_date IS NULL THEN 1
         WHEN last_daily_date = CURDATE() THEN daily_streak
         WHEN last_daily_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN daily_streak + 1
         ELSE 1
       END,
       last_daily_date = CURDATE()`,
    [userId, taskTypeId]
  );
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {number} userId
 * @param {number} taskTypeId
 * @param {string} weekStart 'YYYY-MM-DD' (Monday of week)
 */
async function bumpWeeklyStreak(conn, userId, taskTypeId, weekStart) {
  await conn.execute(
    `INSERT INTO user_quest_streaks (user_id, task_type_id, daily_streak, last_daily_date, weekly_streak, last_weekly_week_start)
     VALUES (?, ?, 0, NULL, 1, ?)
     ON DUPLICATE KEY UPDATE
       weekly_streak = CASE
         WHEN last_weekly_week_start IS NULL THEN 1
         WHEN last_weekly_week_start = ? THEN weekly_streak
         WHEN last_weekly_week_start = DATE_SUB(?, INTERVAL 7 DAY) THEN weekly_streak + 1
         ELSE 1
       END,
       last_weekly_week_start = ?`,
    [userId, taskTypeId, weekStart, weekStart, weekStart, weekStart]
  );
}

/**
 * @param {number} userId
 * @returns {Promise<{ bestDailyStreak: number, bestWeeklyStreak: number, weekDailyDone: number, weekWeeklyDone: number }>}
 */
async function getJournalStreakSummary(userId) {
  const pool = getPool();
  if (!(await streakTableExists(pool))) {
    return { bestDailyStreak: 0, bestWeeklyStreak: 0, weekDailyDone: 0, weekWeeklyDone: 0 };
  }
  const [best] = await pool.execute(
    `SELECT COALESCE(MAX(daily_streak), 0) AS bd, COALESCE(MAX(weekly_streak), 0) AS bw
     FROM user_quest_streaks WHERE user_id = ?`,
    [userId]
  );
  const [wk] = await pool.execute(
    `SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), '%Y-%m-%d') AS ws`
  );
  const ws = String(wk[0].ws);
  const [dCount] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_daily_tasks
     WHERE user_id = ? AND completed_at IS NOT NULL
       AND task_date >= ? AND task_date <= CURDATE()`,
    [userId, ws]
  );
  const [wCount] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_weekly_tasks
     WHERE user_id = ? AND completed_at IS NOT NULL AND week_start_date = ?`,
    [userId, ws]
  );
  return {
    bestDailyStreak: Number(best[0].bd) || 0,
    bestWeeklyStreak: Number(best[0].bw) || 0,
    weekDailyDone: Number(dCount[0].c) || 0,
    weekWeeklyDone: Number(wCount[0].c) || 0,
  };
}

module.exports = {
  streakTableExists,
  bumpDailyStreak,
  bumpWeeklyStreak,
  getJournalStreakSummary,
};
