const { TRAIN_FOCUS_MAX_CHARGES } = require('../config/constants');

function isMissingColumn(err) {
  return err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054);
}

function rewardProfile(source, cadence, flags = {}) {
  const src = String(source || '').toLowerCase();
  const cad = String(cadence || '').toLowerCase();
  const isBonus = !!flags.isBonus;
  const isBoss = !!flags.isBoss;

  // Daily core = EXP-only by default (no item roll).
  if (src === 'daily' && !isBonus) {
    return null;
  }
  // Daily bonus can drop items more often.
  if (src === 'daily' && isBonus) {
    return { shieldChance: 0.05, focusChance: 0.35 };
  }

  // Weekly boss has guaranteed useful drop.
  if (src === 'weekly' && isBoss) {
    return { shieldChance: 0.55, focusChance: 0.45 };
  }
  if (src === 'weekly') {
    return { shieldChance: 0.12, focusChance: 0.28 };
  }
  if (src === 'quest') {
    if (cad === 'weekly') return { shieldChance: 0.16, focusChance: 0.3 };
    return { shieldChance: 0.08, focusChance: 0.22 };
  }
  return null;
}

/**
 * Grant useful Vault consumables on clear events.
 * Returns null when no drop or when vault columns don't exist.
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {number} userId
 * @param {{ source: 'daily'|'weekly'|'quest', cadence?: string }} opts
 */
async function grantCompletionVaultReward(conn, userId, opts = {}) {
  const prof = rewardProfile(opts.source, opts.cadence, opts);
  if (!prof) return null;
  const roll = Math.random();
  const wantsShield = roll < prof.shieldChance;
  const wantsFocus = !wantsShield && roll < prof.shieldChance + prof.focusChance;
  if (!wantsShield && !wantsFocus) return null;

  let row;
  try {
    const [rows] = await conn.execute(
      `SELECT login_streak_shield_charges AS shieldCharges,
              train_focus_charges AS focusCharges,
              DATE_FORMAT(train_focus_expires_date, '%Y-%m-%d') AS focusExpires,
              DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today
       FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );
    row = rows[0];
  } catch (err) {
    if (isMissingColumn(err)) return null;
    throw err;
  }
  if (!row) return null;

  if (wantsShield) {
    await conn.execute(
      `UPDATE users
       SET login_streak_shield_charges = LEAST(255, login_streak_shield_charges + 1)
       WHERE id = ?`,
      [userId]
    );
    return {
      item: 'streak_shield',
      amount: 1,
      title: 'Vault drop: Streak Shield',
      message: '+1 Streak Shield added to your Vault.',
    };
  }

  if (wantsFocus) {
    const today = String(row.today || '');
    const expires = row.focusExpires == null ? '' : String(row.focusExpires);
    const focusToday = expires === today;
    const charges = focusToday ? Math.max(0, Number(row.focusCharges) || 0) : 0;
    if (charges >= TRAIN_FOCUS_MAX_CHARGES) return null;
    const next = Math.min(TRAIN_FOCUS_MAX_CHARGES, charges + 1);
    await conn.execute(
      `UPDATE users
       SET train_focus_charges = ?,
           train_focus_expires_date = CURDATE()
       WHERE id = ?`,
      [next, userId]
    );
    return {
      item: 'focus_charge',
      amount: 1,
      title: 'Vault drop: Focus Charge',
      message: '+1 Focus Charge added for today.',
    };
  }

  return null;
}

module.exports = { grantCompletionVaultReward };

