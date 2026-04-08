const { getPool } = require('../config/database');
const { grantExpToActiveJob } = require('./progressionGrant');
const { grantCompletionVaultReward } = require('./vaultRewardModel');
const {
  QUEST_BOARD_POST_COST_ASTRA,
  QUEST_BOARD_ISSUER_RENOWN_PER_APPROVAL,
  QUEST_BOARD_MAX_ACTIVE_PER_USER,
  QUEST_BOARD_REWARD_EXP_MIN,
  QUEST_BOARD_REWARD_EXP_MAX,
  QUEST_BOARD_REWARD_ASTRA_MIN,
  QUEST_BOARD_REWARD_ASTRA_MAX,
  QUEST_BOARD_ISSUER_REWARD_ASTRA_MIN,
  QUEST_BOARD_ISSUER_REWARD_ASTRA_MAX,
  questPostRewardCapsForLevel,
  QUEST_BOARD_MAX_ACCEPTS_PER_DAY,
  QUEST_BOARD_MAX_PAIR_ACCEPTS_PER_DAY,
  QUEST_BOARD_MAX_ACTIVE_ACCEPTS,
  QUEST_BOARD_EXPIRE_REFUND_ASTRA,
} = require('../config/constants');

const OPEN_STATUSES = ['open', 'accepted', 'submitted'];

function isMissingTableErr(e) {
  return !!e && (e.errno === 1146 || e.code === 'ER_NO_SUCH_TABLE');
}

function clampInt(raw, min, max) {
  const n = Math.floor(Number(raw) || 0);
  return Math.min(max, Math.max(min, n));
}

