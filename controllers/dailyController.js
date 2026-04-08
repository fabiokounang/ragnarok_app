const path = require('path');
const ejs = require('ejs');
const { getPool } = require('../config/database');
const userModel = require('../models/userModel');
const dailyTaskModel = require('../models/dailyTaskModel');
const weeklyTaskModel = require('../models/weeklyTaskModel');
const questStreakModel = require('../models/questStreakModel');
const {
  DAILY_BONUS_EXP_MULTIPLIER,
  DAILY_BONUS_TARGET_STEPS,
  DAILY_CORE_TASK_COUNT,
  NOVICE_JOB_PICK_MIN_LEVEL,
} = require('../config/constants');
const { PILLAR_LIST } = require('../config/dailyPillars');
const { parsePositiveIntId } = require('../config/security');
const {
  getGrimoireArticle,
  getArticleBySlug,
  listCategories,
  listArticlesInCategory,
  searchArticles,
  recordUserArticleRead,
  listRecentReadsForUser,
} = require('../models/grimoireModel');
const { heroUrlForCssUrlValue } = require('../config/taskHeroImages');
const { appPageTitle } = require('../config/branding');
const { headerPayloadFromUserRow } = require('./gameHeaderPayload');

const LAYOUT = 'layouts/app-shell';
const DAILY_TASK_ROW_PARTIAL = path.join(__dirname, '..', 'views', 'partials', 'daily-task-row.ejs');

function wantsJson(req) {
  const accept = req.get('Accept') || '';
  return accept.includes('application/json');
}

/** @param {Record<string, unknown>} body */
function parseMorningPickTaskIds(body) {
  const raw = body.taskTypeId;
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => parsePositiveIntId(x)).filter((n) => n != null);
  }
  const one = parsePositiveIntId(raw);
  return one != null ? [one] : [];
}

function bonusMultForTask(task) {
  if (!task || !task.isBonus) return null;
  return typeof DAILY_BONUS_EXP_MULTIPLIER === 'number' ? DAILY_BONUS_EXP_MULTIPLIER : null;
}

function renderDailyTaskRowHtml(task, bonusMult, questChannel = 'daily', gameUser = null) {
  const gu =
    gameUser && typeof gameUser === 'object'
      ? gameUser
      : { streak: 0, level: 1, displayName: '', job: '', expPct: 0, expCountTxt: '', expMaxLevel: false };
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      DAILY_TASK_ROW_PARTIAL,
      { task, bonusMult, questChannel, gameUser: gu, heroUrlForCssUrlValue },
      (err, html) => {
        if (err) reject(err);
        else resolve(html);
      }
    );
  });
}

