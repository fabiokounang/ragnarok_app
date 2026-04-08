const crypto = require('crypto');
const { getPool } = require('../config/database');
const {
  DAILY_CORE_TASK_COUNT,
  DAILY_BONUS_TASK_COUNT,
  DAILY_BONUS_EXP_MULTIPLIER,
  DAILY_BONUS_TARGET_STEPS,
  DAILY_MORNING_OFFER_COUNT,
  STREAK_BONUS_EXP_PER_DAY,
  STREAK_BONUS_MAX_STREAK_DAYS,
  TRAIN_FOCUS_BONUS_PCT,
} = require('../config/constants');
const { levelFromTotalExp, expProgressPercent } = require('../config/experience');
const { grantExpToActiveJob } = require('./progressionGrant');
const { grantCompletionVaultReward } = require('./vaultRewardModel');
const { pillarForTask } = require('../config/dailyPillars');
const questStreakModel = require('./questStreakModel');
const { resolveHeroImageUrl } = require('../config/taskHeroImages');

function sortToken(userId, dateStr, taskTypeId) {
  return crypto
    .createHash('sha256')
    .update(`${userId}|${dateStr}|${taskTypeId}`)
    .digest('hex');
}

/**
 * @param {import('mysql2/promise').Pool} pool
 */
async function getServerDateKey(pool) {
  const [rows] = await pool.execute(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS dk`);
  return String(rows[0].dk);
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

let offersTableExistsCache = null;

/**
 * @param {import('mysql2/promise').Pool} pool
 */
async function offersTableExists(pool) {
  if (offersTableExistsCache !== null) return offersTableExistsCache;
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'user_daily_offers'`
    );
    offersTableExistsCache = Number(rows[0]?.c) > 0;
  } catch {
    offersTableExistsCache = false;
  }
  return offersTableExistsCache;
}

/**
 * Legacy: auto-roll core + bonus (no morning board).
 * @param {number} userId
 * @param {number} jobId
 */
