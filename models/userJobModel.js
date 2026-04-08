const { getPool } = require('../config/database');
const userModel = require('./userModel');
const jobAdvanceModel = require('./jobAdvanceModel');
const { STARTING_JOB_ID } = require('../config/constants');

const MAX_SLOTS = 3;

/**
 * If current_job_id is not in adventurer_jobs, point it at the lowest filled slot (or Novice if empty).
 * @param {import('mysql2/promise').PoolConnection} [conn]
 */
async function repairCurrentJobIfOrphan(userId, conn) {
  const pool = getPool();
  const c = conn || pool;
  const current = await userModel.getCurrentJobId(userId);
  if (current == null) return;

  const [hit] = await c.execute(
    'SELECT 1 FROM adventurer_jobs WHERE user_id = ? AND job_id = ? LIMIT 1',
    [userId, current]
  );
  if (hit.length) return;

  const [first] = await c.execute(
    'SELECT job_id FROM adventurer_jobs WHERE user_id = ? ORDER BY slot_num ASC LIMIT 1',
    [userId]
  );
  const fallback = first.length ? Number(first[0].job_id) : STARTING_JOB_ID;
  await c.execute('UPDATE users SET current_job_id = ? WHERE id = ?', [fallback, userId]);
}

/**
 * @returns {Promise<Array<{ slot: number, jobId: number, name: string, slug: string, tier: number, isActive: boolean, level: number, totalExp: number }>>}
 */
async function listSlots(userId) {
  const pool = getPool();
  const current = await userModel.getCurrentJobId(userId);
  const [rows] = await pool.execute(
    `SELECT uj.slot_num AS slot, uj.job_id AS jobId, uj.level, uj.total_exp AS totalExp, j.name, j.slug, j.tier
     FROM adventurer_jobs uj
     INNER JOIN jobs j ON j.id = uj.job_id
     WHERE uj.user_id = ?
     ORDER BY uj.slot_num ASC`,
    [userId]
  );
  return rows.map((r) => ({
    slot: Number(r.slot),
    jobId: Number(r.jobId),
    name: String(r.name),
    slug: String(r.slug || ''),
    tier: Number(r.tier) ?? 0,
    isActive: Number(r.jobId) === Number(current),
    level: Number(r.level) || 1,
    totalExp: Number(r.totalExp) || 0,
  }));
}

/**
 * Put first job in slot 1 after onboarding (Novice → first class).
 * Copies account Novice row into the new character, or resets if slot 1 is reassigned to another job.
 */
