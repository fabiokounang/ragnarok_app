const userModel = require('../models/userModel');
const userJobModel = require('../models/userJobModel');
const jobModel = require('../models/jobModel');
const jobAdvanceModel = require('../models/jobAdvanceModel');
const dailyTaskModel = require('../models/dailyTaskModel');
const weeklyTaskModel = require('../models/weeklyTaskModel');
const questBoardModel = require('../models/questBoardModel');
const trainModel = require('../models/trainModel');
const trainRoutineModel = require('../models/trainRoutineModel');
const astraShopModel = require('../models/astraShopModel');
const { levelFromTotalExp } = require('../config/experience');
const {
  STARTING_JOB_ID,
  RO_STAT_KEYS,
  SOFT_CURRENCY_NAME,
  questPostRewardCapsForLevel,
} = require('../config/constants');
const { defaultPathAfterAuth } = require('../config/onboardingGate');
const { parsePositiveIntId } = require('../config/security');
const { appPageTitle } = require('../config/branding');

const LAYOUT = 'layouts/app-shell';

const questBoardRequests = [
  {
    id: 'mom-study',
    giver: 'Game Master',
    title: 'Study 30 minutes for your future',
    note: 'She wants your next 5 years to be better than today.',
    route: '/daily/grimoire/browse',
    cta: 'Go study',
    track: 'INT',
    cadence: 'Daily',
  },
  {
    id: 'friend-fit',
    giver: 'Game Master',
    title: 'Build a stronger body together',
    note: 'Do one strength-focused session and report back.',
    route: '/training',
    cta: 'Start training',
    track: 'STR',
    cadence: 'Daily',
  },
  {
    id: 'future-self',
    giver: 'Game Master',
    title: 'Keep your rhythm 3 days straight',
    note: 'Consistency beats motivation when life gets noisy.',
    route: '/daily',
    cta: 'Do discipline quests',
    track: 'DIS',
    cadence: 'Daily',
  },
  {
    id: 'mentor-weekly',
    giver: 'Game Master',
    title: 'Clear this week objective',
    note: 'Finish weekly contracts to prove reliability.',
    route: '/daily',
    cta: 'Open weekly board',
    track: 'SPR',
    cadence: 'Weekly',
  },
  {
    id: 'dad-finance',
    giver: 'Game Master',
    title: 'Learn one money concept this week',
    note: 'Understand cash flow before income gets bigger.',
    route: '/daily/grimoire/category/biz',
    cta: 'Read business grimoire',
    track: 'INT',
    cadence: 'Weekly',
  },
  {
    id: 'coach-recovery',
    giver: 'Game Master',
    title: 'Recover before burnout hits',
    note: 'Take one deep recovery task to keep performance stable.',
    route: '/daily',
    cta: 'Do spirit quests',
    track: 'SPR',
    cadence: 'Daily',
  },
  {
    id: 'captain-journal',
    giver: 'Game Master',
    title: 'Write a short mission log',
    note: 'Reflection turns random effort into progress.',
    route: '/daily/history',
    cta: 'Open journal',
    track: 'META',
    cadence: 'Daily',
  },
  {
    id: 'market-npc',
    giver: 'Game Master',
    title: 'Learn supply and demand basics',
    note: 'Price intuition helps your real life decisions.',
    route: '/daily/grimoire/category/eco',
    cta: 'Read economy notes',
    track: 'INT',
    cadence: 'Weekly',
  },
];

async function redirectRoot(req, res, next) {
  if (req.session && req.session.userId) {
    try {
      const row = await userModel.findWithJobById(req.session.userId);
      if (!row) {
        return res.redirect('/login');
      }
      return res.redirect(defaultPathAfterAuth(row.currentJobId, row.totalExp));
    } catch (err) {
      return next(err);
    }
  }
  return res.redirect('/login');
}