function sanitizeTitle(raw) {
  return String(raw || '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 120);
}

function sanitizeDescription(raw) {
  return String(raw || '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 1000);
}

function sanitizeTrack(raw) {
  const k = String(raw || '')
    .trim()
    .toUpperCase();
  return ['STR', 'AGI', 'VIT', 'INT', 'DEX', 'LUK'].includes(k) ? k : 'STR';
}

function sanitizeCadence(raw) {
  const k = String(raw || '')
    .trim()
    .toLowerCase();
  return ['daily', 'weekly'].includes(k) ? k : 'daily';
}

function sanitizeMinLevel(raw) {
  const n = Math.floor(Number(raw) || 1);
  return Math.max(1, Math.min(99, n));
}

function sanitizeMinTier(raw) {
  const n = Math.floor(Number(raw) || 0);
  return Math.max(0, Math.min(3, n));
}

function sanitizeEmail(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  if (v.length > 190) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return '';
  return v;
}

function sanitizeUsername(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (!v) return '';
  if (v.length < 3 || v.length > 32) return '';
  return v;
}

function parseRecipient(raw) {
  const value = String(raw || '').trim();
  if (!value) return { kind: '', value: '' };
  if (value.includes('@')) {
    const email = sanitizeEmail(value);
    return { kind: email ? 'email' : '', value: email };
  }
  const username = sanitizeUsername(value);
  return { kind: username ? 'username' : '', value: username };
}

async function addAstraLedger(conn, userId, delta, reason, questId = null) {
  const amount = Math.floor(Number(delta) || 0);
  if (amount === 0) return;
  const [rows] = await conn.execute('SELECT astra_balance FROM users WHERE id = ? FOR UPDATE', [userId]);
  if (!rows.length) throw new Error('user_missing');
  const current = Number(rows[0].astra_balance) || 0;
  const next = current + amount;
  if (next < 0) throw new Error('insufficient_astra');
  await conn.execute('UPDATE users SET astra_balance = ? WHERE id = ?', [next, userId]);
  await conn.execute(
    `INSERT INTO user_wallet_ledger (user_id, amount_delta, reason_code, ref_quest_id)
     VALUES (?, ?, ?, ?)`,
    [userId, amount, reason, questId]
  );
}

async function appendQuestEvent(conn, questId, actorUserId, eventType, note = null) {
  await conn.execute(
    `INSERT INTO board_quest_events (quest_id, actor_user_id, event_type, note)
     VALUES (?, ?, ?, ?)`,
    [questId, actorUserId == null ? null : actorUserId, eventType, note]
  );
}

async function expireOpenQuestsAndRefund(conn) {
  const [rows] = await conn.execute(
    `SELECT id, issuer_kind, issuer_user_id
     FROM board_quests
     WHERE status = 'open'
       AND expires_at IS NOT NULL
       AND expires_at < UTC_TIMESTAMP()
     FOR UPDATE`
  );
  if (!rows.length) return 0;
  for (const q of rows) {
    const questId = Number(q.id);
    await conn.execute(
      `UPDATE board_quests
       SET status = 'expired', resolved_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [questId]
    );
    await appendQuestEvent(conn, questId, null, 'expire', null);
    if (q.issuer_kind === 'user' && Number(q.issuer_user_id) > 0 && QUEST_BOARD_EXPIRE_REFUND_ASTRA > 0) {
      await addAstraLedger(
        conn,
        Number(q.issuer_user_id),
        QUEST_BOARD_EXPIRE_REFUND_ASTRA,
        'admin_adjust',
        questId
      );
    }
  }
  return rows.length;
}

async function getBoardSnapshot(userId, limit = 12) {
  const pool = getPool();
  const lim = Math.max(1, Math.min(40, Math.floor(Number(limit) || 12)));
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await expireOpenQuestsAndRefund(conn);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const [openRows] = await pool.execute(
      `SELECT q.id, q.issuer_kind, q.issuer_user_id, q.issuer_name, q.title, q.description, q.track_tag, q.cadence,
              q.min_receiver_level, q.min_receiver_job_tier,
              q.reward_exp, q.reward_astra, q.status, q.expires_at, q.created_at,
              CASE
                WHEN q.issuer_kind = 'user' AND q.issuer_user_id = ? THEN 1
                ELSE 0
              END AS is_self_issuer
       FROM board_quests q
       WHERE q.status = 'open'
         AND (q.receiver_user_id IS NULL OR q.receiver_user_id = ?)
       ORDER BY q.created_at DESC
       LIMIT ${lim}`,
      [userId, userId]
    );
    const [mineActRows] = await pool.execute(
      `SELECT q.id, q.status, q.title, q.track_tag, q.cadence, q.min_receiver_level, q.min_receiver_job_tier,
              q.reward_exp, q.reward_astra, q.issuer_name, q.issuer_kind, q.expires_at, q.accepted_at
       FROM board_quests q
       WHERE q.receiver_user_id = ? AND q.status IN ('accepted', 'submitted')
       ORDER BY q.updated_at DESC
       LIMIT ${lim}`,
      [userId]
    );
    const [mineFinishedRows] = await pool.execute(
      `SELECT q.id, q.status, q.title, q.track_tag, q.cadence, q.min_receiver_level, q.min_receiver_job_tier,
              q.reward_exp, q.reward_astra, q.issuer_name, q.expires_at, q.resolved_at
       FROM board_quests q
       WHERE q.receiver_user_id = ?
         AND q.status IN ('approved', 'rejected', 'expired', 'cancelled')
       ORDER BY q.resolved_at DESC, q.updated_at DESC
       LIMIT ${lim}`,
      [userId]
    );
    const [mineReviewRows] = await pool.execute(
      `SELECT q.id, q.status, q.title, q.track_tag, q.cadence, q.reward_exp, q.reward_astra,
              u.display_name AS receiver_name
       FROM board_quests q
       INNER JOIN users u ON u.id = q.receiver_user_id
       WHERE q.issuer_kind = 'user' AND q.issuer_user_id = ? AND q.status = 'submitted'
       ORDER BY q.submitted_at DESC
       LIMIT ${lim}`,
      [userId]
    );
    return {
      open: openRows,
      myActive: mineActRows,
      myFinished: mineFinishedRows,
      myToReview: mineReviewRows,
    };
  } catch (e) {
    if (isMissingTableErr(e)) return { open: [], myActive: [], myFinished: [], myToReview: [] };
    throw e;
  }
}

async function createUserQuest(issuerUserId, input) {
  const pool = getPool();
  const title = sanitizeTitle(input.title);
  const titleNorm = title.toLowerCase().replace(/\s+/g, ' ').trim();
  const description = sanitizeDescription(input.description);
  if (title.length < 6) throw new Error('title_too_short');
  if (description.length < 8) throw new Error('description_too_short');
  const rewardExpRaw = Number(input.rewardExp);
  const rewardAstraRaw = Number(input.rewardAstra);
  const issuerRewardAstraRaw = Number(input.issuerRewardAstra);
  const trackTag = sanitizeTrack(input.trackTag);
  const cadence = sanitizeCadence(input.cadence);
  const minReceiverLevel = sanitizeMinLevel(input.minLevel);
  const minReceiverJobTier = sanitizeMinTier(input.minJobTier);
  const expiresInDays = clampInt(input.expiresInDays, 1, 14);
  const recipientRaw = input.recipientLogin || input.recipientEmail;
  const recipient = parseRecipient(recipientRaw);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [openRows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM board_quests
       WHERE issuer_kind = 'user' AND issuer_user_id = ? AND status IN ('open','accepted','submitted')`,
      [issuerUserId]
    );
    if ((Number(openRows[0].c) || 0) >= QUEST_BOARD_MAX_ACTIVE_PER_USER) {
      throw new Error('issuer_active_limit');
    }
    const [dupRows] = await conn.execute(
      `SELECT COUNT(*) AS c
       FROM board_quests
       WHERE issuer_kind = 'user'
         AND issuer_user_id = ?
         AND status IN ('open','accepted','submitted')
         AND LOWER(TRIM(title)) = ?`,
      [issuerUserId, titleNorm]
    );
    if ((Number(dupRows[0].c) || 0) > 0) throw new Error('duplicate_title');

    const [uRows] = await conn.execute(
      `SELECT u.display_name,
              COALESCE(ag.level, u.level) AS active_level
       FROM users u
       LEFT JOIN adventurer_jobs ag ON ag.user_id = u.id AND ag.job_id = u.current_job_id
       WHERE u.id = ?
       FOR UPDATE`,
      [issuerUserId]
    );
    if (!uRows.length) throw new Error('user_missing');
    const issuerName = String(uRows[0].display_name || 'Adventurer');
    const caps = questPostRewardCapsForLevel(Number(uRows[0].active_level) || 1);
    if (Number.isFinite(rewardExpRaw) && rewardExpRaw > caps.expMax) throw new Error('reward_exp_cap');
    if (Number.isFinite(rewardAstraRaw) && rewardAstraRaw > caps.astraMax) throw new Error('reward_astra_cap');
    if (Number.isFinite(issuerRewardAstraRaw) && issuerRewardAstraRaw > caps.issuerAstraMax) {
      throw new Error('issuer_reward_astra_cap');
    }
    const rewardExp = clampInt(input.rewardExp, caps.expMin, caps.expMax);
    const rewardAstra = clampInt(input.rewardAstra, caps.astraMin, caps.astraMax);
    const issuerRewardAstra = clampInt(input.issuerRewardAstra, caps.issuerAstraMin, caps.issuerAstraMax);
    let targetReceiverId = null;
    if (recipient.kind) {
      const lookupSql =
        recipient.kind === 'email'
          ? 'SELECT id FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1'
          : 'SELECT id FROM users WHERE LOWER(TRIM(username)) = ? LIMIT 1';
      const [rcvRows] = await conn.execute(lookupSql, [recipient.value]);
      if (!rcvRows.length) throw new Error('receiver_not_found');
      targetReceiverId = Number(rcvRows[0].id) || null;
      if (!targetReceiverId) throw new Error('receiver_not_found');
      if (targetReceiverId === issuerUserId) throw new Error('self_target');
    }

    await addAstraLedger(conn, issuerUserId, -QUEST_BOARD_POST_COST_ASTRA, 'quest_post_cost', null);

    const [r] = await conn.execute(
      `INSERT INTO board_quests (
         issuer_kind, issuer_user_id, issuer_name, receiver_user_id, title, description, track_tag, cadence,
         min_receiver_level, min_receiver_job_tier,
         reward_exp, reward_astra, issuer_reward_astra, status, expires_at
       ) VALUES ('user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
      [
        issuerUserId,
        issuerName,
        targetReceiverId,
        title,
        description,
        trackTag,
        cadence,
        minReceiverLevel,
        minReceiverJobTier,
        rewardExp,
        rewardAstra,
        issuerRewardAstra,
        expiresInDays,
      ]
    );
    const questId = Number(r.insertId);
    await appendQuestEvent(conn, questId, issuerUserId, 'create', null);
    await conn.commit();
    return { id: questId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function acceptQuest(receiverUserId, questId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await expireOpenQuestsAndRefund(conn);
    const [activeRows] = await conn.execute(
      `SELECT COUNT(*) AS c
       FROM board_quests
       WHERE receiver_user_id = ?
         AND status IN ('accepted','submitted')`,
      [receiverUserId]
    );
    if ((Number(activeRows[0].c) || 0) >= QUEST_BOARD_MAX_ACTIVE_ACCEPTS) {
      throw new Error('receiver_active_cap');
    }
    const [myDailyRows] = await conn.execute(
      `SELECT COUNT(*) AS c
       FROM board_quests
       WHERE receiver_user_id = ?
         AND accepted_at IS NOT NULL
         AND DATE(accepted_at) = CURDATE()`,
      [receiverUserId]
    );
    if ((Number(myDailyRows[0].c) || 0) >= QUEST_BOARD_MAX_ACCEPTS_PER_DAY) {
      throw new Error('receiver_accept_daily_cap');
    }
    const [rows] = await conn.execute(
      `SELECT id, issuer_kind, issuer_user_id, receiver_user_id, status, expires_at,
              min_receiver_level, min_receiver_job_tier
       FROM board_quests WHERE id = ? FOR UPDATE`,
      [questId]
    );
    if (!rows.length) throw new Error('quest_missing');
    const q = rows[0];
    if (String(q.status) !== 'open') throw new Error('quest_not_open');
    if (q.issuer_kind === 'user' && Number(q.issuer_user_id) === receiverUserId) throw new Error('self_accept');
    const [meRows] = await conn.execute(
      `SELECT COALESCE(ag.level, u.level) AS active_level, j.tier AS active_tier
       FROM users u
       INNER JOIN jobs j ON j.id = u.current_job_id
       LEFT JOIN adventurer_jobs ag ON ag.user_id = u.id AND ag.job_id = u.current_job_id
       WHERE u.id = ?
       LIMIT 1`,
      [receiverUserId]
    );
    if (!meRows.length) throw new Error('user_missing');
    const myLevel = Math.max(1, Number(meRows[0].active_level) || 1);
    const myTier = Math.max(0, Number(meRows[0].active_tier) || 0);
    const reqLevel = Math.max(1, Number(q.min_receiver_level) || 1);
    const reqTier = Math.max(0, Number(q.min_receiver_job_tier) || 0);
    if (myLevel < reqLevel) throw new Error('req_level');
    if (myTier < reqTier) throw new Error('req_tier');
    if (q.receiver_user_id != null && Number(q.receiver_user_id) !== receiverUserId) {
      throw new Error('not_target_receiver');
    }
    if (q.expires_at && new Date(q.expires_at).getTime() < Date.now()) throw new Error('quest_expired');
    if (q.issuer_kind === 'user' && Number(q.issuer_user_id) > 0) {
      const [pairRows] = await conn.execute(
        `SELECT COUNT(*) AS c
         FROM board_quests
         WHERE issuer_kind = 'user'
           AND issuer_user_id = ?
           AND receiver_user_id = ?
           AND accepted_at IS NOT NULL
           AND DATE(accepted_at) = CURDATE()`,
        [Number(q.issuer_user_id), receiverUserId]
      );
      if ((Number(pairRows[0].c) || 0) >= QUEST_BOARD_MAX_PAIR_ACCEPTS_PER_DAY) {
        throw new Error('pair_daily_cap');
      }
    }
    await conn.execute(
      `UPDATE board_quests
       SET receiver_user_id = ?, status = 'accepted', accepted_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [receiverUserId, questId]
    );
    await appendQuestEvent(conn, questId, receiverUserId, 'accept', null);
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function submitQuest(receiverUserId, questId, note) {
  const pool = getPool();
  const cleanNote = sanitizeDescription(note || '');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT id, receiver_user_id, status, issuer_kind, issuer_user_id, cadence, reward_exp, reward_astra, issuer_reward_astra
       FROM board_quests WHERE id = ? FOR UPDATE`,
      [questId]
    );
    if (!rows.length) throw new Error('quest_missing');
    const q = rows[0];
    if (Number(q.receiver_user_id) !== receiverUserId) throw new Error('not_receiver');
    if (String(q.status) !== 'accepted') throw new Error('quest_not_accepted');
    await conn.execute(
      `UPDATE board_quests
       SET status = 'submitted', submitted_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [questId]
    );
    await appendQuestEvent(conn, questId, receiverUserId, 'submit', cleanNote || null);

    const isSystemIssuer = String(q.issuer_kind) === 'system';
    let grant = null;
    let rewardAstra = 0;
    let vaultReward = null;
    if (isSystemIssuer) {
      grant = await grantExpToActiveJob(conn, Number(q.receiver_user_id), Number(q.reward_exp) || 0);
      vaultReward = await grantCompletionVaultReward(conn, Number(q.receiver_user_id), {
        source: 'quest',
        cadence: String(q.cadence || 'daily'),
      });
      rewardAstra = Number(q.reward_astra) || 0;
      await addAstraLedger(
        conn,
        Number(q.receiver_user_id),
        rewardAstra,
        'quest_reward_receiver',
        questId
      );
      await conn.execute(
        `UPDATE board_quests
         SET status = 'approved', resolved_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [questId]
      );
      await appendQuestEvent(conn, questId, null, 'approve', null);
    }

    await conn.commit();
    return {
      ok: true,
      autoApproved: isSystemIssuer,
      grant,
      rewardAstra: isSystemIssuer ? rewardAstra : 0,
      vaultReward,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function reviewSubmittedQuest(issuerUserId, questId, approve, note) {
  const pool = getPool();
  const cleanNote = sanitizeDescription(note || '');
  const isApprove = !!approve;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT id, issuer_kind, issuer_user_id, receiver_user_id, cadence, reward_exp, reward_astra, issuer_reward_astra, status
       FROM board_quests WHERE id = ? FOR UPDATE`,
      [questId]
    );
    if (!rows.length) throw new Error('quest_missing');
    const q = rows[0];
    if (q.issuer_kind !== 'user' || Number(q.issuer_user_id) !== issuerUserId) throw new Error('not_issuer');
    if (String(q.status) !== 'submitted') throw new Error('quest_not_submitted');

    let vaultReward = null;
    if (isApprove) {
      await grantExpToActiveJob(conn, Number(q.receiver_user_id), Number(q.reward_exp) || 0);
      vaultReward = await grantCompletionVaultReward(conn, Number(q.receiver_user_id), {
        source: 'quest',
        cadence: String(q.cadence || 'daily'),
      });
      await addAstraLedger(
        conn,
        Number(q.receiver_user_id),
        Number(q.reward_astra) || 0,
        'quest_reward_receiver',
        questId
      );
      await addAstraLedger(
        conn,
        Number(q.issuer_user_id),
        Number(q.issuer_reward_astra) || 0,
        'quest_reward_issuer',
        questId
      );
      await conn.execute(
        'UPDATE users SET renown_points = renown_points + ? WHERE id = ?',
        [QUEST_BOARD_ISSUER_RENOWN_PER_APPROVAL, issuerUserId]
      );
      await conn.execute(
        `UPDATE board_quests
         SET status = 'approved', resolved_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [questId]
      );
      await appendQuestEvent(conn, questId, issuerUserId, 'approve', cleanNote || null);
    } else {
      await conn.execute(
        `UPDATE board_quests
         SET status = 'rejected', resolved_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [questId]
      );
      await appendQuestEvent(conn, questId, issuerUserId, 'reject', cleanNote || null);
    }
    await conn.commit();
    return { ok: true, approved: isApprove, vaultReward };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  OPEN_STATUSES,
  addAstraLedger,
  getBoardSnapshot,
  createUserQuest,
  acceptQuest,
  submitQuest,
  reviewSubmittedQuest,
};
