const userModel = require('../models/userModel');
const { expProgressPercent, levelFromTotalExp, expTowardNextLevel } = require('../config/experience');
const {
  AMBIENT_MUSIC_PUBLIC_PATH,
  AMBIENT_MUSIC_VOLUME,
  SOFT_CURRENCY_NAME,
} = require('../config/constants');

const FALLBACK = {
  level: 1,
  displayName: 'Adventurer',
  username: '',
  job: 'Novice',
  expPct: 0,
  expIntoLevel: 0,
  expToNextLevel: expTowardNextLevel(0).needed,
  expMaxLevel: false,
  streak: 0,
  astraBalance: 0,
  stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
  statPointsUnspent: 0,
  musicEnabled: false,
};

async function gameLocals(req, res, next) {
  res.locals.softCurrencyName = SOFT_CURRENCY_NAME;
  res.locals.ambientMusicSrc = AMBIENT_MUSIC_PUBLIC_PATH || '';
  res.locals.ambientMusicVolume = AMBIENT_MUSIC_VOLUME;

  if (!req.session || !req.session.userId) {
    res.locals.gameUser = { ...FALLBACK };
    return next();
  }

  try {
    const userId = req.session.userId;
    const streakVal = await userModel.touchLoginStreak(userId);
    const row = await userModel.findWithJobById(userId);
    if (!row) {
      await new Promise((resolve) => {
        req.session.destroy(() => resolve());
      });
      res.locals.gameUser = { ...FALLBACK };
      return next();
    }

    const totalExp = Number(row.totalExp) || 0;
    const level = levelFromTotalExp(totalExp);
    if (level !== Number(row.level)) {
      await userModel.updateLevel(row.id, level);
    }

    const n = (v, d) => {
      const x = Number(v);
      return Number.isFinite(x) ? x : d;
    };

    const musicOn = Number(row.music_enabled) === 1;
    const expBar = expTowardNextLevel(totalExp);

    res.locals.gameUser = {
      level,
      displayName: row.displayName,
      username: row.username || '',
      job: row.jobName,
      email: row.email,
      expPct: expProgressPercent(totalExp),
      expIntoLevel: expBar.current,
      expToNextLevel: expBar.needed,
      expMaxLevel: expBar.capped,
      streak: streakVal,
      astraBalance: n(row.astra_balance, 0),
      stats: {
        str: n(row.stat_str, 1),
        agi: n(row.stat_agi, 1),
        vit: n(row.stat_vit, 1),
        int: n(row.stat_int, 1),
        dex: n(row.stat_dex, 1),
        luk: n(row.stat_luk, 1),
      },
      statPointsUnspent: n(row.stat_points_unspent, 0),
      musicEnabled: musicOn,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { gameLocals };
