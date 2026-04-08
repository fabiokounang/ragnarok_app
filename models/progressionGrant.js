const { levelFromTotalExp, expProgressPercent } = require('../config/experience');
const { STAT_POINTS_PER_LEVEL } = require('../config/constants');

/**
 * Apply EXP to the user's active job (adventurer_jobs row or users row for Novice without slot).
 * Caller must hold appropriate locks (transaction on conn).
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {number} userId
 * @param {number} deltaExp
 */
async function grantExpToActiveJob(conn, userId, deltaExp) {
  const gained = Math.min(2147483647, Math.max(0, Math.floor(Number(deltaExp) || 0)));

  const [uj] = await conn.execute(
    'SELECT current_job_id AS jid, total_exp AS user_total_exp FROM users WHERE id = ? FOR UPDATE',
    [userId]
  );
  if (!uj.length) {
    throw new Error('grantExpToActiveJob: user missing');
  }
  const jobId = Number(uj[0].jid);

  const [ajRows] = await conn.execute(
    'SELECT total_exp FROM adventurer_jobs WHERE user_id = ? AND job_id = ? FOR UPDATE',
    [userId, jobId]
  );

  const oldTotal = ajRows.length
    ? Number(ajRows[0].total_exp)
    : Number(uj[0].user_total_exp);

  const oldLevel = levelFromTotalExp(oldTotal);
  const expPctBefore = expProgressPercent(oldTotal);
  const newTotal = oldTotal + gained;
  const newLevel = levelFromTotalExp(newTotal);
  const expPctAfter = expProgressPercent(newTotal);
  const levelGain = newLevel - oldLevel;
  const statPointsGained = levelGain > 0 ? levelGain * STAT_POINTS_PER_LEVEL : 0;

  if (ajRows.length) {
    if (statPointsGained > 0) {
      await conn.execute(
        `UPDATE adventurer_jobs SET total_exp = ?, level = ?, stat_points_unspent = stat_points_unspent + ?
         WHERE user_id = ? AND job_id = ?`,
        [newTotal, newLevel, statPointsGained, userId, jobId]
      );
    } else {
      await conn.execute(
        'UPDATE adventurer_jobs SET total_exp = ?, level = ? WHERE user_id = ? AND job_id = ?',
        [newTotal, newLevel, userId, jobId]
      );
    }
  } else if (statPointsGained > 0) {
    await conn.execute(
      'UPDATE users SET total_exp = ?, level = ?, stat_points_unspent = stat_points_unspent + ? WHERE id = ?',
      [newTotal, newLevel, statPointsGained, userId]
    );
  } else {
    await conn.execute('UPDATE users SET total_exp = ?, level = ? WHERE id = ?', [
      newTotal,
      newLevel,
      userId,
    ]);
  }

  return {
    gained,
    level: newLevel,
    totalExp: newTotal,
    previousLevel: oldLevel,
    leveledUp: levelGain > 0,
    statPointsGained,
    expPctBefore,
    expPctAfter,
  };
}

module.exports = { grantExpToActiveJob };