async function legacyRollTodayTasks(userId, jobId) {
  const pool = getPool();
  const [tasks] = await pool.execute(
    `SELECT tt.id, tt.base_exp
     FROM task_types tt
     INNER JOIN job_task_types jtt ON jtt.task_type_id = tt.id AND jtt.job_id = ?
     WHERE tt.quest_kind = 'daily'
     ORDER BY tt.sort_order ASC, tt.id ASC`,
    [jobId]
  );
  if (!tasks.length) return;

  const dateKey = await getServerDateKey(pool);
  const shuffled = [...tasks].sort((a, b) =>
    sortToken(userId, dateKey, a.id).localeCompare(sortToken(userId, dateKey, b.id))
  );

  const coreN = Math.min(DAILY_CORE_TASK_COUNT, shuffled.length);
  const bonusN = Math.min(
    DAILY_BONUS_TASK_COUNT,
    Math.max(0, shuffled.length - coreN)
  );

  const coreSlice = shuffled.slice(0, coreN);
  const remainder = shuffled.slice(coreN);
  const bonusPool = [...remainder].sort((a, b) => Number(b.base_exp) - Number(a.base_exp));
  const bonusSlice = bonusPool.slice(0, bonusN);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const t of coreSlice) {
      await conn.execute(
        `INSERT INTO user_daily_tasks (user_id, task_type_id, task_date, is_bonus, target_value, current_value, reward_exp)
         VALUES (?, ?, CURDATE(), 0, 1, 0, ?)`,
        [userId, t.id, t.base_exp]
      );
    }
    const bonusSteps = Math.max(1, Math.min(32767, DAILY_BONUS_TARGET_STEPS));
    for (const t of bonusSlice) {
      const scaled = Math.round(Number(t.base_exp) * DAILY_BONUS_EXP_MULTIPLIER);
      const rewardExp = Math.min(65535, Math.max(1, scaled));
      await conn.execute(
        `INSERT INTO user_daily_tasks (user_id, task_type_id, task_date, is_bonus, target_value, current_value, reward_exp)
         VALUES (?, ?, CURDATE(), 1, ?, 0, ?)`,
        [userId, t.id, bonusSteps, rewardExp]
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
 * @param {number} jobId
 */
/**
 * @param {string} dateKey YYYY-MM-DD
 * @param {string} [shuffleExtra] appended to date key for paid rerolls (changes sort order)
 */
function dailyShuffleBasis(dateKey, shuffleExtra = '') {
  const s = String(shuffleExtra || '').trim();
  return s ? `${dateKey}|${s}` : dateKey;
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').Connection} exec
 * @param {number} jobId
 */
async function fetchJobDailyTaskPool(exec, jobId) {
  const [tasks] = await exec.execute(
    `SELECT tt.id, tt.base_exp
     FROM task_types tt
     INNER JOIN job_task_types jtt ON jtt.task_type_id = tt.id AND jtt.job_id = ?
     WHERE tt.quest_kind = 'daily'
     ORDER BY tt.sort_order ASC, tt.id ASC`,
    [jobId]
  );
  return tasks;
}

/**
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} userId
 * @param {number} jobId
 * @param {string} shuffleBasis
 */
async function insertMorningOffersShuffled(conn, userId, jobId, shuffleBasis) {
  const tasks = await fetchJobDailyTaskPool(conn, jobId);
  if (!tasks.length) return { ok: false, error: 'empty_pool' };
  const shuffled = [...tasks].sort((a, b) =>
    sortToken(userId, shuffleBasis, a.id).localeCompare(sortToken(userId, shuffleBasis, b.id))
  );
  const offerN = Math.min(DAILY_MORNING_OFFER_COUNT, shuffled.length);
  const slice = shuffled.slice(0, offerN);
  let ord = 0;
  for (const t of slice) {
    await conn.execute(
      `INSERT INTO user_daily_offers (user_id, offer_date, task_type_id, sort_order)
       VALUES (?, CURDATE(), ?, ?)`,
      [userId, t.id, ord++]
    );
  }
  return { ok: true };
}

async function seedMorningOffers(userId, jobId, shuffleExtra = '') {
  const pool = getPool();
  const dateKey = await getServerDateKey(pool);
  const basis = dailyShuffleBasis(dateKey, shuffleExtra);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ins = await insertMorningOffersShuffled(conn, userId, jobId, basis);
    if (!ins.ok) {
      await conn.rollback();
      return;
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
 * @returns {Promise<'active'|'morning_pick'>}
 */
async function ensureTodayFlow(userId, jobId) {
  const pool = getPool();
  const [tc] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_daily_tasks WHERE user_id = ? AND task_date = CURDATE()`,
    [userId]
  );
  if (Number(tc[0].c) > 0) return 'active';

  if (!(await offersTableExists(pool))) {
    await legacyRollTodayTasks(userId, jobId);
    return 'active';
  }

  const [oc] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_daily_offers WHERE user_id = ? AND offer_date = CURDATE()`,
    [userId]
  );
  if (Number(oc[0].c) > 0) return 'morning_pick';

  await seedMorningOffers(userId, jobId);
  return 'morning_pick';
}

/** Back-compat: rolls legacy board or seeds morning offers. */
async function ensureTodayTasks(userId, jobId) {
  await ensureTodayFlow(userId, jobId);
}

/**
 * Paid daily reroll: refresh morning offers (no tasks yet) or swap one incomplete core task.
 * Caller debits Astra and enforces 1/day. Expects an open transaction on `conn`.
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} userId
 * @param {number} jobId
 * @returns {Promise<{ ok: true, mode: 'morning'|'core_swap' } | { ok: false, error: string }>}
 */
async function applyPaidDailyReroll(conn, userId, jobId) {
  const pool = getPool();
  const offersOn = await offersTableExists(pool);

  const [dkRows] = await conn.execute(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS dk`);
  const dateKey = String(dkRows[0]?.dk || '');

  const [uRows] = await conn.execute(
    'SELECT daily_quest_reroll_salt FROM users WHERE id = ? FOR UPDATE',
    [userId]
  );
  if (!uRows.length) return { ok: false, error: 'user_missing' };
  const nextSalt = (Number(uRows[0].daily_quest_reroll_salt) || 0) + 1;
  await conn.execute('UPDATE users SET daily_quest_reroll_salt = ? WHERE id = ?', [nextSalt, userId]);
  const shuffleBasis = dailyShuffleBasis(dateKey, String(nextSalt));

  const [tc] = await conn.execute(
    `SELECT COUNT(*) AS c FROM user_daily_tasks WHERE user_id = ? AND task_date = CURDATE()`,
    [userId]
  );
  const taskCount = Number(tc[0]?.c) || 0;

  if (offersOn) {
    const [oc] = await conn.execute(
      `SELECT COUNT(*) AS c FROM user_daily_offers WHERE user_id = ? AND offer_date = CURDATE()`,
      [userId]
    );
    const offerCount = Number(oc[0]?.c) || 0;

    if (taskCount === 0 && offerCount > 0) {
      await conn.execute(`DELETE FROM user_daily_offers WHERE user_id = ? AND offer_date = CURDATE()`, [userId]);
      const ins = await insertMorningOffersShuffled(conn, userId, jobId, shuffleBasis);
      if (!ins.ok) return { ok: false, error: 'empty_pool' };
      return { ok: true, mode: 'morning' };
    }
  }

  if (taskCount === 0) {
    return { ok: false, error: 'nothing_to_reroll' };
  }

  const [incomplete] = await conn.execute(
    `SELECT id, task_type_id FROM user_daily_tasks
     WHERE user_id = ? AND task_date = CURDATE() AND is_bonus = 0 AND completed_at IS NULL
     ORDER BY id ASC`,
    [userId]
  );
  if (!incomplete.length) return { ok: false, error: 'nothing_to_reroll' };

  const pickSalt = crypto.createHash('sha256').update(`${userId}|${dateKey}|${nextSalt}|pick`).digest();
  const idx = pickSalt.readUInt32BE(0) % incomplete.length;
  const victim = incomplete[idx];
  const victimId = Number(victim.id);
  const oldType = Number(victim.task_type_id);

  await conn.execute(`DELETE FROM user_daily_tasks WHERE id = ? AND user_id = ? LIMIT 1`, [victimId, userId]);

  const [usedTypes] = await conn.execute(
    `SELECT task_type_id FROM user_daily_tasks WHERE user_id = ? AND task_date = CURDATE()`,
    [userId]
  );
  const used = new Set(usedTypes.map((r) => Number(r.task_type_id)));
  const poolTasks = await fetchJobDailyTaskPool(conn, jobId);
  const candidates = poolTasks.filter((t) => !used.has(Number(t.id)));

  const restoreOld = async () => {
    const [expRows] = await conn.execute(`SELECT base_exp FROM task_types WHERE id = ? LIMIT 1`, [oldType]);
    const exp = Number(expRows[0]?.base_exp) || 25;
    await conn.execute(
      `INSERT INTO user_daily_tasks (user_id, task_type_id, task_date, is_bonus, target_value, current_value, reward_exp)
       VALUES (?, ?, CURDATE(), 0, 1, 0, ?)`,
      [userId, oldType, exp]
    );
  };

  if (!candidates.length) {
    await restoreOld();
    return { ok: false, error: 'no_alternate_task' };
  }

  const candSorted = [...candidates].sort((a, b) =>
    sortToken(userId, shuffleBasis, a.id).localeCompare(sortToken(userId, shuffleBasis, b.id))
  );
  const newT = candSorted[0];
  const exp = Number(newT.base_exp) || 25;
  await conn.execute(
    `INSERT INTO user_daily_tasks (user_id, task_type_id, task_date, is_bonus, target_value, current_value, reward_exp)
     VALUES (?, ?, CURDATE(), 0, 1, 0, ?)`,
    [userId, newT.id, exp]
  );
  return { ok: true, mode: 'core_swap' };
}

/**
 * @param {number} userId
 */
async function listMorningOffers(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT uo.id AS offerRowId, uo.task_type_id AS taskTypeId, uo.sort_order,
            tt.slug, tt.name AS task_name, tt.description, tt.base_exp, tt.stat_tag, tt.alternatives
     FROM user_daily_offers uo
     INNER JOIN task_types tt ON tt.id = uo.task_type_id
     WHERE uo.user_id = ? AND uo.offer_date = CURDATE()
     ORDER BY uo.sort_order ASC, uo.id ASC`,
    [userId]
  );
  return rows.map((r) => {
    const slug = String(r.slug || '');
    const statTag = r.stat_tag == null ? '' : String(r.stat_tag);
    const pillar = pillarForTask(slug, statTag);
    return {
      offerRowId: Number(r.offerRowId),
      taskTypeId: Number(r.taskTypeId),
      sortOrder: Number(r.sort_order),
      slug,
      name: String(r.task_name || ''),
      description: r.description == null ? '' : String(r.description),
      baseExp: Number(r.base_exp) || 0,
      statTag,
      alternatives: parseAlternatives(r.alternatives),
      pillarId: pillar.id,
      pillarLabel: pillar.label,
      pillarHint: pillar.hint,
    };
  });
}

/**
 * @param {number} userId
 * @param {number} jobId
 * @param {number[]} rawTaskTypeIds
 */
async function commitMorningPicks(userId, jobId, rawTaskTypeIds) {
  const pool = getPool();
  const ids = [
    ...new Set(
      (rawTaskTypeIds || [])
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];

  const offers = await listMorningOffers(userId);
  const offerTypeIds = new Set(offers.map((o) => o.taskTypeId));
  const maxPick = Math.min(DAILY_CORE_TASK_COUNT, offerTypeIds.size);

  if (ids.length < 1 || ids.length > maxPick) {
    return { ok: false, error: 'bad_count' };
  }
  for (const id of ids) {
    if (!offerTypeIds.has(id)) {
      return { ok: false, error: 'invalid_pick' };
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(`DELETE FROM user_daily_offers WHERE user_id = ? AND offer_date = CURDATE()`, [userId]);

    for (const tid of ids) {
      const [expRows] = await conn.execute(`SELECT base_exp FROM task_types WHERE id = ? LIMIT 1`, [tid]);
      const exp = Number(expRows[0]?.base_exp) || 25;
      await conn.execute(
        `INSERT INTO user_daily_tasks (user_id, task_type_id, task_date, is_bonus, target_value, current_value, reward_exp)
         VALUES (?, ?, CURDATE(), 0, 1, 0, ?)`,
        [userId, tid, exp]
      );
    }

    const [poolTasks] = await conn.execute(
      `SELECT tt.id, tt.base_exp
       FROM task_types tt
       INNER JOIN job_task_types jtt ON jtt.task_type_id = tt.id AND jtt.job_id = ?
       WHERE tt.quest_kind = 'daily'
       ORDER BY tt.sort_order ASC, tt.id ASC`,
      [jobId]
    );
    const picked = new Set(ids);
    const remainder = poolTasks.filter((t) => !picked.has(Number(t.id)));
    remainder.sort((a, b) => Number(b.base_exp) - Number(a.base_exp));
    const bonusN = Math.min(DAILY_BONUS_TASK_COUNT, remainder.length);
    const bonusSlice = remainder.slice(0, bonusN);
    const bonusSteps = Math.max(1, Math.min(32767, DAILY_BONUS_TARGET_STEPS));
    for (const t of bonusSlice) {
      const scaled = Math.round(Number(t.base_exp) * DAILY_BONUS_EXP_MULTIPLIER);
      const rewardExp = Math.min(65535, Math.max(1, scaled));
      await conn.execute(
        `INSERT INTO user_daily_tasks (user_id, task_type_id, task_date, is_bonus, target_value, current_value, reward_exp)
         VALUES (?, ?, CURDATE(), 1, ?, 0, ?)`,
        [userId, t.id, bonusSteps, rewardExp]
      );
    }

    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return { ok: false, error: 'duplicate' };
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * @param {number} userId
 * @param {number} userDailyTaskId
 * @param {string} noteRaw
 */
async function updateTaskNote(userId, userDailyTaskId, noteRaw) {
  const pool = getPool();
  const trimmed = String(noteRaw || '').trim();
  const note = trimmed.length ? trimmed.slice(0, 768) : null;
  try {
    const [res] = await pool.execute(
      `UPDATE user_daily_tasks SET user_note = ?
       WHERE id = ? AND user_id = ? AND task_date = CURDATE()`,
      [note, userDailyTaskId, userId]
    );
    return Number(res.affectedRows) === 1;
  } catch (e) {
    if (e.errno === 1054 || e.code === 'ER_BAD_FIELD_ERROR') {
      return false;
    }
    throw e;
  }
}

/**
 * @param {number} userId
 */
async function getTodayReflection(userId) {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(
      `SELECT body FROM user_daily_reflections WHERE user_id = ? AND reflection_date = CURDATE() LIMIT 1`,
      [userId]
    );
    if (!rows.length) return '';
    return String(rows[0].body || '');
  } catch (e) {
    if (e.errno === 1146 || e.code === 'ER_NO_SUCH_TABLE') {
      return '';
    }
    throw e;
  }
}

/**
 * @param {number} userId
 * @param {string} bodyRaw
 */
async function saveTodayReflection(userId, bodyRaw) {
  const pool = getPool();
  const body = String(bodyRaw || '').trim().slice(0, 2000);
  if (!body.length) {
    return { ok: false, error: 'empty' };
  }
  try {
    await pool.execute(
      `INSERT INTO user_daily_reflections (user_id, reflection_date, body)
       VALUES (?, CURDATE(), ?)
       ON DUPLICATE KEY UPDATE body = VALUES(body)`,
      [userId, body]
    );
    return { ok: true };
  } catch (e) {
    if (e.errno === 1146 || e.code === 'ER_NO_SUCH_TABLE') {
      return { ok: false, error: 'no_table' };
    }
    throw e;
  }
}

/**
 * @param {number} userId
 * @param {number} loginStreak
 */
function streakBonusPreview(loginStreak) {
  const st = Math.min(Math.max(1, Number(loginStreak) || 1), STREAK_BONUS_MAX_STREAK_DAYS);
  return st * STREAK_BONUS_EXP_PER_DAY;
}

/**
 * @param {Record<string, unknown>} r
 */
function mapDailyRow(r) {
  const slug = String(r.slug || '');
  const statTag = r.stat_tag == null ? '' : String(r.stat_tag);
  const pillar = pillarForTask(slug, statTag);
  const qs = r.quest_streak != null ? Number(r.quest_streak) : 0;
  const tid = Number(r.task_type_id);
  return {
    id: Number(r.id),
    taskTypeId: Number.isFinite(tid) ? tid : 0,
    isBonus: !!Number(r.is_bonus),
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
    userNote: r.user_note != null && String(r.user_note).trim() !== '' ? String(r.user_note) : '',
    pillarId: pillar.id,
    pillarLabel: pillar.label,
    pillarHint: pillar.hint,
    questStreak: Number.isFinite(qs) ? Math.max(0, Math.floor(qs)) : 0,
    heroImageUrl: resolveHeroImageUrl(r.hero_image_url, slug, statTag),
  };
}

/**
 * @param {number} userId
 */
async function listTodayForUser(userId) {
  const pool = getPool();
  const hasStreak = await questStreakModel.streakTableExists(pool);
  let rows;
  try {
    if (hasStreak) {
      [rows] = await pool.execute(
        `SELECT udt.id, udt.task_type_id, udt.is_bonus, udt.target_value, udt.current_value, udt.completed_at, udt.accepted_at, udt.reward_exp, udt.user_note,
                tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp, tt.hero_image_url AS hero_image_url,
                COALESCE(uqs.daily_streak, 0) AS quest_streak
         FROM user_daily_tasks udt
         INNER JOIN task_types tt ON tt.id = udt.task_type_id
         LEFT JOIN user_quest_streaks uqs ON uqs.user_id = udt.user_id AND uqs.task_type_id = udt.task_type_id
         WHERE udt.user_id = ? AND udt.task_date = CURDATE()
         ORDER BY udt.is_bonus ASC, udt.id ASC`,
        [userId]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT udt.id, udt.task_type_id, udt.is_bonus, udt.target_value, udt.current_value, udt.completed_at, udt.accepted_at, udt.reward_exp, udt.user_note,
                tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp, tt.hero_image_url AS hero_image_url
         FROM user_daily_tasks udt
         INNER JOIN task_types tt ON tt.id = udt.task_type_id
         WHERE udt.user_id = ? AND udt.task_date = CURDATE()
         ORDER BY udt.is_bonus ASC, udt.id ASC`,
        [userId]
      );
    }
  } catch (e) {
    if (e.errno !== 1054 && e.code !== 'ER_BAD_FIELD_ERROR') {
      throw e;
    }
    try {
      if (hasStreak) {
        [rows] = await pool.execute(
          `SELECT udt.id, udt.task_type_id, udt.is_bonus, udt.target_value, udt.current_value, udt.completed_at, udt.accepted_at, udt.reward_exp, udt.user_note,
                  tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp,
                  COALESCE(uqs.daily_streak, 0) AS quest_streak
           FROM user_daily_tasks udt
           INNER JOIN task_types tt ON tt.id = udt.task_type_id
           LEFT JOIN user_quest_streaks uqs ON uqs.user_id = udt.user_id AND uqs.task_type_id = udt.task_type_id
           WHERE udt.user_id = ? AND udt.task_date = CURDATE()
           ORDER BY udt.is_bonus ASC, udt.id ASC`,
          [userId]
        );
      } else {
        [rows] = await pool.execute(
          `SELECT udt.id, udt.task_type_id, udt.is_bonus, udt.target_value, udt.current_value, udt.completed_at, udt.accepted_at, udt.reward_exp, udt.user_note,
                  tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp
           FROM user_daily_tasks udt
           INNER JOIN task_types tt ON tt.id = udt.task_type_id
           WHERE udt.user_id = ? AND udt.task_date = CURDATE()
           ORDER BY udt.is_bonus ASC, udt.id ASC`,
          [userId]
        );
      }
    } catch (e2) {
      if (e2.errno !== 1054 && e2.code !== 'ER_BAD_FIELD_ERROR') {
        throw e2;
      }
      [rows] = await pool.execute(
        `SELECT udt.id, udt.task_type_id, udt.is_bonus, udt.target_value, udt.current_value, udt.completed_at, udt.accepted_at, udt.reward_exp,
                tt.name AS task_name, tt.slug, tt.description, tt.alternatives, tt.stat_tag, tt.base_exp
         FROM user_daily_tasks udt
         INNER JOIN task_types tt ON tt.id = udt.task_type_id
         WHERE udt.user_id = ? AND udt.task_date = CURDATE()
         ORDER BY udt.is_bonus ASC, udt.id ASC`,
        [userId]
      );
    }
  }
  return rows.map((r) => mapDailyRow(r));
}

/**
 * Mark quest as taken from the board (required before check-ins / EXP claim).
 * @param {number} userId
 * @param {number} userDailyTaskId
 */
async function acceptUserDailyTask(userId, userDailyTaskId) {
  const pool = getPool();
  const [res] = await pool.execute(
    `UPDATE user_daily_tasks SET accepted_at = UTC_TIMESTAMP()
     WHERE id = ? AND user_id = ? AND task_date = CURDATE()
       AND accepted_at IS NULL AND completed_at IS NULL`,
    [userDailyTaskId, userId]
  );
  return Number(res.affectedRows) === 1;
}

/**
 * One tap advances progress after quest is accepted. When current reaches target, grant EXP and seal the quest.
 * @param {number} userId
 * @param {number} userDailyTaskId
 * @returns {Promise<{ gained: number, level: number, totalExp: number, previousLevel: number, leveledUp: boolean, statPointsGained: number, expPctBefore: number, expPctAfter: number } | { partial: true, current: number, target: number } | null>}
 */
async function completeUserDailyTask(userId, userDailyTaskId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT id, task_type_id, reward_exp, completed_at, accepted_at, target_value, current_value, is_bonus
       FROM user_daily_tasks
       WHERE id = ? AND user_id = ? AND task_date = CURDATE()
       FOR UPDATE`,
      [userDailyTaskId, userId]
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
      await conn.execute(`UPDATE user_daily_tasks SET current_value = ? WHERE id = ?`, [next, userDailyTaskId]);
      await conn.commit();
      return { partial: true, current: next, target };
    }

    const baseGained = Number(row.reward_exp);
    await conn.execute(
      `UPDATE user_daily_tasks SET completed_at = UTC_TIMESTAMP(), current_value = target_value WHERE id = ?`,
      [userDailyTaskId]
    );

    const taskTypeId = Number(row.task_type_id);
    if (Number.isFinite(taskTypeId) && taskTypeId > 0) {
      try {
        await questStreakModel.bumpDailyStreak(conn, userId, taskTypeId);
      } catch (e) {
        if (e.errno !== 1146 && e.code !== 'ER_NO_SUCH_TABLE') {
          throw e;
        }
      }
    }

    let streakBonus = 0;
    if (!Number(row.is_bonus)) {
      const [cntRows] = await conn.execute(
        `SELECT COUNT(*) AS c FROM user_daily_tasks
         WHERE user_id = ? AND task_date = CURDATE() AND is_bonus = 0
           AND completed_at IS NOT NULL AND id <> ?`,
        [userId, userDailyTaskId]
      );
      if (Number(cntRows[0].c) === 0) {
        const [su] = await conn.execute('SELECT login_streak FROM users WHERE id = ? FOR UPDATE', [userId]);
        const rawSt = Number(su[0]?.login_streak) || 1;
        const st = Math.min(Math.max(1, rawSt), STREAK_BONUS_MAX_STREAK_DAYS);
        streakBonus = st * STREAK_BONUS_EXP_PER_DAY;
      }
    }

    let focusBonusExp = 0;
    try {
      const [td] = await conn.execute(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d`);
      const todayDateStr = String(td[0]?.d || '');
      const [fu] = await conn.execute(
        `SELECT train_focus_charges, train_focus_expires_date
         FROM users WHERE id = ? FOR UPDATE`,
        [userId]
      );
      const expiresToday = String(fu[0]?.train_focus_expires_date || '') === todayDateStr;
      const charges = expiresToday ? Math.max(0, Number(fu[0]?.train_focus_charges) || 0) : 0;
      if (charges > 0) {
        focusBonusExp = Math.max(0, Math.floor((baseGained + streakBonus) * TRAIN_FOCUS_BONUS_PCT));
        await conn.execute(
          `UPDATE users
           SET train_focus_charges = GREATEST(0, train_focus_charges - 1)
           WHERE id = ?`,
          [userId]
        );
      }
    } catch (e) {
      if (e.errno !== 1054 && e.code !== 'ER_BAD_FIELD_ERROR') throw e;
    }

    const totalGained = baseGained + streakBonus + focusBonusExp;
    const meta = await grantExpToActiveJob(conn, userId, totalGained);
    const vaultReward = await grantCompletionVaultReward(conn, userId, {
      source: 'daily',
      isBonus: !!Number(row.is_bonus),
    });

    await conn.commit();
    return {
      ...meta,
      gained: totalGained,
      baseGained,
      streakBonus,
      focusBonusExp,
      vaultReward,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getServerTodayMeta() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS dateStr,
            DATE_FORMAT(UTC_TIMESTAMP(), '%H:%i') AS utcTime`
  );
  return {
    dateStr: String(rows[0].dateStr),
    utcTime: String(rows[0].utcTime),
  };
}

/**
 * @param {number} userId
 * @param {number} userDailyTaskId
 */
async function getTodayTaskById(userId, userDailyTaskId) {
  const list = await listTodayForUser(userId);
  return list.find((t) => t.id === userDailyTaskId) || null;
}

/**
 * @param {number} userId
 */
async function summaryCountsForUser(userId) {
  const tasks = await listTodayForUser(userId);
  const core = tasks.filter((t) => !t.isBonus);
  const bonus = tasks.filter((t) => t.isBonus);
  return {
    coreDone: core.filter((t) => t.done).length,
    coreTotal: core.length,
    bonusDone: bonus.filter((t) => t.done).length,
    bonusTotal: bonus.length,
  };
}

/**
 * @param {number} userId
 */
async function userHasAnyQuestHistory(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
       EXISTS(SELECT 1 FROM user_daily_tasks WHERE user_id = ? AND completed_at IS NOT NULL LIMIT 1) AS d,
       EXISTS(SELECT 1 FROM user_weekly_tasks WHERE user_id = ? AND completed_at IS NOT NULL LIMIT 1) AS w`,
    [userId, userId]
  );
  return !!(Number(rows[0].d) || Number(rows[0].w));
}

/**
 * @param {number} userId
 * @param {{
 *   scope?: 'all'|'daily'|'weekly',
 *   presetDays?: number | null,
 *   dateFrom?: string | null,
 *   dateTo?: string | null,
 * }} [opts]
 */
async function getQuestHistoryForUser(userId, opts = {}) {
  const pool = getPool();
  const scopeRaw = String(opts.scope || 'all').toLowerCase();
  const scope = ['all', 'daily', 'weekly'].includes(scopeRaw) ? scopeRaw : 'all';

  const [todayRow] = await pool.execute(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d`);
  const serverToday = String(todayRow[0].d);

  const fromIn =
    opts.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(String(opts.dateFrom)) ? String(opts.dateFrom) : null;
  const toIn = opts.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(String(opts.dateTo)) ? String(opts.dateTo) : null;

  /** @type {string} */
  let dateFrom;
  /** @type {string} */
  let dateTo;
  /** @type {number | null} */
  let presetDays = null;
  /** @type {'preset'|'range'} */
  let rangeMode = 'preset';

  if (fromIn && toIn) {
    rangeMode = 'range';
    dateFrom = fromIn <= toIn ? fromIn : toIn;
    dateTo = fromIn <= toIn ? toIn : fromIn;
    if (dateTo > serverToday) dateTo = serverToday;
    if (dateFrom > dateTo) dateFrom = dateTo;
    const t0 = new Date(`${dateFrom}T12:00:00.000Z`);
    const t1 = new Date(`${dateTo}T12:00:00.000Z`);
    const span = Math.floor((t1.getTime() - t0.getTime()) / 86400000) + 1;
    if (span > 180) {
      const u = new Date(t1);
      u.setUTCDate(u.getUTCDate() - 179);
      dateFrom = u.toISOString().slice(0, 10);
    }
  } else {
    const n = Number(opts.presetDays);
    const safeDays = [7, 30, 90].includes(n) ? n : 30;
    presetDays = safeDays;
    const lookbackDays = Math.max(0, safeDays - 1);
    dateTo = serverToday;
    const d = new Date(`${serverToday}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - lookbackDays);
    dateFrom = d.toISOString().slice(0, 10);
  }

  const runDaily = scope !== 'weekly';
  const runWeekly = scope !== 'daily';
  const runReflections = scope === 'all' || scope === 'daily';

  /** @type {any[]} */
  let dailyRows = [];
  if (runDaily) {
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(udt.task_date, '%Y-%m-%d') AS date_key,
              udt.completed_at,
              udt.is_bonus,
              udt.reward_exp,
              tt.name AS task_name,
              tt.slug,
              tt.stat_tag
       FROM user_daily_tasks udt
       INNER JOIN task_types tt ON tt.id = udt.task_type_id
       WHERE udt.user_id = ?
         AND udt.completed_at IS NOT NULL
         AND udt.task_date >= ?
         AND udt.task_date <= ?
       ORDER BY udt.task_date DESC, udt.completed_at DESC`,
      [userId, dateFrom, dateTo]
    );
    dailyRows = rows;
  }

  /** @type {any[]} */
  let weeklyRows = [];
  if (runWeekly) {
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(DATE(uwt.completed_at), '%Y-%m-%d') AS date_key,
              uwt.completed_at,
              uwt.is_weekly_boss,
              uwt.reward_exp,
              tt.name AS task_name,
              tt.slug,
              tt.stat_tag
       FROM user_weekly_tasks uwt
       INNER JOIN task_types tt ON tt.id = uwt.task_type_id
       WHERE uwt.user_id = ?
         AND uwt.completed_at IS NOT NULL
         AND DATE(uwt.completed_at) >= ?
         AND DATE(uwt.completed_at) <= ?
       ORDER BY DATE(uwt.completed_at) DESC, uwt.completed_at DESC`,
      [userId, dateFrom, dateTo]
    );
    weeklyRows = rows;
  }

  let reflectionRows = [];
  if (runReflections) {
    try {
      const [rows] = await pool.execute(
        `SELECT DATE_FORMAT(reflection_date, '%Y-%m-%d') AS date_key, body, updated_at
         FROM user_daily_reflections
         WHERE user_id = ?
           AND reflection_date >= ?
           AND reflection_date <= ?
         ORDER BY reflection_date DESC, updated_at DESC`,
        [userId, dateFrom, dateTo]
      );
      reflectionRows = rows;
    } catch (e) {
      if (e.errno !== 1146 && e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }
  }

  /** @type {Record<string, { dateKey: string, daily: any[], weekly: any[], reflections: any[] }>} */
  const byDate = {};
  const ensureDate = (k) => {
    if (!byDate[k]) byDate[k] = { dateKey: k, daily: [], weekly: [], reflections: [] };
    return byDate[k];
  };

  for (const r of dailyRows) {
    const b = ensureDate(String(r.date_key));
    b.daily.push({
      name: String(r.task_name || ''),
      slug: String(r.slug || ''),
      statTag: r.stat_tag == null ? '' : String(r.stat_tag),
      rewardExp: Number(r.reward_exp) || 0,
      isBonus: !!Number(r.is_bonus),
      completedAt: r.completed_at,
    });
  }
  for (const r of weeklyRows) {
    const b = ensureDate(String(r.date_key));
    b.weekly.push({
      name: String(r.task_name || ''),
      slug: String(r.slug || ''),
      statTag: r.stat_tag == null ? '' : String(r.stat_tag),
      rewardExp: Number(r.reward_exp) || 0,
      isBoss: !!Number(r.is_weekly_boss),
      completedAt: r.completed_at,
    });
  }
  for (const r of reflectionRows) {
    const b = ensureDate(String(r.date_key));
    b.reflections.push({
      body: String(r.body || ''),
      updatedAt: r.updated_at,
    });
  }

  let daysList = Object.values(byDate).sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));

  if (scope === 'daily') {
    daysList = daysList.filter((d) => d.daily.length > 0 || d.reflections.length > 0);
  } else if (scope === 'weekly') {
    daysList = daysList.filter((d) => d.weekly.length > 0);
  }

  let dailyCoreDone = 0;
  let dailyBonusDone = 0;
  let weeklyDone = 0;
  let weeklyBossDone = 0;
  let reflectionsCount = 0;
  let expTotal = 0;

  for (const d of daysList) {
    reflectionsCount += d.reflections.length;
    for (const x of d.daily) {
      expTotal += Number(x.rewardExp) || 0;
      if (x.isBonus) dailyBonusDone += 1;
      else dailyCoreDone += 1;
    }
    for (const x of d.weekly) {
      expTotal += Number(x.rewardExp) || 0;
      if (x.isBoss) weeklyBossDone += 1;
      else weeklyDone += 1;
    }
  }

  return {
    scope,
    rangeMode,
    presetDays,
    range: { dateFrom, dateTo },
    summary: {
      dailyCoreDone,
      dailyBonusDone,
      weeklyDone,
      weeklyBossDone,
      reflectionsCount,
      expTotal,
    },
    daysList,
  };
}

module.exports = {
  ensureTodayTasks,
  ensureTodayFlow,
  applyPaidDailyReroll,
  listMorningOffers,
  commitMorningPicks,
  updateTaskNote,
  getTodayReflection,
  saveTodayReflection,
  streakBonusPreview,
  listTodayForUser,
  acceptUserDailyTask,
  completeUserDailyTask,
  getServerTodayMeta,
  getTodayTaskById,
  summaryCountsForUser,
  getQuestHistoryForUser,
  userHasAnyQuestHistory,
};