async function getTraining(req, res, next) {
  try {
    const userId = req.session.userId;
    const [trainStatus, routines] = await Promise.all([
      trainModel.getTrainingStatus(userId),
      trainRoutineModel.listForUser(userId),
    ]);
    const flash = String(req.query.train || '').trim();
    return res.render('pages/training', {
      title: appPageTitle('Training'),
      layout: LAYOUT,
      navActive: 'training',
      personalQuests: routines,
      trainStatus,
      trainFlash: flash,
    });
  } catch (err) {
    return next(err);
  }
}

async function postTrainingComplete(req, res, next) {
  try {
    const userId = req.session.userId;
    const routineId = parsePositiveIntId(req.body.routineId);
    if (!routineId) return res.redirect('/training?train=pick_routine');
    const exists = await trainRoutineModel.existsForUser(userId, routineId);
    if (!exists) return res.redirect('/training?train=bad_routine');
    await trainModel.completeTrainingSession(userId, routineId);
    return res.redirect('/training?train=ok');
  } catch (err) {
    const key = String(err && err.message ? err.message : 'err');
    return res.redirect(`/training?train=${encodeURIComponent(key)}`);
  }
}

async function postTrainingRoutineCreate(req, res, next) {
  try {
    const userId = req.session.userId;
    await trainRoutineModel.createForUser(userId, req.body.title, req.body.blurb);
    return res.redirect('/training?train=created');
  } catch (err) {
    return res.redirect(`/training?train=${encodeURIComponent(String(err.message || 'err'))}`);
  }
}

async function postTrainingRoutineUpdate(req, res, next) {
  try {
    const userId = req.session.userId;
    const routineId = parsePositiveIntId(req.body.routineId);
    if (!routineId) return res.redirect('/training?train=bad_routine');
    await trainRoutineModel.updateForUser(userId, routineId, req.body.title, req.body.blurb);
    return res.redirect('/training?train=updated');
  } catch (err) {
    return res.redirect(`/training?train=${encodeURIComponent(String(err.message || 'err'))}`);
  }
}

async function postTrainingRoutineDelete(req, res, next) {
  try {
    const userId = req.session.userId;
    const routineId = parsePositiveIntId(req.body.routineId);
    if (!routineId) return res.redirect('/training?train=bad_routine');
    await trainRoutineModel.archiveForUser(userId, routineId);
    return res.redirect('/training?train=deleted');
  } catch (err) {
    return res.redirect(`/training?train=${encodeURIComponent(String(err.message || 'err'))}`);
  }
}

function vaultFlashFromQuery(raw) {
  const code = String(raw || '').trim();
  const M = {
    ok_reroll: {
      type: 'ok',
      text: 'Daily board updated. Open Task to see your new offers or swapped quest.',
    },
    ok_shield: {
      type: 'ok',
      text: 'Streak Shield added to Vault.',
    },
    ok_shield_multi: {
      type: 'ok',
      text: 'Streak Shields purchased and added to your Vault.',
    },
    ok_sip: { type: 'ok', text: 'Focus Sip added to Vault.' },
    ok_use_reroll: { type: 'ok', text: 'Daily board rerolled from Vault token.' },
    ok_use_shield: { type: 'ok', text: 'Streak Shield armed. It protects one missed day.' },
    ok_use_focus: { type: 'ok', text: 'Focus Charge activated for today.' },
    insufficient_astra: { type: 'err', text: `Not enough ${SOFT_CURRENCY_NAME}.` },
    reroll_used_today: { type: 'err', text: 'Daily reroll already used today.' },
    sip_used_today: { type: 'err', text: 'Focus Sip already used today.' },
    focus_full: { type: 'err', text: 'Focus charge is already full for today.' },
    no_reroll_token: { type: 'err', text: 'No Daily Reroll token in Vault.' },
    no_shield_token: { type: 'err', text: 'No Streak Shield in Vault.' },
    no_focus_token: { type: 'err', text: 'No Focus Charge in Vault.' },
    nothing_to_reroll: {
      type: 'err',
      text: 'Nothing to reroll yet (pick morning tasks first, or finish all core dailies).',
    },
    migration_needed: {
      type: 'err',
      text: 'Vault shop needs DB updates (run db:migrate-astra-shop and db:migrate-vault-manual).',
    },
    no_alternate_task: { type: 'err', text: 'No other task type available to swap into that slot.' },
    empty_pool: { type: 'err', text: 'Your job has no daily tasks in the pool.' },
    err: { type: 'err', text: 'Could not complete that purchase.' },
  };
  return M[code] || null;
}

