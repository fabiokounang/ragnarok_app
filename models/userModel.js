const { getPool } = require('../config/database');
const { RO_STAT_CAP, RO_STAT_KEYS } = require('../config/constants');

const RO_STAT_COLUMN = {
  str: 'stat_str',
  agi: 'stat_agi',
  vit: 'stat_vit',
  int: 'stat_int',
  dex: 'stat_dex',
  luk: 'stat_luk',
};

/**
 * @param {string} email
 * @returns {Promise<object|undefined>}
 */
async function findByEmail(email) {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, username, password_hash AS passwordHash, display_name AS displayName,
              current_job_id AS currentJobId, level, total_exp AS totalExp
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0];
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.execute(
        `SELECT id, email, password_hash AS passwordHash, display_name AS displayName,
                current_job_id AS currentJobId, level, total_exp AS totalExp
         FROM users WHERE email = ? LIMIT 1`,
        [email]
      );
      if (!rows[0]) return rows[0];
      return { ...rows[0], username: String(rows[0].email || '').split('@')[0] || '' };
    }
    throw err;
  }
}

/**
 * @param {string} login username or email
 * @returns {Promise<object|undefined>}
 */
async function findByLogin(login) {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, username, password_hash AS passwordHash, display_name AS displayName,
              current_job_id AS currentJobId, level, total_exp AS totalExp
       FROM users
       WHERE email = ? OR username = ?
       LIMIT 1`,
      [login, login]
    );
    return rows[0];
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return findByEmail(login);
    }
    throw err;
  }
}

/**
 * @param {number} id
 * @returns {Promise<object|undefined>}
 */
async function findWithJobById(id) {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.username, u.display_name AS displayName, u.current_job_id AS currentJobId,
              COALESCE(ag.level, u.level) AS level,
              COALESCE(ag.total_exp, u.total_exp) AS totalExp,
              COALESCE(ag.stat_str, u.stat_str) AS stat_str,
              COALESCE(ag.stat_agi, u.stat_agi) AS stat_agi,
              COALESCE(ag.stat_vit, u.stat_vit) AS stat_vit,
              COALESCE(ag.stat_int, u.stat_int) AS stat_int,
              COALESCE(ag.stat_dex, u.stat_dex) AS stat_dex,
              COALESCE(ag.stat_luk, u.stat_luk) AS stat_luk,
              COALESCE(ag.stat_points_unspent, u.stat_points_unspent) AS stat_points_unspent,
              u.music_enabled AS music_enabled,
              u.login_streak AS loginStreak,
              u.astra_balance AS astra_balance,
              u.renown_points AS renown_points,
              j.name AS jobName, j.slug AS jobSlug
       FROM users u
       INNER JOIN jobs j ON j.id = u.current_job_id
       LEFT JOIN adventurer_jobs ag ON ag.user_id = u.id AND ag.job_id = u.current_job_id
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0];
  } catch (err) {
    // Backward compatibility for DBs that haven't run migrate-019 yet.
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.execute(
        `SELECT u.id, u.email, u.display_name AS displayName, u.current_job_id AS currentJobId,
                COALESCE(ag.level, u.level) AS level,
                COALESCE(ag.total_exp, u.total_exp) AS totalExp,
                COALESCE(ag.stat_str, u.stat_str) AS stat_str,
                COALESCE(ag.stat_agi, u.stat_agi) AS stat_agi,
                COALESCE(ag.stat_vit, u.stat_vit) AS stat_vit,
                COALESCE(ag.stat_int, u.stat_int) AS stat_int,
                COALESCE(ag.stat_dex, u.stat_dex) AS stat_dex,
                COALESCE(ag.stat_luk, u.stat_luk) AS stat_luk,
                COALESCE(ag.stat_points_unspent, u.stat_points_unspent) AS stat_points_unspent,
                u.music_enabled AS music_enabled,
                u.login_streak AS loginStreak,
                j.name AS jobName, j.slug AS jobSlug
         FROM users u
         INNER JOIN jobs j ON j.id = u.current_job_id
         LEFT JOIN adventurer_jobs ag ON ag.user_id = u.id AND ag.job_id = u.current_job_id
         WHERE u.id = ?
         LIMIT 1`,
        [id]
      );
      if (!rows[0]) return rows[0];
      return {
        ...rows[0],
        username: String(rows[0].email || '').split('@')[0] || '',
        astra_balance: 0,
        renown_points: 0,
      };
    }
    throw err;
  }
}

/**
 * @param {{ email: string, username: string, passwordHash: string, displayName: string, currentJobId: number }} data
 * @returns {Promise<number>} insertId
 */
async function createUser(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO users (email, username, password_hash, display_name, current_job_id, level, total_exp)
     VALUES (?, ?, ?, ?, ?, 1, 0)`,
    [data.email, data.username, data.passwordHash, data.displayName, data.currentJobId]
  );
  return result.insertId;
}