async function getDaily(req, res, next) {
  try {
    const userId = req.session.userId;
    const jobId = await userModel.getCurrentJobId(userId);
    if (jobId == null) {
      return res.redirect('/login');
    }

    const dailyPhase = await dailyTaskModel.ensureTodayFlow(userId, jobId);
    let questTab = String(req.query.tab || '').toLowerCase() === 'weekly' ? 'weekly' : 'daily';
    if (dailyPhase === 'morning_pick') {
      questTab = 'daily';
    }
    let weekMeta = { weekStart: '', weekEnd: '' };
    let weeklyTasks = [];
    let weeklySummary = { weeklyDone: 0, weeklyTotal: 0, bossDone: 0, bossTotal: 0 };
    try {
      await weeklyTaskModel.ensureWeeklyTasks(userId, jobId);
      weekMeta = await weeklyTaskModel.getWeekMeta(getPool());
      weeklyTasks = await weeklyTaskModel.listWeekForUser(userId);
      weeklySummary = await weeklyTaskModel.summaryWeekForUser(userId);
    } catch (e) {
      if (e.errno === 1146 || e.errno === 1054) {
        console.warn('[daily] Weekly quests unavailable — run npm run db:migrate-weekly');
      } else {
        throw e;
      }
    }

    const tasks = dailyPhase === 'active' ? await dailyTaskModel.listTodayForUser(userId) : [];
    const meta = await dailyTaskModel.getServerTodayMeta();

    let morningOffers = [];
    let maxMorningPicks = DAILY_CORE_TASK_COUNT;
    if (dailyPhase === 'morning_pick') {
      morningOffers = await dailyTaskModel.listMorningOffers(userId);
      maxMorningPicks = Math.min(DAILY_CORE_TASK_COUNT, Math.max(1, morningOffers.length));
    }

    const streakBonusPotential = dailyTaskModel.streakBonusPreview(
      Number(res.locals.gameUser?.streak) || 1
    );
    const todayReflection =
      dailyPhase === 'active' ? await dailyTaskModel.getTodayReflection(userId) : '';

    const core = tasks.filter((t) => !t.isBonus);
    const bonus = tasks.filter((t) => t.isBonus);
    core.sort((a, b) => {
      if (a.pillarId !== b.pillarId) return String(a.pillarId).localeCompare(String(b.pillarId));
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    const weeklyRegular = weeklyTasks.filter((t) => !t.isWeeklyBoss);
    const weeklyBoss = weeklyTasks.filter((t) => t.isWeeklyBoss);
    const coreDone = core.filter((t) => t.done).length;
    const bonusDone = bonus.filter((t) => t.done).length;
    const remainingCoreExpPotential = core
      .filter((t) => !t.done)
      .reduce((sum, t) => sum + (Number(t.rewardExp) || 0), 0);

    const showLevelUpModal = req.query.lvup === '1';

    let flashGained = null;
    const g = req.query.gained;
    if (!showLevelUpModal && g != null && String(g).trim() !== '') {
      const n = parseInt(String(g), 10);
      if (Number.isFinite(n) && n > 0) flashGained = n;
    }

    let flashBonusProgress = null;
    if (req.query.notify === 'progress' || req.query.notify === 'bonus_progress') {
      const step = parseInt(String(req.query.step || ''), 10);
      const tg = parseInt(String(req.query.target || ''), 10);
      if (Number.isFinite(step) && Number.isFinite(tg) && tg > 1 && step >= 1 && step < tg) {
        flashBonusProgress = { current: step, target: tg };
      }
    }

    const flashQuestAccepted = req.query.notify === 'quest_accepted';

    const showJobWelcomeModal = req.query.welcome === 'firstjob';
    const jobWelcomeKind = showJobWelcomeModal ? 'first' : null;

    let dailyNotice = null;
    if (req.query.msg === 'novice_need_level') {
      dailyNotice = {
        text: `Kamu masih Novice. Capai level ${NOVICE_JOB_PICK_MIN_LEVEL} lewat daily quest dulu — baru bisa memilih kelas pertama.`,
      };
    } else if (req.query.note === 'saved') {
      dailyNotice = { text: 'Note saved on that quest.' };
    } else if (req.query.note === 'err') {
      dailyNotice = { text: 'Could not save the note (quest missing or run db migration for notes).' };
    } else if (req.query.msg === 'morning_err' && typeof req.query.code === 'string') {
      const map = {
        bad_count: 'Pick at least one quest and at most three from today’s board.',
        invalid_pick: 'One or more picks are not on today’s board — refresh and try again.',
        duplicate: 'Your lineup was already saved — refresh the page.',
      };
      dailyNotice = { text: map[req.query.code] || 'Could not save your morning picks. Try again.' };
    }

    let reflectionFlash = null;
    if (req.query.reflection === 'saved') {
      reflectionFlash = { type: 'ok', text: 'Reflection saved for today.' };
    } else if (req.query.reflection === 'err') {
      reflectionFlash = { type: 'err', text: 'Write something short first, or run the database migration for reflections.' };
    }

    let morningReadyFlash = null;
    if (req.query.notify === 'morning_ready') {
      morningReadyFlash = {
        type: 'info',
        text: 'Lineup locked — initialize each quest when you start, then check in and claim EXP as you finish.',
      };
    }

    return res.render('pages/daily', {
      title: appPageTitle('Quests'),
      layout: LAYOUT,
      navActive: 'quest',
      questTab,
      coreTasks: core,
      bonusTasks: bonus,
      coreDone,
      coreTotal: core.length,
      bonusDone,
      bonusTotal: bonus.length,
      flashGained,
      showLevelUpModal,
      flashBonusProgress,
      flashQuestAccepted,
      showJobWelcomeModal,
      jobWelcomeKind,
      dailyNotice,
      dailyPhase,
      morningOffers,
      maxMorningPicks,
      pillarLegend: PILLAR_LIST,
      streakBonusPotential,
      remainingCoreExpPotential,
      todayReflection,
      reflectionFlash,
      morningReadyFlash,
      bonusExpMultiplier: DAILY_BONUS_EXP_MULTIPLIER,
      bonusTargetSteps: DAILY_BONUS_TARGET_STEPS,
      weekStart: weekMeta.weekStart,
      weekEnd: weekMeta.weekEnd,
      weeklyRegularTasks: weeklyRegular,
      weeklyBossTasks: weeklyBoss,
      weeklySummary,
    });
  } catch (err) {
    return next(err);
  }
}

async function getGrimoireRead(req, res, next) {
  try {
    const userId = req.session.userId;
    const jobId = await userModel.getCurrentJobId(userId);
    if (jobId == null) {
      return res.redirect('/login');
    }

    const raw = String(req.params.slug || '').trim();
    if (!/^[a-z0-9_]{1,64}$/i.test(raw)) {
      return res.status(404).render('pages/not-found', {
        title: appPageTitle('Not found'),
        layout: LAYOUT,
        navActive: 'quest',
      });
    }

    const meta = await dailyTaskModel.getServerTodayMeta();
    const article = await getGrimoireArticle(raw, { dateStr: meta.dateStr });
    await recordUserArticleRead(userId, article.slug);
    return res.render('pages/grimoire-read', {
      title: appPageTitle(`${article.title} — Grimoire`),
      layout: LAYOUT,
      navActive: 'quest',
      article,
    });
  } catch (err) {
    return next(err);
  }
}

async function getGrimoireBrowse(req, res, next) {
  try {
    const userId = req.session.userId;
    const jobId = await userModel.getCurrentJobId(userId);
    if (jobId == null) {
      return res.redirect('/login');
    }

    const q = String(req.query.q || '').trim();
    const searchResults = q.length >= 2 ? await searchArticles(q, 28) : [];
    const recentReads = await listRecentReadsForUser(userId, 8);

    return res.render('pages/grimoire-browse', {
      title: appPageTitle('Grimoire library'),
      layout: LAYOUT,
      navActive: 'quest',
      categories: await listCategories(),
      searchQuery: q,
      searchResults,
      recentReads,
    });
  } catch (err) {
    return next(err);
  }
}

async function getGrimoireCategory(req, res, next) {
  try {
    const userId = req.session.userId;
    const jobId = await userModel.getCurrentJobId(userId);
    if (jobId == null) {
      return res.redirect('/login');
    }

    const raw = String(req.params.categoryId || '').trim();
    const data = await listArticlesInCategory(raw);
    if (!data) {
      return res.status(404).render('pages/not-found', {
        title: appPageTitle('Not found'),
        layout: LAYOUT,
        navActive: 'quest',
      });
    }

    const arts = data.articles;
    const spotlightArticle = arts.length ? arts[0] : null;
    const articlesRest = arts.length > 1 ? arts.slice(1) : [];

    return res.render('pages/grimoire-category', {
      title: appPageTitle(`${data.category.title} — Grimoire`),
      layout: LAYOUT,
      navActive: 'quest',
      category: data.category,
      articles: arts,
      spotlightArticle,
      articlesRest,
    });
  } catch (err) {
    return next(err);
  }
}

async function getGrimoireArticleBySlug(req, res, next) {
  try {
    const userId = req.session.userId;
    const jobId = await userModel.getCurrentJobId(userId);
    if (jobId == null) {
      return res.redirect('/login');
    }

    const raw = String(req.params.slug || '').trim();
    const article = await getArticleBySlug(raw);
    if (!article) {
      return res.status(404).render('pages/not-found', {
        title: appPageTitle('Not found'),
        layout: LAYOUT,
        navActive: 'quest',
      });
    }

    await recordUserArticleRead(userId, article.slug);

    return res.render('pages/grimoire-read', {
      title: appPageTitle(`${article.title} — Grimoire`),
      layout: LAYOUT,
      navActive: 'quest',
      article,
    });
  } catch (err) {
    return next(err);
  }
}

async function postMorningPick(req, res, next) {
  try {
    const userId = req.session.userId;
    const jobId = await userModel.getCurrentJobId(userId);
    if (jobId == null) {
      return res.redirect('/login');
    }
    const ids = parseMorningPickTaskIds(req.body);
    const r = await dailyTaskModel.commitMorningPicks(userId, jobId, ids);
    if (!r.ok) {
      return res.redirect(`/daily?msg=morning_err&code=${encodeURIComponent(r.error || 'bad_count')}`);
    }
    return res.redirect('/daily?notify=morning_ready');
  } catch (err) {
    return next(err);
  }
}

async function postDailyTaskNote(req, res, next) {
  try {
    const userId = req.session.userId;
    const taskId = parsePositiveIntId(req.body.taskId);
    if (taskId == null) {
      return res.redirect('/daily');
    }
    const ok = await dailyTaskModel.updateTaskNote(userId, taskId, req.body.note);
    if (!ok) {
      return res.redirect('/daily?note=err');
    }
    return res.redirect('/daily?note=saved');
  } catch (err) {
    return next(err);
  }
}

async function postDailyReflection(req, res, next) {
  try {
    const userId = req.session.userId;
    const r = await dailyTaskModel.saveTodayReflection(userId, req.body.body);
    if (!r.ok) {
      return res.redirect('/daily?reflection=err');
    }
    return res.redirect('/daily?reflection=saved');
  } catch (err) {
    return next(err);
  }
}

async function postAcceptDailyTask(req, res, next) {
  try {
    const userId = req.session.userId;
    const taskId = parsePositiveIntId(req.body.taskId);
    if (taskId == null) {
      if (wantsJson(req)) {
        return res.status(400).json({ ok: false, error: 'bad_task' });
      }
      return res.redirect('/daily');
    }

    const ok = await dailyTaskModel.acceptUserDailyTask(userId, taskId);
    if (!ok) {
      if (wantsJson(req)) {
        return res.status(409).json({ ok: false, error: 'accept_failed' });
      }
      return res.redirect('/daily');
    }

    if (wantsJson(req)) {
      const task = await dailyTaskModel.getTodayTaskById(userId, taskId);
      if (!task) {
        return res.status(500).json({ ok: false, error: 'task_missing' });
      }
      const html = await renderDailyTaskRowHtml(task, bonusMultForTask(task), 'daily', res.locals.gameUser);
      const summary = await dailyTaskModel.summaryCountsForUser(userId);
      return res.json({
        ok: true,
        taskId,
        html,
        notify: 'quest_accepted',
        summary,
      });
    }

    return res.redirect('/daily?notify=quest_accepted');
  } catch (err) {
    return next(err);
  }
}

async function postCompleteDailyTask(req, res, next) {
  try {
    const userId = req.session.userId;
    const taskId = parsePositiveIntId(req.body.taskId);
    if (taskId == null) {
      if (wantsJson(req)) {
        return res.status(400).json({ ok: false, error: 'bad_task' });
      }
      return res.redirect('/daily');
    }

    const result = await dailyTaskModel.completeUserDailyTask(userId, taskId);
    if (!result) {
      if (wantsJson(req)) {
        return res.status(409).json({ ok: false, error: 'complete_failed' });
      }
      return res.redirect('/daily');
    }

    if (result.partial) {
      if (wantsJson(req)) {
        const task = await dailyTaskModel.getTodayTaskById(userId, taskId);
        if (!task) {
          return res.status(500).json({ ok: false, error: 'task_missing' });
        }
        const html = await renderDailyTaskRowHtml(task, bonusMultForTask(task), 'daily', res.locals.gameUser);
        const summary = await dailyTaskModel.summaryCountsForUser(userId);
        return res.json({
          ok: true,
          partial: true,
          taskId,
          html,
          notify: 'bonus_progress',
          current: result.current,
          target: result.target,
          summary,
        });
      }
      const q = new URLSearchParams({
        notify: 'progress',
        step: String(result.current),
        target: String(result.target),
      });
      return res.redirect(`/daily?${q.toString()}`);
    }

    if (wantsJson(req)) {
      const task = await dailyTaskModel.getTodayTaskById(userId, taskId);
      if (!task) {
        return res.status(500).json({ ok: false, error: 'task_missing' });
      }
      const html = await renderDailyTaskRowHtml(task, bonusMultForTask(task), 'daily', res.locals.gameUser);
      const summary = await dailyTaskModel.summaryCountsForUser(userId);
      const userRow = await userModel.findWithJobById(userId);
      const header = headerPayloadFromUserRow(userRow);
      const payload = {
        ok: true,
        taskId,
        html,
        gained: result.gained,
        baseGained: result.baseGained,
        streakBonus: result.streakBonus,
        leveledUp: result.leveledUp,
        expPctBefore: result.expPctBefore,
        expPctAfter: result.expPctAfter,
        summary,
        header,
        vaultReward: result.vaultReward || null,
      };
      if (result.leveledUp) {
        payload.levelUp = {
          gained: result.gained,
          from: result.previousLevel,
          to: result.level,
          sp: result.statPointsGained,
          xp0: result.expPctBefore,
          xp1: result.expPctAfter,
        };
      }
      return res.json(payload);
    }

    const q = new URLSearchParams({ gained: String(result.gained) });
    if (result.leveledUp) {
      q.set('lvup', '1');
      q.set('from', String(result.previousLevel));
      q.set('to', String(result.level));
      q.set('sp', String(result.statPointsGained));
      q.set('xp0', String(result.expPctBefore));
      q.set('xp1', String(result.expPctAfter));
    }
    return res.redirect(`/daily?${q.toString()}`);
  } catch (err) {
    return next(err);
  }
}

async function postAcceptWeeklyTask(req, res, next) {
  try {
    const userId = req.session.userId;
    const taskId = parsePositiveIntId(req.body.taskId);
    if (taskId == null) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'bad_task' });
      return res.redirect('/daily');
    }

    const ok = await weeklyTaskModel.acceptUserWeeklyTask(userId, taskId);
    if (!ok) {
      if (wantsJson(req)) return res.status(409).json({ ok: false, error: 'accept_failed' });
      return res.redirect('/daily');
    }

    if (wantsJson(req)) {
      const task = await weeklyTaskModel.getWeekTaskById(userId, taskId);
      if (!task) return res.status(500).json({ ok: false, error: 'task_missing' });
      const html = await renderDailyTaskRowHtml(task, null, 'weekly', res.locals.gameUser);
      const weeklySummary = await weeklyTaskModel.summaryWeekForUser(userId);
      return res.json({ ok: true, taskId, html, notify: 'quest_accepted', weeklySummary });
    }
    return res.redirect('/daily?notify=quest_accepted');
  } catch (err) {
    return next(err);
  }
}

