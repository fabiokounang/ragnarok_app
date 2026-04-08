const { getPool } = require('../config/database');
const dailyTaskModel = require('./dailyTaskModel');
const { addAstraLedger } = require('./questBoardModel');
const {
  ASTRA_SHOP_DAILY_REROLL_COST,
  ASTRA_SHOP_STREAK_SHIELD_COST,
  ASTRA_SHOP_FOCUS_SIP_COST,
  TRAIN_FOCUS_MAX_CHARGES,
} = require('../config/constants');

function isMissingColumn(err) {
  return err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054);
}

/**
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} userId
 */
async function loadShopRow(conn, userId) {
  try {
    const [rows] = await conn.execute(
      `SELECT astra_balance AS astraBalance,
              login_streak_shield_charges AS shieldCharges,
              login_streak_shield_armed_charges AS shieldArmedCharges,
              vault_daily_reroll_charges AS rerollCharges,
              vault_focus_sip_charges AS focusVaultCharges,
              astra_streak_shield_week_monday AS shieldWeekMonday,
              astra_daily_reroll_date AS dailyRerollDate,
              astra_focus_sip_date AS focusSipDate,
              train_focus_charges AS trainFocusCharges,
              DATE_FORMAT(train_focus_expires_date, '%Y-%m-%d') AS trainFocusExpires,
              DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today,
              DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), '%Y-%m-%d') AS weekMonday
       FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );
    return rows[0] || null;
  } catch (err) {
    if (isMissingColumn(err)) return null;
    throw err;
  }
}

/**
 * @param {number} userId
 * @param {number} jobId
 */
async function getVaultShopSnapshot(userId, jobId) {
  const pool = getPool();
  let row;
  try {
    const [rows] = await pool.execute(
      `SELECT astra_balance AS astraBalance,
              login_streak_shield_charges AS shieldCharges,
              login_streak_shield_armed_charges AS shieldArmedCharges,
              vault_daily_reroll_charges AS rerollCharges,
              vault_focus_sip_charges AS focusVaultCharges,
              astra_streak_shield_week_monday AS shieldWeekMonday,
              astra_daily_reroll_date AS dailyRerollDate,
              astra_focus_sip_date AS focusSipDate,
              train_focus_charges AS trainFocusCharges,
              DATE_FORMAT(train_focus_expires_date, '%Y-%m-%d') AS trainFocusExpires,
              DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today,
              DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), '%Y-%m-%d') AS weekMonday
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    row = rows[0];
  } catch (err) {
    if (isMissingColumn(err)) {
  return {
    migrationNeeded: true,
    astraBalance: 0,
    shieldCharges: 0,
    shieldArmedCharges: 0,
    rerollCharges: 0,
    focusVaultCharges: 0,
    canDailyReroll: false,
    canFocusSip: false,
    canUseReroll: false,
    canUseFocus: false,
    canUseShield: false,
    focusChargesDisplay: 0,
    focusCap: TRAIN_FOCUS_MAX_CHARGES,
    dailyFlow: 'unknown',
    prices: {
          reroll: ASTRA_SHOP_DAILY_REROLL_COST,
          shield: ASTRA_SHOP_STREAK_SHIELD_COST,
          focusSip: ASTRA_SHOP_FOCUS_SIP_COST,
        },
      };
    }
    throw err;
  }

  if (!row) {
    return {
      migrationNeeded: false,
      astraBalance: 0,
      shieldCharges: 0,
      shieldArmedCharges: 0,
      rerollCharges: 0,
      focusVaultCharges: 0,
      canDailyReroll: false,
      canFocusSip: false,
      canUseReroll: false,
      canUseFocus: false,
      canUseShield: false,
      focusChargesDisplay: 0,
      focusCap: TRAIN_FOCUS_MAX_CHARGES,
      dailyFlow: 'unknown',
      prices: {
        reroll: ASTRA_SHOP_DAILY_REROLL_COST,
        shield: ASTRA_SHOP_STREAK_SHIELD_COST,
        focusSip: ASTRA_SHOP_FOCUS_SIP_COST,
      },
    };
  }

  const today = String(row.today || '');
  const weekMonday = String(row.weekMonday || '');
  const shieldWeek = row.shieldWeekMonday == null ? '' : String(row.shieldWeekMonday);
  const expires = row.trainFocusExpires == null ? '' : String(row.trainFocusExpires);
  const focusExpiresToday = expires === today;
  const rawCharges = focusExpiresToday ? Math.max(0, Number(row.trainFocusCharges) || 0) : 0;

  const dailyFlow = await dailyTaskModel.ensureTodayFlow(userId, jobId);

  const bal = Math.max(0, Number(row.astraBalance) || 0);
  const rerollUsedToday = row.dailyRerollDate != null && String(row.dailyRerollDate) === today;
  const maxShieldQty = Math.max(0, Math.min(99, Math.floor(bal / ASTRA_SHOP_STREAK_SHIELD_COST)));
  const canDailyReroll = bal >= ASTRA_SHOP_DAILY_REROLL_COST;
  const canFocusSip = bal >= ASTRA_SHOP_FOCUS_SIP_COST;
  const canUseReroll = !rerollUsedToday && Math.max(0, Number(row.rerollCharges) || 0) > 0;
  const canUseFocus =
    Math.max(0, Number(row.focusVaultCharges) || 0) > 0 && rawCharges < TRAIN_FOCUS_MAX_CHARGES;
  const canUseShield = Math.max(0, Number(row.shieldCharges) || 0) > 0;

  return {
    migrationNeeded: false,
    astraBalance: bal,
    shieldCharges: Math.max(0, Number(row.shieldCharges) || 0),
    shieldArmedCharges: Math.max(0, Number(row.shieldArmedCharges) || 0),
    rerollCharges: Math.max(0, Number(row.rerollCharges) || 0),
    focusVaultCharges: Math.max(0, Number(row.focusVaultCharges) || 0),
    canBuyShield: maxShieldQty > 0,
    maxShieldQty,
    canDailyReroll,
    canFocusSip,
    canUseReroll,
    canUseFocus,
    canUseShield,
    focusChargesDisplay: rawCharges,
    focusCap: TRAIN_FOCUS_MAX_CHARGES,
    dailyFlow,
    prices: {
      reroll: ASTRA_SHOP_DAILY_REROLL_COST,
      shield: ASTRA_SHOP_STREAK_SHIELD_COST,
      focusSip: ASTRA_SHOP_FOCUS_SIP_COST,
    },
  };
}