/**
 * @param {number} userId
 * @returns {Promise<number|undefined>}
 */
async function getCurrentJobId(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT current_job_id AS id FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return rows[0]?.id;
}

/**
 * @param {number} userId
 * @param {number} jobId
 * @returns {Promise<boolean>}
 */
async function updateCurrentJob(userId, jobId) {
  const pool = getPool();
  const [result] = await pool.execute(
    'UPDATE users SET current_job_id = ? WHERE id = ?',
    [jobId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * @param {number} userId
 * @param {boolean} enabled
 */
async function updateMusicEnabled(userId, enabled) {
  const pool = getPool();
  const [result] = await pool.execute('UPDATE users SET music_enabled = ? WHERE id = ?', [
    enabled ? 1 : 0,
    userId,
  ]);
  return result.affectedRows > 0;
}

/**
 * Persist derived level for Novice (users) or active job row (adventurer_jobs).
 * @param {number} userId
 * @param {number} level
 */
async function updateLevel(userId, level) {
  const pool = getPool();
  const jid = await getCurrentJobId(userId);
  if (jid != null) {
    const [r] = await pool.execute(
      'UPDATE adventurer_jobs SET level = ? WHERE user_id = ? AND job_id = ?',
      [level, userId, jid]
    );
    if (r.affectedRows > 0) return true;
  }
  const [result] = await pool.execute('UPDATE users SET level = ? WHERE id = ?', [level, userId]);
  return result.affectedRows > 0;
}

/**
 * @param {number} userId
 * @param {string} key One of RO_STAT_KEYS
 * @returns {Promise<boolean>}
 */
async function allocateStatPoint(userId, key) {
  if (!RO_STAT_KEYS.includes(key)) return false;
  const col = RO_STAT_COLUMN[key];
  if (!col) return false;
  const pool = getPool();
  const jid = await getCurrentJobId(userId);
  if (jid != null) {
    const [r] = await pool.execute(
      `UPDATE adventurer_jobs SET \`${col}\` = \`${col}\` + 1, stat_points_unspent = stat_points_unspent - 1
       WHERE user_id = ? AND job_id = ? AND stat_points_unspent > 0 AND \`${col}\` < ?`,
      [userId, jid, RO_STAT_CAP]
    );
    if (r.affectedRows === 1) return true;
  }
  const [result] = await pool.execute(
    `UPDATE users SET \`${col}\` = \`${col}\` + 1, stat_points_unspent = stat_points_unspent - 1
     WHERE id = ? AND stat_points_unspent > 0 AND \`${col}\` < ?`,
    [userId, RO_STAT_CAP]
  );
  return result.affectedRows === 1;
}

/**
 * Active job stat display (same mapping as gameLocals / profile UI).
 * @param {object|undefined} row from findWithJobById
 * @returns {{ stats: object, statPointsUnspent: number } | null}
 */
function statSheetFromUserRow(row) {
  if (!row) return null;
  const n = (v, d) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  };
  return {
    stats: {
      str: n(row.stat_str, 1),
      agi: n(row.stat_agi, 1),
      vit: n(row.stat_vit, 1),
      int: n(row.stat_int, 1),
      dex: n(row.stat_dex, 1),
      luk: n(row.stat_luk, 1),
    },
    statPointsUnspent: n(row.stat_points_unspent, 0),
  };
}

/**
 * Advance login streak on first visit each server calendar day (consecutive days).
 * @param {number} userId
 * @returns {Promise<number>} current streak after update
 */
async function touchLoginStreak(userId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let rows;
    let hasShieldCols = true;
    try {
      const [r] = await conn.execute(
        'SELECT login_streak, last_login_streak_date, login_streak_shield_armed_charges FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      rows = r;
    } catch (err) {
      if (err.errno !== 1054 && err.code !== 'ER_BAD_FIELD_ERROR') throw err;
      hasShieldCols = false;
      const [r] = await conn.execute(
        'SELECT login_streak, last_login_streak_date FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      rows = r;
    }
    if (!rows.length) {
      await conn.rollback();
      return 0;
    }
    let shieldCharges = 0;
    if (hasShieldCols) {
      shieldCharges = Math.max(0, Number(rows[0].login_streak_shield_armed_charges) || 0);
    }
    const [drows] = await conn.execute(
      'SELECT CURDATE() AS today, DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS yesterday'
    );
    const today = drows[0].today;
    const yesterday = drows[0].yesterday;
    const last = rows[0].last_login_streak_date;
    let streak = Number(rows[0].login_streak) || 1;

    if (last == null) {
      streak = 1;
    } else if (String(last) === String(today)) {
      await conn.commit();
      return streak;
    } else if (String(last) === String(yesterday)) {
      streak += 1;
    } else {
      const [gapRows] = await conn.execute('SELECT DATEDIFF(?, ?) AS gap', [today, last]);
      const gapDays = Number(gapRows[0]?.gap);
      if (gapDays === 2 && hasShieldCols && shieldCharges > 0) {
        shieldCharges -= 1;
        streak += 1;
        await conn.execute(
          'UPDATE users SET login_streak = ?, last_login_streak_date = ?, login_streak_shield_armed_charges = ? WHERE id = ?',
          [streak, today, shieldCharges, userId]
        );
        await conn.commit();
        return streak;
      }
      streak = 1;
    }

    await conn.execute('UPDATE users SET login_streak = ?, last_login_streak_date = ? WHERE id = ?', [
      streak,
      today,
      userId,
    ]);
    await conn.commit();
    return streak;
  } catch (err) {
    await conn.rollback();
    if (err.errno === 1054 || err.code === 'ER_BAD_FIELD_ERROR') {
      return 0;
    }
    throw err;
  } finally {
    conn.release();
  }
}

const LEADERBOARD_DEFAULT_LIMIT = 100;
const LEADERBOARD_MAX_LIMIT = 200;

/**
 * Top players by active class level, then total EXP on that class (same rules as header / dailies).
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ id: number, displayName: string, level: number, totalExp: number, loginStreak: number, jobName: string }>>}
 */
async function listLeaderboard(opts = {}) {
  let limit = Math.floor(Number(opts.limit) || LEADERBOARD_DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit < 1) limit = LEADERBOARD_DEFAULT_LIMIT;
  limit = Math.min(LEADERBOARD_MAX_LIMIT, limit);
  const pool = getPool();
  // LIMIT cannot use a prepared placeholder reliably on some MySQL/mysqld_stmt setups (ER_WRONG_ARGUMENTS).
  const [rows] = await pool.execute(
    `SELECT u.id,
            u.display_name AS displayName,
            COALESCE(ag.level, u.level) AS level,
            COALESCE(ag.total_exp, u.total_exp) AS totalExp,
            u.login_streak AS loginStreak,
            j.name AS jobName
     FROM users u
     INNER JOIN jobs j ON j.id = u.current_job_id
     LEFT JOIN adventurer_jobs ag ON ag.user_id = u.id AND ag.job_id = u.current_job_id
     ORDER BY level DESC, totalExp DESC, u.id ASC
     LIMIT ${limit}`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    displayName: String(r.displayName || 'Adventurer'),
    level: Math.max(1, Number(r.level) || 1),
    totalExp: Math.max(0, Number(r.totalExp) || 0),
    loginStreak: Math.max(0, Number(r.loginStreak) || 0),
    jobName: String(r.jobName || '—'),
  }));
}

/**
 * Global rank (1-based): count of users strictly ahead on level/EXP tie-break.
 * @param {number} userId
 * @returns {Promise<{ rank: number, level: number, totalExp: number } | null>}
 */
async function getLeaderboardRankForUser(userId) {
  const uid = Number(userId);
  if (!uid) return null;
  const row = await findWithJobById(uid);
  if (!row) return null;
  const level = Math.max(1, Number(row.level) || 1);
  const totalExp = Math.max(0, Number(row.totalExp) || 0);
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS c
     FROM users u
     LEFT JOIN adventurer_jobs ag ON ag.user_id = u.id AND ag.job_id = u.current_job_id
     WHERE (COALESCE(ag.level, u.level) > ?)
        OR (COALESCE(ag.level, u.level) = ? AND COALESCE(ag.total_exp, u.total_exp) > ?)`,
    [level, level, totalExp]
  );
  const ahead = Number(rows[0]?.c) || 0;
  return { rank: ahead + 1, level, totalExp };
}

module.exports = {
  findByEmail,
  findByLogin,
  findWithJobById,
  createUser,
  getCurrentJobId,
  updateCurrentJob,
  updateMusicEnabled,
  updateLevel,
  allocateStatPoint,
  statSheetFromUserRow,
  touchLoginStreak,
  listLeaderboard,
  getLeaderboardRankForUser,
};
