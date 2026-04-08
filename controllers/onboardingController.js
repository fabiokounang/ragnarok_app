const userModel = require('../models/userModel');
const userJobModel = require('../models/userJobModel');
const jobModel = require('../models/jobModel');
const { STARTING_JOB_ID, NOVICE_JOB_PICK_MIN_LEVEL } = require('../config/constants');
const { effectiveLevelFromTotalExp } = require('../config/onboardingGate');
const { parsePositiveIntId } = require('../config/security');
const { appPageTitle } = require('../config/branding');

function buildChooseJobViewModel(jobs) {
  const maxPick = jobs.length ? Math.max(0, ...jobs.map((j) => j.pickCount)) : 0;
  const favoriteJobIds =
    maxPick > 0 ? jobs.filter((j) => j.pickCount === maxPick).map((j) => Number(j.id)) : [];
  return {
    jobs,
    favoriteJobIds,
    hasCommunityFavorite: maxPick > 0,
    topPickCount: maxPick,
  };
}

/** Plain JSON for Class manual modal (stable types, no MySQL driver quirks). */
function serializeJobsForChooseJobClient(jobs) {
  return jobs.map((j) => ({
    id: Number(j.id),
    slug: String(j.slug || ''),
    name: String(j.name || ''),
    description: j.description == null ? '' : String(j.description),
    evolutionPaths: Array.isArray(j.evolutionPaths)
      ? j.evolutionPaths.map((p) => ({
          steps: Array.isArray(p.steps) ? p.steps.map(String) : [],
          gateLevels: Array.isArray(p.gateLevels) ? p.gateLevels.map((g) => Number(g)) : [],
        }))
      : [],
  }));
}

async function renderChooseJob(res, { error }) {
  const jobs = await jobModel.listFirstJobsWithProgress();
  const vm = buildChooseJobViewModel(jobs);
  const chooseJobClientJson = JSON.stringify(serializeJobsForChooseJobClient(jobs)).replace(
    /</g,
    '\\u003c'
  );
  return res.render('pages/choose-job', {
    title: appPageTitle('Choose your path'),
    layout: 'layouts/auth',
    authVariant: 'choose-job',
    error,
    chooseJobClientJson,
    noviceMinPickLevel: NOVICE_JOB_PICK_MIN_LEVEL,
    ...vm,
  });
}

async function getChooseJob(req, res, next) {
  try {
    const row = await userModel.findWithJobById(req.session.userId);
    if (!row) {
      return res.redirect('/login');
    }
    const jid = Number(row.currentJobId);
    if (jid !== Number(STARTING_JOB_ID)) {
      return res.redirect('/daily');
    }
    const lvl = effectiveLevelFromTotalExp(row.totalExp);
    if (lvl < NOVICE_JOB_PICK_MIN_LEVEL) {
      return res.redirect('/daily?msg=novice_need_level');
    }
    return renderChooseJob(res, { error: null });
  } catch (err) {
    return next(err);
  }
}

async function postChooseJob(req, res, next) {
  try {
    const row = await userModel.findWithJobById(req.session.userId);
    if (!row) {
      return res.redirect('/login');
    }
    const jid = Number(row.currentJobId);
    if (jid !== Number(STARTING_JOB_ID)) {
      return res.redirect('/daily');
    }
    const lvl = effectiveLevelFromTotalExp(row.totalExp);
    if (lvl < NOVICE_JOB_PICK_MIN_LEVEL) {
      return res.redirect('/daily?msg=novice_need_level');
    }

    const jobId = parsePositiveIntId(req.body.jobId);
    if (jobId == null) {
      return renderChooseJob(res, { error: 'Pick a valid path.' });
    }

    const valid = await jobModel.isValidNoviceFirstJob(jobId);
    if (!valid) {
      return renderChooseJob(res, { error: 'That path is not available.' });
    }

    await userJobModel.setFirstSlotJob(req.session.userId, jobId);
    await jobModel.incrementJobPickCount(jobId);
    return res.redirect('/daily?welcome=firstjob');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getChooseJob,
  postChooseJob,
};
