const { getPool } = require('../config/database');
const { grantExpToActiveJob } = require('./progressionGrant');
const {
  TRAIN_EXP_PER_SESSION,
  TRAIN_DAILY_MAX_SESSIONS,
  TRAIN_FOCUS_CHARGES_PER_SESSION,
  TRAIN_FOCUS_MAX_CHARGES,
} = require('../config/constants');

function isMissingTableOrColumn(err) {
  return !!err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1146 || err.errno === 1054);
}

async function getTrainingStatus(userId) {
  const pool = getPool();
  try {
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS c
       FROM user_train_sessions
       WHERE user_id = ? AND session_date = CURDATE()`,
      [userId]
    );
    const [userRows] = await pool.execute(
      `SELECT train_focus_charges,
              DATE_FORMAT(train_focus_expires_date, '%Y-%m-%d') AS train_focus_expires_date,
              DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today_str
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    const r = userRows[0] || {};
    const expiresToday = String(r.train_focus_expires_date || '') === String(r.today_str || '');
    const charges = expiresToday ? Math.max(0, Number(r.train_focus_charges) || 0) : 0;
    return {
      todayCount: Number(countRows[0]?.c) || 0,
      dailyMax: TRAIN_DAILY_MAX_SESSIONS,
      focusCharges: charges,
    };
  } catch (err) {
    if (isMissingTableOrColumn(err)) {
      return { todayCount: 0, dailyMax: TRAIN_DAILY_MAX_SESSIONS, focusCharges: 0, migrationNeeded: true };
    }
    throw err;
  }
}

async function completeTrainingSession(userId, routineId = null) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [countRows] = await conn.execute(
      `SELECT COUNT(*) AS c
       FROM user_train_sessions
       WHERE user_id = ? AND session_date = CURDATE()
       FOR UPDATE`,
      [userId]
    );
    const todayCount = Number(countRows[0]?.c) || 0;
    if (todayCount >= TRAIN_DAILY_MAX_SESSIONS) {
      throw new Error('train_daily_cap');
    }

    await conn.execute(
      `INSERT INTO user_train_sessions (user_id, routine_id, session_date, reward_exp, focus_bonus_pct)
       VALUES (?, ?, CURDATE(), ?, ?)`,
      [userId, routineId, TRAIN_EXP_PER_SESSION, 5]
    );

    const expMeta = await grantExpToActiveJob(conn, userId, TRAIN_EXP_PER_SESSION);

    const [uRows] = await conn.execute(
      `SELECT train_focus_charges, train_focus_expires_date
       FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );
    if (!uRows.length) throw new Error('user_missing');
    const prevCharges = Math.max(0, Number(uRows[0].train_focus_charges) || 0);
    const nextCharges = Math.min(TRAIN_FOCUS_MAX_CHARGES, prevCharges + TRAIN_FOCUS_CHARGES_PER_SESSION);
    await conn.execute(
      `UPDATE users
       SET train_focus_charges = ?, train_focus_expires_date = CURDATE()
       WHERE id = ?`,
      [nextCharges, userId]
    );

    await conn.commit();
    return {
      ...expMeta,
      gained: TRAIN_EXP_PER_SESSION,
      todayCount: todayCount + 1,
      dailyMax: TRAIN_DAILY_MAX_SESSIONS,
      focusCharges: nextCharges,
    };
  } catch (err) {
    await conn.rollback();
    if (isMissingTableOrColumn(err)) throw new Error('train_migration_needed');
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  getTrainingStatus,
  completeTrainingSession,
};
