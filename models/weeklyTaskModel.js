const crypto = require('crypto');
const { getPool } = require('../config/database');
const {
  WEEKLY_REGULAR_QUEST_COUNT,
  WEEKLY_BOSS_QUEST_COUNT,
} = require('../config/constants');
const { grantExpToActiveJob } = require('./progressionGrant');
const { grantCompletionVaultReward } = require('./vaultRewardModel');
const questStreakModel = require('./questStreakModel');
const { resolveHeroImageUrl } = require('../config/taskHeroImages');

function sortToken(userId, weekStart, taskTypeId, salt) {
  return crypto
    .createHash('sha256')
    .update(`${userId}|${weekStart}|${taskTypeId}|${salt}`)
    .digest('hex');
}

/** @param {unknown} raw */
function parseAlternatives(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      const p = JSON.parse(raw.toString('utf8'));
      return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Monday of current week in server local date (MySQL WEEKDAY: Mon=0).
 * @param {import('mysql2/promise').Pool} pool
 */
async function getWeekStartDate(pool) {
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), '%Y-%m-%d') AS ws`
  );
  return String(rows[0].ws);
}

/**
 * @param {import('mysql2/promise').Pool} pool
 */
async function getWeekMeta(pool) {
  const start = await getWeekStartDate(pool);
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL 6 DAY), '%Y-%m-%d') AS we`,
    [start]
  );
  return { weekStart: start, weekEnd: String(rows[0].we) };
}

/**
 * @param {number} userId
 * @param {number} jobId
 */