async function postCompleteWeeklyTask(req, res, next) {
  try {
    const userId = req.session.userId;
    const taskId = parsePositiveIntId(req.body.taskId);
    if (taskId == null) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'bad_task' });
      return res.redirect('/daily');
    }

    const result = await weeklyTaskModel.completeUserWeeklyTask(userId, taskId);
    if (!result) {
      if (wantsJson(req)) return res.status(409).json({ ok: false, error: 'complete_failed' });
      return res.redirect('/daily');
    }

    if (result.partial) {
      if (wantsJson(req)) {
        const task = await weeklyTaskModel.getWeekTaskById(userId, taskId);
        if (!task) return res.status(500).json({ ok: false, error: 'task_missing' });
        const html = await renderDailyTaskRowHtml(task, null, 'weekly', res.locals.gameUser);
        const weeklySummary = await weeklyTaskModel.summaryWeekForUser(userId);
        return res.json({
          ok: true,
          partial: true,
          taskId,
          html,
          notify: 'bonus_progress',
          current: result.current,
          target: result.target,
          weeklySummary,
        });
      }
      const q = new URLSearchParams({
        notify: 'progress',
        step: String(result.current),
        target: String(result.target),
      });
      return res.redirect(`/daily?${q.toString()}`);
    }

    if (wantsJson(req)) {
      const task = await weeklyTaskModel.getWeekTaskById(userId, taskId);
      if (!task) return res.status(500).json({ ok: false, error: 'task_missing' });
      const html = await renderDailyTaskRowHtml(task, null, 'weekly', res.locals.gameUser);
      const weeklySummary = await weeklyTaskModel.summaryWeekForUser(userId);
      const userRow = await userModel.findWithJobById(userId);
      const header = headerPayloadFromUserRow(userRow);
      const payload = {
        ok: true,
        taskId,
        html,
        gained: result.gained,
        leveledUp: result.leveledUp,
        expPctBefore: result.expPctBefore,
        expPctAfter: result.expPctAfter,
        weeklySummary,
        header,
        vaultReward: result.vaultReward || null,
      };
      if (result.leveledUp) {
        payload.levelUp = {
          gained: result.gained,
          from: result.previousLevel,
          to: result.level,
          sp: result.statPointsGained,
          xp0: result.expPctBefore,
          xp1: result.expPctAfter,
        };
      }
      return res.json(payload);
    }

    const q = new URLSearchParams({ gained: String(result.gained) });
    if (result.leveledUp) {
      q.set('lvup', '1');
      q.set('from', String(result.previousLevel));
      q.set('to', String(result.level));
      q.set('sp', String(result.statPointsGained));
      q.set('xp0', String(result.expPctBefore));
      q.set('xp1', String(result.expPctAfter));
    }
    return res.redirect(`/daily?${q.toString()}`);
  } catch (err) {
    return next(err);
  }
}