async function getInventory(req, res, next) {
  try {
    const userId = req.session.userId;
    const row = await userModel.findWithJobById(userId);
    if (!row) return next(new Error('user_missing'));
    const jobId = Number(row.currentJobId);
    const vaultShop = await astraShopModel.getVaultShopSnapshot(userId, jobId);
    const vaultActivity = await astraShopModel.listVaultActivity(userId, 12);
    const vaultFlash = vaultFlashFromQuery(req.query.vault);
    res.render('pages/inventory', {
      title: appPageTitle('Vault'),
      layout: LAYOUT,
      navActive: 'inventory',
      vaultShop,
      vaultActivity,
      vaultFlash,
      softCurrencyName: SOFT_CURRENCY_NAME,
    });
  } catch (err) {
    return next(err);
  }
}

async function postVaultShop(req, res, next) {
  try {
    const userId = req.session.userId;
    const row = await userModel.findWithJobById(userId);
    if (!row) return res.redirect('/inventory?vault=err');
    const jobId = Number(row.currentJobId);
    const action = String(req.body.action || '').trim();
    let key = 'err';
    if (action === 'daily_reroll') {
      const r = await astraShopModel.purchaseDailyReroll(userId, jobId);
      key = r.ok ? 'ok_reroll' : r.error;
    } else if (action === 'streak_shield') {
      const qty = Math.max(1, Math.min(99, Math.floor(Number(req.body.qty) || 1)));
      const r = await astraShopModel.purchaseStreakShield(userId, qty);
      key = r.ok ? (qty > 1 ? 'ok_shield_multi' : 'ok_shield') : r.error;
    } else if (action === 'focus_sip') {
      const r = await astraShopModel.purchaseFocusSip(userId);
      key = r.ok ? 'ok_sip' : r.error;
    } else if (action === 'use_daily_reroll') {
      const r = await astraShopModel.useDailyReroll(userId, jobId);
      key = r.ok ? 'ok_use_reroll' : r.error;
    } else if (action === 'use_streak_shield') {
      const r = await astraShopModel.useStreakShield(userId);
      key = r.ok ? 'ok_use_shield' : r.error;
    } else if (action === 'use_focus_sip') {
      const r = await astraShopModel.useFocusSip(userId);
      key = r.ok ? 'ok_use_focus' : r.error;
    }
    return res.redirect(`/inventory?vault=${encodeURIComponent(key)}`);
  } catch (err) {
    return next(err);
  }
}

function buildJobSlotsView(slots) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  const out = [];
  for (let i = 1; i <= userJobModel.MAX_SLOTS; i++) {
    const row = bySlot.get(i);
    if (row) {
      const totalExp = Number(row.totalExp) || 0;
      const level = levelFromTotalExp(totalExp);
      out.push({ ...row, empty: false, level });
    } else {
      out.push({
        slot: i,
        empty: true,
        jobId: null,
        name: '',
        slug: '',
        tier: null,
        isActive: false,
        level: 1,
        totalExp: 0,
      });
    }
  }
  return out;
}