async function ensureWeeklyTasks(userId, jobId) {
  const pool = getPool();
  const weekStart = await getWeekStartDate(pool);
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_weekly_tasks WHERE user_id = ? AND week_start_date = ?`,
    [userId, weekStart]
  );
  if (Number(countRows[0].c) > 0) return;

  const [regular] = await pool.execute(
    `SELECT tt.id, tt.base_exp,
            GREATEST(1, COALESCE(NULLIF(tt.weekly_target_steps, 0), 1)) AS target_steps
     FROM task_types tt
     INNER JOIN job_weekly_regular jwr ON jwr.task_type_id = tt.id AND jwr.job_id = ?
     WHERE tt.quest_kind = 'weekly'
     ORDER BY tt.sort_order ASC, tt.id ASC`,
    [jobId]
  );

  const [bossRows] = await pool.execute(
    `SELECT tt.id, tt.base_exp,
            GREATEST(1, COALESCE(NULLIF(tt.weekly_target_steps, 0), 1)) AS target_steps
     FROM task_types tt
     INNER JOIN job_weekly_boss jwb ON jwb.task_type_id = tt.id AND jwb.job_id = ?
     WHERE tt.quest_kind = 'weekly_boss'
     LIMIT 1`,
    [jobId]
  );

  if (!regular.length && !bossRows.length) return;

  const shuffled = [...regular].sort((a, b) =>
    sortToken(userId, weekStart, a.id, 'wreg').localeCompare(sortToken(userId, weekStart, b.id, 'wreg'))
  );
  const regN = Math.min(WEEKLY_REGULAR_QUEST_COUNT, shuffled.length);
  const regSlice = shuffled.slice(0, regN);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const t of regSlice) {
      const steps = Math.max(1, Math.min(32767, Number(t.target_steps) || 1));
      await conn.execute(
        `INSERT INTO user_weekly_tasks (user_id, task_type_id, week_start_date, is_weekly_boss, target_value, current_value, reward_exp)
         VALUES (?, ?, ?, 0, ?, 0, ?)`,
        [userId, t.id, weekStart, steps, t.base_exp]
      );
    }
    if (bossRows.length && WEEKLY_BOSS_QUEST_COUNT > 0) {
      const b = bossRows[0];
      const bSteps = Math.max(1, Math.min(32767, Number(b.target_steps) || 1));
      await conn.execute(
        `INSERT INTO user_weekly_tasks (user_id, task_type_id, week_start_date, is_weekly_boss, target_value, current_value, reward_exp)
         VALUES (?, ?, ?, 1, ?, 0, ?)`,
        [userId, b.id, weekStart, bSteps, b.base_exp]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return;
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * @param {number} userId
 */
async function listWeekForUser(userId) {
  const pool = getPool();
  const weekStart = await getWeekStartDate(pool);
  const hasStreak = await questStreakModel.streakTableExists(pool);
  let rows;
  try {
    if (hasStreak) {
      [rows] = await pool.execute(
        `SELECT uwt.id, uwt.task_type_id, uwt.is_weekly_boss, uwt.target_value, uwt.current_value, uwt.completed_at, uwt.accepted_at, uwt.reward_exp,
                tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp, tt.hero_image_url AS hero_image_url,
                COALESCE(uqs.weekly_streak, 0) AS quest_streak
         FROM user_weekly_tasks uwt
         INNER JOIN task_types tt ON tt.id = uwt.task_type_id
         LEFT JOIN user_quest_streaks uqs ON uqs.user_id = uwt.user_id AND uqs.task_type_id = uwt.task_type_id
         WHERE uwt.user_id = ? AND uwt.week_start_date = ?
         ORDER BY uwt.is_weekly_boss ASC, uwt.id ASC`,
        [userId, weekStart]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT uwt.id, uwt.task_type_id, uwt.is_weekly_boss, uwt.target_value, uwt.current_value, uwt.completed_at, uwt.accepted_at, uwt.reward_exp,
                tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp, tt.hero_image_url AS hero_image_url
         FROM user_weekly_tasks uwt
         INNER JOIN task_types tt ON tt.id = uwt.task_type_id
         WHERE uwt.user_id = ? AND uwt.week_start_date = ?
         ORDER BY uwt.is_weekly_boss ASC, uwt.id ASC`,
        [userId, weekStart]
      );
    }
  } catch (e) {
    if (e.errno !== 1054 && e.code !== 'ER_BAD_FIELD_ERROR') {
      throw e;
    }
    if (hasStreak) {
      [rows] = await pool.execute(
        `SELECT uwt.id, uwt.task_type_id, uwt.is_weekly_boss, uwt.target_value, uwt.current_value, uwt.completed_at, uwt.accepted_at, uwt.reward_exp,
                tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp,
                COALESCE(uqs.weekly_streak, 0) AS quest_streak
         FROM user_weekly_tasks uwt
         INNER JOIN task_types tt ON tt.id = uwt.task_type_id
         LEFT JOIN user_quest_streaks uqs ON uqs.user_id = uwt.user_id AND uqs.task_type_id = uwt.task_type_id
         WHERE uwt.user_id = ? AND uwt.week_start_date = ?
         ORDER BY uwt.is_weekly_boss ASC, uwt.id ASC`,
        [userId, weekStart]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT uwt.id, uwt.task_type_id, uwt.is_weekly_boss, uwt.target_value, uwt.current_value, uwt.completed_at, uwt.accepted_at, uwt.reward_exp,
                tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp
         FROM user_weekly_tasks uwt
         INNER JOIN task_types tt ON tt.id = uwt.task_type_id
         WHERE uwt.user_id = ? AND uwt.week_start_date = ?
         ORDER BY uwt.is_weekly_boss ASC, uwt.id ASC`,
        [userId, weekStart]
      );
    }
  }
  return rows.map((r) => {
    const qs = r.quest_streak != null ? Number(r.quest_streak) : 0;
    const slug = String(r.slug || '');
    const statTag = r.stat_tag == null ? '' : String(r.stat_tag);
    return {
      id: Number(r.id),
      taskTypeId: Number(r.task_type_id),
      isWeeklyBoss: !!Number(r.is_weekly_boss),
      target: Number(r.target_value),
      current: Number(r.current_value),
      done: r.completed_at != null,
      accepted: r.accepted_at != null,
      rewardExp: Number(r.reward_exp),
      baseExp: Number(r.base_exp),
      name: r.task_name,
      slug,
      description: r.description,
      statTag,
      alternatives: parseAlternatives(r.alternatives),
      isBonus: false,
      questStreak: Number.isFinite(qs) ? Math.max(0, Math.floor(qs)) : 0,
      heroImageUrl: resolveHeroImageUrl(r.hero_image_url, slug, statTag),
    };
  });
}

/**
 * @param {number} userId
 * @param {number} userWeeklyTaskId
 */
async function acceptUserWeeklyTask(userId, userWeeklyTaskId) {
  const pool = getPool();
  const weekStart = await getWeekStartDate(pool);
  const [res] = await pool.execute(
    `UPDATE user_weekly_tasks SET accepted_at = UTC_TIMESTAMP()
     WHERE id = ? AND user_id = ? AND week_start_date = ?
       AND accepted_at IS NULL AND completed_at IS NULL`,
    [userWeeklyTaskId, userId, weekStart]
  );
  return Number(res.affectedRows) === 1;
}

/**
 * @param {number} userId
 * @param {number} userWeeklyTaskId
 */
async function completeUserWeeklyTask(userId, userWeeklyTaskId) {
  const pool = getPool();
  const weekStart = await getWeekStartDate(pool);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT id, task_type_id, reward_exp, completed_at, accepted_at, target_value, current_value
       FROM user_weekly_tasks
       WHERE id = ? AND user_id = ? AND week_start_date = ?
       FOR UPDATE`,
      [userWeeklyTaskId, userId, weekStart]
    );
    const row = rows[0];
    if (!row || row.completed_at != null) {
      await conn.rollback();
      return null;
    }

    const target = Math.max(1, Number(row.target_value));
    const cur = Math.max(0, Number(row.current_value));
    const next = cur + 1;

    if (next < target) {
      await conn.execute(`UPDATE user_weekly_tasks SET current_value = ? WHERE id = ?`, [next, userWeeklyTaskId]);
      await conn.commit();
      return { partial: true, current: next, target };
    }

    const gained = Number(row.reward_exp);
    await conn.execute(
      `UPDATE user_weekly_tasks SET completed_at = UTC_TIMESTAMP(), current_value = target_value WHERE id = ?`,
      [userWeeklyTaskId]
    );

    const wTaskTypeId = Number(row.task_type_id);
    if (Number.isFinite(wTaskTypeId) && wTaskTypeId > 0) {
      try {
        await questStreakModel.bumpWeeklyStreak(conn, userId, wTaskTypeId, weekStart);
      } catch (e) {
        if (e.errno !== 1146 && e.code !== 'ER_NO_SUCH_TABLE') {
          throw e;
        }
      }
    }

    const meta = await grantExpToActiveJob(conn, userId, gained);
    const vaultReward = await grantCompletionVaultReward(conn, userId, {
      source: 'weekly',
      isBoss: !!Number(row.is_weekly_boss),
    });
    await conn.commit();
    return {
      ...meta,
      streakBonus: 0,
      baseGained: gained,
      vaultReward,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getWeekTaskById(userId, userWeeklyTaskId) {
  const list = await listWeekForUser(userId);
  return list.find((t) => t.id === userWeeklyTaskId) || null;
}

async function summaryWeekForUser(userId) {
  const tasks = await listWeekForUser(userId);
  const regular = tasks.filter((t) => !t.isWeeklyBoss);
  const boss = tasks.filter((t) => t.isWeeklyBoss);
  return {
    weeklyDone: regular.filter((t) => t.done).length,
    weeklyTotal: regular.length,
    bossDone: boss.filter((t) => t.done).length,
    bossTotal: boss.length,
  };
}

module.exports = {
  ensureWeeklyTasks,
  listWeekForUser,
  acceptUserWeeklyTask,
  completeUserWeeklyTask,
  getWeekTaskById,
  summaryWeekForUser,
  getWeekMeta,
  getWeekStartDate,
};
