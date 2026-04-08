const { getPool } = require('../config/database');

function cleanTitle(raw) {
  return String(raw || '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 80);
}

function cleanBlurb(raw) {
  return String(raw || '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 180);
}

async function listForUser(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, title, blurb, sort_order
     FROM user_train_routines
     WHERE user_id = ? AND is_archived = 0
     ORDER BY sort_order ASC, id ASC`,
    [userId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title || ''),
    blurb: String(r.blurb || ''),
    sortOrder: Number(r.sort_order) || 0,
  }));
}

async function createForUser(userId, rawTitle, rawBlurb) {
  const title = cleanTitle(rawTitle);
  const blurb = cleanBlurb(rawBlurb);
  if (title.length < 3) throw new Error('train_title_short');
  const pool = getPool();
  const [cntRows] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_train_routines WHERE user_id = ? AND is_archived = 0`,
    [userId]
  );
  const nextOrder = Number(cntRows[0]?.c) || 0;
  const [res] = await pool.execute(
    `INSERT INTO user_train_routines (user_id, title, blurb, sort_order, is_archived)
     VALUES (?, ?, ?, ?, 0)`,
    [userId, title, blurb, nextOrder]
  );
  return Number(res.insertId);
}

async function updateForUser(userId, routineId, rawTitle, rawBlurb) {
  const title = cleanTitle(rawTitle);
  const blurb = cleanBlurb(rawBlurb);
  if (title.length < 3) throw new Error('train_title_short');
  const pool = getPool();
  const [res] = await pool.execute(
    `UPDATE user_train_routines
     SET title = ?, blurb = ?
     WHERE id = ? AND user_id = ? AND is_archived = 0`,
    [title, blurb, routineId, userId]
  );
  return Number(res.affectedRows) === 1;
}

async function archiveForUser(userId, routineId) {
  const pool = getPool();
  const [res] = await pool.execute(
    `UPDATE user_train_routines
     SET is_archived = 1
     WHERE id = ? AND user_id = ? AND is_archived = 0`,
    [routineId, userId]
  );
  return Number(res.affectedRows) === 1;
}

async function existsForUser(userId, routineId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id FROM user_train_routines WHERE id = ? AND user_id = ? AND is_archived = 0 LIMIT 1`,
    [routineId, userId]
  );
  return !!rows[0];
}

module.exports = {
  listForUser,
  createForUser,
  updateForUser,
  archiveForUser,
  existsForUser,
};
