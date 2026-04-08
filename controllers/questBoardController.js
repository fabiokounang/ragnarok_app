const questBoardModel = require('../models/questBoardModel');
const userModel = require('../models/userModel');
const { parsePositiveIntId } = require('../config/security');
const { SOFT_CURRENCY_NAME } = require('../config/constants');
const { headerPayloadFromUserRow } = require('./gameHeaderPayload');

function wantsJson(req) {
  const accept = req.get('Accept') || '';
  return accept.includes('application/json');
}

function redirectWithCode(res, code, qtab) {
  const tab = String(qtab || '').trim().toLowerCase();
  const hasTab = tab === 'open' || tab === 'progress' || tab === 'finish';
  const qs = new URLSearchParams();
  qs.set('qb', String(code || ''));
  if (hasTab) qs.set('qtab', tab);
  return res.redirect(`/quests?${qs.toString()}`);
}

function errorCode(err) {
  const m = String(err && err.message ? err.message : 'unknown');
  return m || 'unknown';
}

async function postCreateQuest(req, res, next) {
  try {
    const userId = req.session.userId;
    const result = await questBoardModel.createUserQuest(userId, req.body || {});
    if (wantsJson(req)) return res.status(201).json({ ok: true, questId: result.id });
    return redirectWithCode(res, 'created');
  } catch (err) {
    if (wantsJson(req)) return res.status(400).json({ ok: false, error: errorCode(err) });
    return redirectWithCode(res, `err_${errorCode(err)}`);
  }
}

async function postAcceptQuest(req, res, next) {
  try {
    const userId = req.session.userId;
    const questId = parsePositiveIntId(req.params.questId);
    if (!questId) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'bad_id' });
      return redirectWithCode(res, 'err_bad_id');
    }
    await questBoardModel.acceptQuest(userId, questId);
    if (wantsJson(req)) return res.json({ ok: true });
    return redirectWithCode(res, 'accepted', 'progress');
  } catch (err) {
    if (wantsJson(req)) return res.status(400).json({ ok: false, error: errorCode(err) });
    return redirectWithCode(res, `err_${errorCode(err)}`);
  }
}

async function postSubmitQuest(req, res, next) {
  try {
    const userId = req.session.userId;
    const questId = parsePositiveIntId(req.params.questId);
    if (!questId) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'bad_id' });
      return redirectWithCode(res, 'err_bad_id');
    }
    const out = await questBoardModel.submitQuest(userId, questId, req.body && req.body.note);
    if (wantsJson(req)) {
      if (!out.autoApproved) {
        return res.json({ ok: true, submitted: true });
      }
      const userRow = await userModel.findWithJobById(userId);
      const header = headerPayloadFromUserRow(userRow);
      const g = out.grant;
      const payload = {
        ok: true,
        autoApproved: true,
        questId,
        gained: g ? g.gained : 0,
        rewardAstra: out.rewardAstra || 0,
        vaultReward: out.vaultReward || null,
        leveledUp: !!(g && g.leveledUp),
        expPctBefore: g ? g.expPctBefore : undefined,
        expPctAfter: g ? g.expPctAfter : undefined,
        header,
      };
      if (g && g.leveledUp) {
        payload.levelUp = {
          gained: g.gained,
          from: g.previousLevel,
          to: g.level,
          sp: g.statPointsGained,
          xp0: g.expPctBefore,
          xp1: g.expPctAfter,
        };
      }
      return res.json(payload);
    }
    return redirectWithCode(res, out.autoApproved ? 'completed' : 'submitted');
  } catch (err) {
    if (wantsJson(req)) return res.status(400).json({ ok: false, error: errorCode(err) });
    return redirectWithCode(res, `err_${errorCode(err)}`);
  }
}

async function postReviewQuest(req, res, next) {
  try {
    const userId = req.session.userId;
    const questId = parsePositiveIntId(req.params.questId);
    if (!questId) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'bad_id' });
      return redirectWithCode(res, 'err_bad_id');
    }
    const approveRaw = req.body && req.body.approve;
    const approve = approveRaw === '1' || approveRaw === 'true' || approveRaw === true;
    const out = await questBoardModel.reviewSubmittedQuest(userId, questId, approve, req.body && req.body.note);
    if (wantsJson(req)) return res.json({ ok: true, approved: approve, vaultReward: out.vaultReward || null });
    return redirectWithCode(res, approve ? 'approved' : 'rejected');
  } catch (err) {
    if (wantsJson(req)) return res.status(400).json({ ok: false, error: errorCode(err) });
    return redirectWithCode(res, `err_${errorCode(err)}`);
  }
}

module.exports = {
  SOFT_CURRENCY_NAME,
  postCreateQuest,
  postAcceptQuest,
  postSubmitQuest,
  postReviewQuest,
};