/**
 * @param {number} userId
 * @param {number} jobId
 */
async function purchaseDailyReroll(userId, jobId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const shop = await loadShopRow(conn, userId);
    if (!shop) {
      await conn.rollback();
      return { ok: false, error: 'migration_needed' };
    }
    await addAstraLedger(conn, userId, -ASTRA_SHOP_DAILY_REROLL_COST, 'astra_shop_reroll', null);
    await conn.execute(
      `UPDATE users
       SET vault_daily_reroll_charges = LEAST(999, vault_daily_reroll_charges + 1)
       WHERE id = ?`,
      [userId]
    );
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    if (String(err && err.message) === 'insufficient_astra') {
      return { ok: false, error: 'insufficient_astra' };
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * @param {number} userId
 */
async function purchaseStreakShield(userId, qtyRaw = 1) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const shop = await loadShopRow(conn, userId);
    if (!shop) {
      await conn.rollback();
      return { ok: false, error: 'migration_needed' };
    }
    const qty = Math.max(1, Math.min(99, Math.floor(Number(qtyRaw) || 1)));
    const totalCost = ASTRA_SHOP_STREAK_SHIELD_COST * qty;
    await addAstraLedger(conn, userId, -totalCost, 'astra_shop_shield', null);
    await conn.execute(
      `UPDATE users
       SET login_streak_shield_charges = LEAST(255, login_streak_shield_charges + ?)
       WHERE id = ?`,
      [qty, userId]
    );
    await conn.commit();
    return { ok: true, qty };
  } catch (err) {
    await conn.rollback();
    if (String(err && err.message) === 'insufficient_astra') {
      return { ok: false, error: 'insufficient_astra' };
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * @param {number} userId
 * @param {number} [limit]
 */
async function listVaultActivity(userId, limit = 12) {
  const pool = getPool();
  const lim = Math.max(1, Math.min(50, Math.floor(Number(limit) || 12)));
  const [rows] = await pool.execute(
    `SELECT amount_delta AS amountDelta, reason_code AS reasonCode, created_at AS createdAt
     FROM user_wallet_ledger
     WHERE user_id = ? AND reason_code IN ('astra_shop_reroll', 'astra_shop_shield', 'astra_shop_focus_sip')
     ORDER BY id DESC
     LIMIT ${lim}`,
    [userId]
  );
  return rows;
}

/**
 * @param {number} userId
 */
async function purchaseFocusSip(userId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const shop = await loadShopRow(conn, userId);
    if (!shop) {
      await conn.rollback();
      return { ok: false, error: 'migration_needed' };
    }
    await addAstraLedger(conn, userId, -ASTRA_SHOP_FOCUS_SIP_COST, 'astra_shop_focus_sip', null);
    await conn.execute(
      `UPDATE users
       SET vault_focus_sip_charges = LEAST(999, vault_focus_sip_charges + 1)
       WHERE id = ?`,
      [userId]
    );
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    if (String(err && err.message) === 'insufficient_astra') {
      return { ok: false, error: 'insufficient_astra' };
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function useDailyReroll(userId, jobId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const shop = await loadShopRow(conn, userId);
    if (!shop) {
      await conn.rollback();
      return { ok: false, error: 'migration_needed' };
    }
    const today = String(shop.today || '');
    if (shop.dailyRerollDate != null && String(shop.dailyRerollDate) === today) {
      await conn.rollback();
      return { ok: false, error: 'reroll_used_today' };
    }
    const charges = Math.max(0, Number(shop.rerollCharges) || 0);
    if (charges <= 0) {
      await conn.rollback();
      return { ok: false, error: 'no_reroll_token' };
    }
    const rr = await dailyTaskModel.applyPaidDailyReroll(conn, userId, jobId);
    if (!rr.ok) {
      await conn.rollback();
      return { ok: false, error: rr.error };
    }
    await conn.execute(
      `UPDATE users
       SET vault_daily_reroll_charges = GREATEST(0, vault_daily_reroll_charges - 1),
           astra_daily_reroll_date = CURDATE()
       WHERE id = ?`,
      [userId]
    );
    await conn.commit();
    return { ok: true, mode: rr.mode };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function useStreakShield(userId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const shop = await loadShopRow(conn, userId);
    if (!shop) {
      await conn.rollback();
      return { ok: false, error: 'migration_needed' };
    }
    const charges = Math.max(0, Number(shop.shieldCharges) || 0);
    if (charges <= 0) {
      await conn.rollback();
      return { ok: false, error: 'no_shield_token' };
    }
    await conn.execute(
      `UPDATE users
       SET login_streak_shield_charges = GREATEST(0, login_streak_shield_charges - 1),
           login_streak_shield_armed_charges = LEAST(999, login_streak_shield_armed_charges + 1)
       WHERE id = ?`,
      [userId]
    );
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function useFocusSip(userId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const shop = await loadShopRow(conn, userId);
    if (!shop) {
      await conn.rollback();
      return { ok: false, error: 'migration_needed' };
    }
    const charges = Math.max(0, Number(shop.focusVaultCharges) || 0);
    if (charges <= 0) {
      await conn.rollback();
      return { ok: false, error: 'no_focus_token' };
    }
    const today = String(shop.today || '');
    if (shop.focusSipDate != null && String(shop.focusSipDate) === today) {
      await conn.rollback();
      return { ok: false, error: 'sip_used_today' };
    }
    const expires = shop.trainFocusExpires == null ? '' : String(shop.trainFocusExpires);
    const focusExpiresToday = expires === today;
    const rawCharges = focusExpiresToday ? Math.max(0, Number(shop.trainFocusCharges) || 0) : 0;
    if (rawCharges >= TRAIN_FOCUS_MAX_CHARGES) {
      await conn.rollback();
      return { ok: false, error: 'focus_full' };
    }
    const nextCharges = Math.min(TRAIN_FOCUS_MAX_CHARGES, rawCharges + 1);
    await conn.execute(
      `UPDATE users
       SET vault_focus_sip_charges = GREATEST(0, vault_focus_sip_charges - 1),
           train_focus_charges = ?,
           train_focus_expires_date = CURDATE(),
           astra_focus_sip_date = CURDATE()
       WHERE id = ?`,
      [nextCharges, userId]
    );
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  getVaultShopSnapshot,
  listVaultActivity,
  purchaseDailyReroll,
  purchaseStreakShield,
  purchaseFocusSip,
  useDailyReroll,
  useStreakShield,
  useFocusSip,
};