async function getProfile(req, res, next) {
  try {
    const slots = await userJobModel.listSlots(req.session.userId);
    const jobSlots = buildJobSlotsView(slots);
    const jobFlash =
      req.query.job === 'ok'
        ? { type: 'ok', text: 'Job lineup updated.' }
        : req.query.job === 'advance'
          ? { type: 'ok', text: 'Congratulations — you advanced to your new class. Dailies now use this job’s pool.' }
        : req.query.job === 'active'
          ? { type: 'ok', text: 'Active job changed. Dailies use this class from now on.' }
          : req.query.job === 'err' && typeof req.query.msg === 'string'
            ? (() => {
                const key = req.query.msg;
                const base =
                  {
                    duplicate_job: 'That job is already in another slot.',
                    slots_full: 'All three slots are full. Remove a class first if you want a different lineup.',
                    slot_occupied: 'This slot already has a class. You can only fill empty slots.',
                    invalid_slot: 'Invalid slot.',
                    last_job: 'Keep at least one job in your lineup.',
                    empty_slot: 'That slot is empty.',
                    not_in_slots: 'Pick a job from your lineup.',
                    update_failed: 'Could not update active job.',
                    novice_use_choose_job:
                      'You are still a Novice: reach level 10 through dailies, then pick your first class on the Choose Job screen.',
                    advance_unavailable: 'Advanced jobs need a database migration. Ask admin to run npm run db:migrate-job-progression-reqs.',
                    invalid_path: 'That class change is not available from your current job.',
                    not_base_job: 'Switch to a first job (tier 1) as your active class to advance.',
                    invalid_target: 'Invalid advanced class.',
                    need_level: 'Class level is not high enough yet — keep earning EXP on this job.',
                    need_quests: 'Complete more dailies and weeklies for this job’s task pool.',
                    need_boss: 'Clear more weekly boss missions for this job line.',
                    need_streak: 'Build a longer login streak (check in daily).',
                  }[key] || 'Something went wrong.';
                let text = base;
                if (
                  key.startsWith('need_') &&
                  typeof req.query.need === 'string' &&
                  typeof req.query.have === 'string'
                ) {
                  text += ` (required ${req.query.need}, you have ${req.query.have}).`;
                }
                return { type: 'err', text };
              })()
            : null;

    const musicFlash =
      req.query.music === '1'
        ? {
            type: 'ok',
            text: 'In-app music is on. Tap anywhere on the page (or press a key) once so the browser can start playback.',
          }
        : null;

    const showJobWelcomeModal = req.query.welcome === 'newslot';
    const jobWelcomeKind = showJobWelcomeModal ? 'newslot' : null;

    const activeSlot = jobSlots.find((s) => !s.empty && s.isActive);
    let jobAdvance = null;
    if (activeSlot && activeSlot.tier === 1) {
      const fromJobId = activeSlot.jobId;
      const [targets, progress] = await Promise.all([
        jobAdvanceModel.listAdvanceTargets(fromJobId),
        jobAdvanceModel.getAdvanceProgress(req.session.userId, fromJobId),
      ]);
      if (targets.length) {
        jobAdvance = {
          fromJobId,
          progress,
          targets: targets.map((t) => ({
            ...t,
            ready:
              progress.level >= t.minLevel &&
              progress.questsDone >= t.minQuests &&
              progress.bossWins >= t.minBoss &&
              progress.streak >= t.minStreak,
          })),
        };
      }
    }

    res.render('pages/profile', {
      title: appPageTitle('Character'),
      layout: LAYOUT,
      navActive: 'profile',
      profileStatOk: req.query.stat === '1',
      jobSlots,
      jobFlash,
      musicFlash,
      showJobWelcomeModal,
      jobWelcomeKind,
      jobAdvance,
    });
  } catch (err) {
    return next(err);
  }
}

async function getProfileAddJob(req, res, next) {
  try {
    const slot = parsePositiveIntId(req.query.slot);
    if (slot == null || slot > userJobModel.MAX_SLOTS) {
      return res.redirect('/profile?job=err&msg=invalid_slot');
    }

    const jid = await userModel.getCurrentJobId(req.session.userId);
    if (jid === STARTING_JOB_ID) {
      return res.redirect('/profile?job=err&msg=novice_use_choose_job');
    }

    const slots = await userJobModel.listSlots(req.session.userId);
    if (slots.some((s) => s.slot === slot)) {
      return res.redirect('/profile?job=err&msg=slot_occupied');
    }
    const otherIds = new Set(slots.map((s) => s.jobId));
    const jobs = (await jobModel.listFirstJobsFromNovice()).filter(
      (j) => !otherIds.has(Number(j.id))
    );

    res.render('pages/profile-add-job', {
      title: appPageTitle('Add class'),
      layout: LAYOUT,
      navActive: 'profile-add-job',
      targetSlot: slot,
      jobs,
    });
  } catch (err) {
    return next(err);
  }
}

