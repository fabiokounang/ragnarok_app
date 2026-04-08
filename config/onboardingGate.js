const { levelFromTotalExp } = require('./experience');
const { STARTING_JOB_ID, NOVICE_JOB_PICK_MIN_LEVEL } = require('./constants');

/**
 * Level derived from total EXP (same rule as dailies / header).
 * @param {number} totalExp
 */
function effectiveLevelFromTotalExp(totalExp) {
  return levelFromTotalExp(Math.max(0, Number(totalExp) || 0));
}

/**
 * Novice who has reached the level gate must pick a first job before other app areas (except /choose-job).
 * @param {number} currentJobId
 * @param {number} totalExp
 */
function noviceMustPickFirstJob(currentJobId, totalExp) {
  return (
    Number(currentJobId) === Number(STARTING_JOB_ID) &&
    effectiveLevelFromTotalExp(totalExp) >= NOVICE_JOB_PICK_MIN_LEVEL
  );
}

/**
 * @param {number} currentJobId
 * @param {number} totalExp
 * @returns {string} redirect path
 */
function defaultPathAfterAuth(currentJobId, totalExp) {
  return noviceMustPickFirstJob(currentJobId, totalExp) ? '/choose-job' : '/daily';
}

module.exports = {
  effectiveLevelFromTotalExp,
  noviceMustPickFirstJob,
  defaultPathAfterAuth,
};
