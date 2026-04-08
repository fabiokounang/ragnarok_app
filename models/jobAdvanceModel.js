const { getPool } = require('../config/database');
const { levelFromTotalExp } = require('../config/experience');

/**
 * Lifetime completed dailies + weeklies whose task_type is in the given job pool.
 * @param {number} userId
 * @param {number} jobId tier-1 (or any) job whose pool we measure
 */
async function countCompletedQuestsForJobPool(userId, jobId) {
  const pool = getPool();
  const [daily] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_daily_tasks udt
     INNER JOIN job_task_types jtt ON jtt.task_type_id = udt.task_type_id AND jtt.job_id = ?
     WHERE udt.user_id = ? AND udt.completed_at IS NOT NULL`,
    [jobId, userId]
  );
  const [weekly] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_weekly_tasks uwt
     INNER JOIN (
       SELECT task_type_id FROM job_weekly_regular WHERE job_id = ?
       UNION
       SELECT task_type_id FROM job_weekly_boss WHERE job_id = ?
     ) x ON x.task_type_id = uwt.task_type_id
     WHERE uwt.user_id = ? AND uwt.completed_at IS NOT NULL`,
    [jobId, jobId, userId]
  );
  return Number(daily[0]?.c) + Number(weekly[0]?.c);
}

/**
 * Weekly boss clears for this job line (boss task type linked in job_weekly_boss).
 * @param {number} userId
 * @param {number} jobId
 */
async function countWeeklyBossWinsForJob(userId, jobId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_weekly_tasks uwt
     INNER JOIN job_weekly_boss jwb ON jwb.task_type_id = uwt.task_type_id AND jwb.job_id = ?
     WHERE uwt.user_id = ? AND uwt.completed_at IS NOT NULL`,
    [jobId, userId]
  );
  return Number(rows[0]?.c) || 0;
}

/**
 * @param {number} userId
 * @param {number} fromJobId tier-1 job currently on the slot being advanced
 * @returns {Promise<Array<{ toJobId: number, slug: string, name: string, description: string, minLevel: number, minQuests: number, minBoss: number, minStreak: number }>>}
 */
async function listAdvanceTargets(fromJobId) {
  const pool = getPool();
  let rows;
  try {
    [rows] = await pool.execute(
      `SELECT j.id AS toJobId, j.slug, j.name, j.description,
              p.min_level AS minLevel, p.min_job_quests AS minQuests,
              p.min_weekly_boss_wins AS minBoss, p.min_login_streak AS minStreak
       FROM job_progressions p
       INNER JOIN jobs j ON j.id = p.to_job_id
       WHERE p.from_job_id = ? AND j.tier = 2
       ORDER BY j.sort_order ASC, j.id ASC`,
      [fromJobId]
    );
  } catch (e) {
    if (e.errno === 1054 || e.code === 'ER_BAD_FIELD_ERROR') {
      return [];
    }
    throw e;
  }
  return rows.map((r) => ({
    toJobId: Number(r.toJobId),
    slug: String(r.slug || ''),
    name: String(r.name || ''),
    description: r.description == null ? '' : String(r.description),
    minLevel: Number(r.minLevel) || 0,
    minQuests: Number(r.minQuests) || 0,
    minBoss: Number(r.minBoss) || 0,
    minStreak: Number(r.minStreak) || 0,
  }));
}

/**
 * @param {number} userId
 * @param {number} fromJobId active tier-1 job id on the character
 */
async function getAdvanceProgress(userId, fromJobId) {
  const pool = getPool();
  const [aj] = await pool.execute(
    `SELECT total_exp FROM adventurer_jobs WHERE user_id = ? AND job_id = ? LIMIT 1`,
    [userId, fromJobId]
  );
  const totalExp = aj.length ? Number(aj[0].total_exp) || 0 : 0;
  const level = levelFromTotalExp(totalExp);

  const questsDone = await countCompletedQuestsForJobPool(userId, fromJobId);
  const bossWins = await countWeeklyBossWinsForJob(userId, fromJobId);

  let streak = 0;
  try {
    const [su] = await pool.execute('SELECT login_streak FROM users WHERE id = ? LIMIT 1', [userId]);
    streak = su.length ? Number(su[0].login_streak) || 0 : 0;
  } catch (e) {
    if (e.errno !== 1054 && e.code !== 'ER_BAD_FIELD_ERROR') throw e;
  }

  return { level, questsDone, bossWins, streak };
}

/**
 * @param {number} userId
 * @param {number} fromJobId
 * @param {number} toJobId
 */
async function validateAdvance(userId, fromJobId, toJobId) {
  const pool = getPool();
  let row;
  try {
    const [rows] = await pool.execute(
      `SELECT min_level AS minLevel, min_job_quests AS minQuests,
              min_weekly_boss_wins AS minBoss, min_login_streak AS minStreak
       FROM job_progressions WHERE from_job_id = ? AND to_job_id = ? LIMIT 1`,
      [fromJobId, toJobId]
    );
    row = rows[0];
  } catch (e) {
    if (e.errno === 1054 || e.code === 'ER_BAD_FIELD_ERROR') {
      return { ok: false, error: 'advance_unavailable' };
    }
    throw e;
  }
  if (!row) {
    return { ok: false, error: 'invalid_path' };
  }

  const [jfrom] = await pool.execute('SELECT tier FROM jobs WHERE id = ? LIMIT 1', [fromJobId]);
  if (!jfrom.length || Number(jfrom[0].tier) !== 1) {
    return { ok: false, error: 'not_base_job' };
  }

  const [jto] = await pool.execute('SELECT tier FROM jobs WHERE id = ? LIMIT 1', [toJobId]);
  if (!jto.length || Number(jto[0].tier) !== 2) {
    return { ok: false, error: 'invalid_target' };
  }

  const prog = await getAdvanceProgress(userId, fromJobId);
  const minLevel = Number(row.minLevel) || 0;
  const minQuests = Number(row.minQuests) || 0;
  const minBoss = Number(row.minBoss) || 0;
  const minStreak = Number(row.minStreak) || 0;

  if (prog.level < minLevel) return { ok: false, error: 'need_level', need: minLevel, have: prog.level };
  if (prog.questsDone < minQuests) return { ok: false, error: 'need_quests', need: minQuests, have: prog.questsDone };
  if (prog.bossWins < minBoss) return { ok: false, error: 'need_boss', need: minBoss, have: prog.bossWins };
  if (prog.streak < minStreak) return { ok: false, error: 'need_streak', need: minStreak, have: prog.streak };

  return { ok: true };
}

module.exports = {
  countCompletedQuestsForJobPool,
  countWeeklyBossWinsForJob,
  listAdvanceTargets,
  getAdvanceProgress,
  validateAdvance,
};