async function postProfileJobActive(req, res, next) {
  try {
    const jobId = parsePositiveIntId(req.body.jobId);
    if (jobId == null) {
      return res.redirect('/profile?job=err&msg=invalid_slot');
    }
    const r = await userJobModel.setActiveJob(req.session.userId, jobId);
    if (!r.ok) {
      return res.redirect(`/profile?job=err&msg=${encodeURIComponent(r.error || 'update_failed')}`);
    }
    return res.redirect('/profile?job=active');
  } catch (err) {
    return next(err);
  }
}

async function postProfileJobSlot(req, res, next) {
  try {
    const slot = parsePositiveIntId(req.body.slot);
    const jobId = parsePositiveIntId(req.body.jobId);
    if (slot == null || jobId == null || slot > userJobModel.MAX_SLOTS) {
      return res.redirect('/profile?job=err&msg=invalid_slot');
    }
    const curJid = await userModel.getCurrentJobId(req.session.userId);
    if (curJid === STARTING_JOB_ID) {
      return res.redirect('/profile?job=err&msg=novice_use_choose_job');
    }
    const valid = await jobModel.isValidNoviceFirstJob(jobId);
    if (!valid) {
      return res.redirect('/profile?job=err&msg=invalid_slot');
    }
    const r = await userJobModel.assignJobToSlot(req.session.userId, slot, jobId);
    if (!r.ok) {
      return res.redirect(`/profile?job=err&msg=${encodeURIComponent(r.error || 'invalid_slot')}`);
    }
    return res.redirect('/profile?welcome=newslot');
  } catch (err) {
    return next(err);
  }
}

async function postProfileJobRemove(req, res, next) {
  try {
    const slot = parsePositiveIntId(req.body.slot);
    if (slot == null || slot > userJobModel.MAX_SLOTS) {
      return res.redirect('/profile?job=err&msg=invalid_slot');
    }
    const r = await userJobModel.removeSlot(req.session.userId, slot);
    if (!r.ok) {
      return res.redirect(`/profile?job=err&msg=${encodeURIComponent(r.error || 'last_job')}`);
    }
    return res.redirect('/profile?job=ok');
  } catch (err) {
    return next(err);
  }
}

async function postProfileJobAdvance(req, res, next) {
  try {
    const toJobId = parsePositiveIntId(req.body.toJobId);
    if (toJobId == null) {
      return res.redirect('/profile?job=err&msg=invalid_target');
    }
    const r = await userJobModel.promoteActiveJob(req.session.userId, toJobId);
    if (!r.ok) {
      const code = r.error || 'invalid_target';
      const extra =
        code.startsWith('need_') && r.need != null && r.have != null
          ? `&need=${encodeURIComponent(String(r.need))}&have=${encodeURIComponent(String(r.have))}`
          : '';
      return res.redirect(`/profile?job=err&msg=${encodeURIComponent(code)}${extra}`);
    }
    return res.redirect('/profile?job=advance');
  } catch (err) {
    return next(err);
  }
}

async function postProfileMusic(req, res, next) {
  try {
    const userId = req.session.userId;
    const raw = req.body.enabled;
    const on = raw === '1' || raw === 1 || raw === true || raw === 'true' || raw === 'on';
    await userModel.updateMusicEnabled(userId, on);
    return res.redirect('/profile?music=1');
  } catch (err) {
    return next(err);
  }
}