async function getDailyHistory(req, res, next) {
  try {
    const userId = req.session.userId;
    const jobId = await userModel.getCurrentJobId(userId);
    if (jobId == null) {
      return res.redirect('/login');
    }

    const scopeRaw = String(req.query.scope || 'all').toLowerCase();
    const historyScope = ['all', 'daily', 'weekly'].includes(scopeRaw) ? scopeRaw : 'all';

    const fromQ = String(req.query.from || '').trim();
    const toQ = String(req.query.to || '').trim();
    const hasRange = /^\d{4}-\d{2}-\d{2}$/.test(fromQ) && /^\d{4}-\d{2}-\d{2}$/.test(toQ);

    let presetDays = 30;
    if (!hasRange) {
      const rawDays = Number.parseInt(String(req.query.days || ''), 10);
      presetDays = [7, 30, 90].includes(rawDays) ? rawDays : 30;
    }

    const history = await dailyTaskModel.getQuestHistoryForUser(userId, {
      scope: historyScope,
      presetDays: hasRange ? null : presetDays,
      dateFrom: hasRange ? fromQ : null,
      dateTo: hasRange ? toQ : null,
    });

    const [hasAnyQuestHistoryEver, streakSummary] = await Promise.all([
      dailyTaskModel.userHasAnyQuestHistory(userId),
      questStreakModel.getJournalStreakSummary(userId),
    ]);

    return res.render('pages/daily-history', {
      title: appPageTitle('Quest Journal'),
      layout: LAYOUT,
      navActive: 'quest',
      historyScope,
      historyRangeMode: history.rangeMode,
      historyPresetDays: history.presetDays,
      historyDateFrom: history.range.dateFrom,
      historyDateTo: history.range.dateTo,
      summary: history.summary,
      historyDays: history.daysList,
      hasAnyQuestHistoryEver,
      streakSummary,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDaily,
  getDailyHistory,
  getGrimoireRead,
  getGrimoireBrowse,
  getGrimoireCategory,
  getGrimoireArticleBySlug,
  postMorningPick,
  postDailyTaskNote,
  postDailyReflection,
  postAcceptDailyTask,
  postCompleteDailyTask,
  postAcceptWeeklyTask,
  postCompleteWeeklyTask,
};
