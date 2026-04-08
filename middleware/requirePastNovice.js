const userModel = require('../models/userModel');
const { STARTING_JOB_ID } = require('../config/constants');
const { noviceMustPickFirstJob } = require('../config/onboardingGate');

/**
 * After requireAuth: Novice below the level gate may play dailies/profile.
 * Novice at/above the gate must pick a first job first; other jobs proceed.
 */
async function requirePastNovice(req, res, next) {
  try {
    const row = await userModel.findWithJobById(req.session.userId);
    if (!row) {
      return res.redirect('/login');
    }
    const jid = Number(row.currentJobId);
    if (jid !== Number(STARTING_JOB_ID)) {
      return next();
    }
    const totalExp = Number(row.totalExp) || 0;
    if (noviceMustPickFirstJob(jid, totalExp)) {
      return res.redirect('/choose-job');
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requirePastNovice };