async function postProfileStat(req, res, next) {
  try {
    const userId = req.session.userId;
    const raw = req.body.stat;
    const key = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    const wantsJson = String(req.get('accept') || '').includes('application/json');
    if (!RO_STAT_KEYS.includes(key)) {
      if (wantsJson) return res.status(400).json({ ok: false, error: 'bad_stat' });
      return res.redirect('/profile');
    }
    const ok = await userModel.allocateStatPoint(userId, key);
    if (!ok) {
      if (wantsJson) return res.status(409).json({ ok: false, error: 'cannot_allocate' });
      return res.redirect('/profile');
    }
    const row = await userModel.findWithJobById(userId);
    const sheet = userModel.statSheetFromUserRow(row);
    if (wantsJson) {
      if (!sheet) return res.status(500).json({ ok: false, error: 'state' });
      return res.json({
        ok: true,
        stat: key,
        stats: sheet.stats,
        statPointsUnspent: sheet.statPointsUnspent,
      });
    }
    return res.redirect('/profile?stat=1');
  } catch (err) {
    return next(err);
  }
}

async function getQuests(req, res, next) {
  try {
    const userId = req.session.userId;
    const [dailySummary, weeklySummary, me, board] = await Promise.all([
      dailyTaskModel.summaryCountsForUser(userId),
      weeklyTaskModel.summaryWeekForUser(userId),
      userModel.findWithJobById(userId),
      questBoardModel.getBoardSnapshot(userId, 12),
    ]);
    return res.render('pages/quests', {
      title: appPageTitle('Quest board'),
      layout: LAYOUT,
      navActive: null,
      dailySummary,
      weeklySummary,
      questBoardRequests,
      boardOpenQuests: board.open,
      boardMyActiveQuests: board.myActive,
      boardMyFinishedQuests: board.myFinished,
      boardMyReviewQuests: board.myToReview,
      qbFlash: String(req.query.qb || '').trim(),
      softCurrencyName: SOFT_CURRENCY_NAME,
      myAstra: Math.max(0, Number(me && me.astra_balance) || 0),
      myRenown: Math.max(0, Number(me && me.renown_points) || 0),
      questPostCaps: questPostRewardCapsForLevel(Number(me && me.level) || 1),
      myLevel: Math.max(1, Number(me && me.level) || 1),
    });
  } catch (err) {
    return next(err);
  }
}

async function getLeaderboard(req, res, next) {
  try {
    const viewerId = req.session.userId;
    const rawRows = await userModel.listLeaderboard({ limit: 100 });
    const displayRanks = [];
    for (let i = 0; i < rawRows.length; i++) {
      if (i === 0) {
        displayRanks.push(1);
      } else {
        const p = rawRows[i - 1];
        const c = rawRows[i];
        if (c.level === p.level && c.totalExp === p.totalExp) {
          displayRanks.push(displayRanks[i - 1]);
        } else {
          displayRanks.push(i + 1);
        }
      }
    }
    const rows = rawRows.map((r, i) => {
      const rank = displayRanks[i];
      return {
        rank,
        userId: r.id,
        name: r.displayName,
        jobName: r.jobName,
        level: r.level,
        totalExp: r.totalExp,
        streak: r.loginStreak,
        highlight: viewerId != null && r.id === viewerId,
        medal: rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null,
      };
    });
    res.render('pages/leaderboard', {
      title: appPageTitle('Leaderboard'),
      layout: LAYOUT,
      navActive: null,
      rows,
      lbEmpty: rows.length === 0,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  redirectRoot,
  getTraining,
  getInventory,
  postVaultShop,
  getProfile,
  getProfileAddJob,
  postProfileJobActive,
  postProfileJobSlot,
  postProfileJobRemove,
  postProfileJobAdvance,
  postProfileMusic,
  postProfileStat,
  postTrainingComplete,
  postTrainingRoutineCreate,
  postTrainingRoutineUpdate,
  postTrainingRoutineDelete,
  getQuests,
  getLeaderboard,
};