async function setFirstSlotJob(userId, jobId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ex] = await conn.execute(
      'SELECT job_id FROM adventurer_jobs WHERE user_id = ? AND slot_num = 1 FOR UPDATE',
      [userId]
    );
    if (!ex.length) {
      await conn.execute(
        `INSERT INTO adventurer_jobs (user_id, slot_num, job_id, total_exp, level, stat_str, stat_agi, stat_vit, stat_int, stat_dex, stat_luk, stat_points_unspent)
         SELECT ?, 1, ?, u.total_exp, u.level, u.stat_str, u.stat_agi, u.stat_vit, u.stat_int, u.stat_dex, u.stat_luk, u.stat_points_unspent
         FROM users u WHERE u.id = ?`,
        [userId, jobId, userId]
      );
    } else if (Number(ex[0].job_id) !== Number(jobId)) {
      await conn.execute(
        `UPDATE adventurer_jobs SET job_id = ?, total_exp = 0, level = 1,
            stat_str = 1, stat_agi = 1, stat_vit = 1, stat_int = 1, stat_dex = 1, stat_luk = 1, stat_points_unspent = 0
         WHERE user_id = ? AND slot_num = 1`,
        [jobId, userId]
      );
    }
    await conn.execute('UPDATE users SET current_job_id = ? WHERE id = ?', [jobId, userId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * @param {number} slot 1..MAX_SLOTS
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function assignJobToSlot(userId, slot, jobId) {
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SLOTS) {
    return { ok: false, error: 'invalid_slot' };
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [dup] = await conn.execute(
      'SELECT slot_num FROM adventurer_jobs WHERE user_id = ? AND job_id = ? AND slot_num <> ? LIMIT 1',
      [userId, jobId, slot]
    );
    if (dup.length) {
      await conn.rollback();
      return { ok: false, error: 'duplicate_job' };
    }

    const [existingAtSlot] = await conn.execute(
      'SELECT job_id FROM adventurer_jobs WHERE user_id = ? AND slot_num = ? LIMIT 1',
      [userId, slot]
    );
    if (existingAtSlot.length) {
      await conn.rollback();
      return { ok: false, error: 'slot_occupied' };
    }

    const [countRows] = await conn.execute(
      'SELECT COUNT(*) AS n FROM adventurer_jobs WHERE user_id = ?',
      [userId]
    );
    const n = Number(countRows[0]?.n) || 0;
    if (n >= MAX_SLOTS) {
      await conn.rollback();
      return { ok: false, error: 'slots_full' };
    }

    await conn.execute(
      `INSERT INTO adventurer_jobs (user_id, slot_num, job_id, total_exp, level, stat_str, stat_agi, stat_vit, stat_int, stat_dex, stat_luk, stat_points_unspent)
       VALUES (?, ?, ?, 0, 1, 1, 1, 1, 1, 1, 1, 0)`,
      [userId, slot, jobId]
    );
    await repairCurrentJobIfOrphan(userId, conn);
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function removeSlot(userId, slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SLOTS) {
    return { ok: false, error: 'invalid_slot' };
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [countRows] = await conn.execute(
      'SELECT COUNT(*) AS n FROM adventurer_jobs WHERE user_id = ?',
      [userId]
    );
    if (Number(countRows[0]?.n) <= 1) {
      await conn.rollback();
      return { ok: false, error: 'last_job' };
    }

    const [cur] = await conn.execute('SELECT current_job_id AS id FROM users WHERE id = ? LIMIT 1', [
      userId,
    ]);
    const currentJobId = cur[0]?.id;
    const [row] = await conn.execute(
      'SELECT job_id FROM adventurer_jobs WHERE user_id = ? AND slot_num = ? LIMIT 1',
      [userId, slot]
    );
    if (!row.length) {
      await conn.rollback();
      return { ok: false, error: 'empty_slot' };
    }

    await conn.execute('DELETE FROM adventurer_jobs WHERE user_id = ? AND slot_num = ?', [userId, slot]);
    if (Number(row[0].job_id) === Number(currentJobId)) {
      const [first] = await conn.execute(
        'SELECT job_id FROM adventurer_jobs WHERE user_id = ? ORDER BY slot_num ASC LIMIT 1',
        [userId]
      );
      if (first.length) {
        await conn.execute('UPDATE users SET current_job_id = ? WHERE id = ?', [
          first[0].job_id,
          userId,
        ]);
      }
    } else {
      await repairCurrentJobIfOrphan(userId, conn);
    }
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function setActiveJob(userId, jobId) {
  const pool = getPool();
  const [hit] = await pool.execute(
    'SELECT 1 FROM adventurer_jobs WHERE user_id = ? AND job_id = ? LIMIT 1',
    [userId, jobId]
  );
  if (!hit.length) {
    return { ok: false, error: 'not_in_slots' };
  }
  const ok = await userModel.updateCurrentJob(userId, jobId);
  return ok ? { ok: true } : { ok: false, error: 'update_failed' };
}

/**
 * Promote the active slot from tier-1 to tier-2 when gates pass (job_progressions + jobAdvanceModel).
 * @param {number} userId
 * @param {number} toJobId tier-2 job id
 * @returns {Promise<{ ok: boolean, error?: string, need?: number, have?: number }>}
 */
async function promoteActiveJob(userId, toJobId) {
  if (!Number.isInteger(toJobId) || toJobId < 1) {
    return { ok: false, error: 'invalid_target' };
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cur] = await conn.execute(
      'SELECT current_job_id AS id FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (!cur.length) {
      await conn.rollback();
      return { ok: false, error: 'update_failed' };
    }
    const fromJobId = Number(cur[0].id);

    const [slotRow] = await conn.execute(
      'SELECT slot_num FROM adventurer_jobs WHERE user_id = ? AND job_id = ? LIMIT 1 FOR UPDATE',
      [userId, fromJobId]
    );
    if (!slotRow.length) {
      await conn.rollback();
      return { ok: false, error: 'not_in_slots' };
    }
    const slotNum = Number(slotRow[0].slot_num);

    const [dup] = await conn.execute(
      'SELECT 1 FROM adventurer_jobs WHERE user_id = ? AND job_id = ? AND slot_num <> ? LIMIT 1',
      [userId, toJobId, slotNum]
    );
    if (dup.length) {
      await conn.rollback();
      return { ok: false, error: 'duplicate_job' };
    }

    const v = await jobAdvanceModel.validateAdvance(userId, fromJobId, toJobId);
    if (!v.ok) {
      await conn.rollback();
      return v;
    }

    await conn.execute(
      'UPDATE adventurer_jobs SET job_id = ? WHERE user_id = ? AND slot_num = ?',
      [toJobId, userId, slotNum]
    );
    await conn.execute('UPDATE users SET current_job_id = ? WHERE id = ?', [toJobId, userId]);

    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  MAX_SLOTS,
  listSlots,
  setFirstSlotJob,
  assignJobToSlot,
  removeSlot,
  setActiveJob,
  promoteActiveJob,
};
