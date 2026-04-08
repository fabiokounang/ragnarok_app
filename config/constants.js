/**
 * Game / progression constants (expand as features land).
 * Stat pillars: physical (STR/VIT/AGI-style tasks) + intellect (reading, podcasts, learning).
 */
const STAT_TAGS = {
  STRENGTH: 'strength',
  CARDIO: 'cardio',
  MOBILITY: 'mobility',
  HABIT: 'habit',
  INTELLECT: 'intellect',
};

/** Default job for new accounts (Novice in seeds). */
const STARTING_JOB_ID = 1;

/**
 * Novice plays dailies until this level (from total EXP); then they must pick a first class.
 * Must match progression curve in config/experience.js (levelFromTotalExp).
 */
const NOVICE_JOB_PICK_MIN_LEVEL = 10;

/** Rolled each server calendar day from the current job's task pool. */
const DAILY_CORE_TASK_COUNT = 3;
const DAILY_BONUS_TASK_COUNT = 0;

/** How many quests appear on the morning board (user picks up to DAILY_CORE_TASK_COUNT). */
const DAILY_MORNING_OFFER_COUNT = 9;

/** Rolled once per calendar week (Monday start, server date) from weekly pools. */
const WEEKLY_REGULAR_QUEST_COUNT = 2;
const WEEKLY_BOSS_QUEST_COUNT = 1;

/**
 * First core daily completion each day adds: min(login_streak, cap) * perDay EXP (honor system).
 */
const STREAK_BONUS_EXP_PER_DAY = 3;
const STREAK_BONUS_MAX_STREAK_DAYS = 30;

/**
 * Bonus: heavier picks from pool + scaled EXP (see dailyTaskModel).
 * Raise multiplier for bigger payouts; raise target steps for more confirmations before EXP.
 */
const DAILY_BONUS_EXP_MULTIPLIER = 3.5;

/** Bonus quests: taps required before EXP (honor system). 3 = harder than 2. */
const DAILY_BONUS_TARGET_STEPS = 3;

/** Stat points granted per level gained on the active job (spend on Character → stats). */
const STAT_POINTS_PER_LEVEL = 3;

/** Max value per stat. */
const RO_STAT_CAP = 99;

/** Whitelist for POST allocate (maps to users.stat_* columns). */
const RO_STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

/**
 * Optional looping BGM: URL path under this app (file in public/) or full URL if you set .env.
 * Empty string disables serving a track (toggle still saved; playback is a no-op).
 */
const AMBIENT_MUSIC_PUBLIC_PATH = String(
  process.env.AMBIENT_MUSIC_PATH || '/audio/pokemon.mp3'
).trim();

const AMBIENT_MUSIC_VOLUME = Math.min(
  1,
  Math.max(0, Number.parseFloat(String(process.env.AMBIENT_MUSIC_VOLUME || '0.22')) || 0.22)
);

/** Soft currency for social quests (in-universe name). */
const SOFT_CURRENCY_NAME = 'Astra';
const QUEST_BOARD_POST_COST_ASTRA = 3;
const QUEST_BOARD_ISSUER_RENOWN_PER_APPROVAL = 1;
const QUEST_BOARD_MAX_ACTIVE_PER_USER = 5;
const QUEST_BOARD_REWARD_EXP_MIN = 10;
const QUEST_BOARD_REWARD_EXP_MAX = 120;
const QUEST_BOARD_REWARD_ASTRA_MIN = 0;
const QUEST_BOARD_REWARD_ASTRA_MAX = 40;
const QUEST_BOARD_ISSUER_REWARD_ASTRA_MIN = 0;
const QUEST_BOARD_ISSUER_REWARD_ASTRA_MAX = 20;
const QUEST_BOARD_MAX_ACCEPTS_PER_DAY = 8;
const QUEST_BOARD_MAX_PAIR_ACCEPTS_PER_DAY = 2;
const QUEST_BOARD_MAX_ACTIVE_ACCEPTS = 3;
const QUEST_BOARD_EXPIRE_REFUND_ASTRA = 1;

/**
 * Dynamic post caps: higher class level can post higher rewards.
 * Returns safe min/max bounds for quest create form + backend validation.
 * @param {number} level
 */
function questPostRewardCapsForLevel(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const expMax = Math.min(QUEST_BOARD_REWARD_EXP_MAX, 40 + (lv - 1) * 4);
  const astraMax = Math.min(QUEST_BOARD_REWARD_ASTRA_MAX, 8 + Math.floor((lv - 1) * 1.2));
  const issuerAstraMax = Math.min(
    QUEST_BOARD_ISSUER_REWARD_ASTRA_MAX,
    Math.max(2, Math.floor(astraMax / 2))
  );
  return {
    expMin: QUEST_BOARD_REWARD_EXP_MIN,
    expMax,
    astraMin: QUEST_BOARD_REWARD_ASTRA_MIN,
    astraMax,
    issuerAstraMin: QUEST_BOARD_ISSUER_REWARD_ASTRA_MIN,
    issuerAstraMax,
  };
}

/** Training mini-reward loop */
const TRAIN_EXP_PER_SESSION = 8;
const TRAIN_DAILY_MAX_SESSIONS = 3;
const TRAIN_FOCUS_BONUS_PCT = 0.05;
const TRAIN_FOCUS_CHARGES_PER_SESSION = 1;
const TRAIN_FOCUS_MAX_CHARGES = 1;

/** Vault (Astra) — small consumable shop */
const ASTRA_SHOP_DAILY_REROLL_COST = 6;
const ASTRA_SHOP_STREAK_SHIELD_COST = 15;
const ASTRA_SHOP_FOCUS_SIP_COST = 4;

module.exports = {
  STAT_TAGS,
  STARTING_JOB_ID,
  NOVICE_JOB_PICK_MIN_LEVEL,
  DAILY_CORE_TASK_COUNT,
  DAILY_BONUS_TASK_COUNT,
  DAILY_MORNING_OFFER_COUNT,
  WEEKLY_REGULAR_QUEST_COUNT,
  WEEKLY_BOSS_QUEST_COUNT,
  STREAK_BONUS_EXP_PER_DAY,
  STREAK_BONUS_MAX_STREAK_DAYS,
  DAILY_BONUS_EXP_MULTIPLIER,
  DAILY_BONUS_TARGET_STEPS,
  STAT_POINTS_PER_LEVEL,
  RO_STAT_CAP,
  RO_STAT_KEYS,
  AMBIENT_MUSIC_PUBLIC_PATH,
  AMBIENT_MUSIC_VOLUME,
  SOFT_CURRENCY_NAME,
  QUEST_BOARD_POST_COST_ASTRA,
  QUEST_BOARD_ISSUER_RENOWN_PER_APPROVAL,
  QUEST_BOARD_MAX_ACTIVE_PER_USER,
  QUEST_BOARD_REWARD_EXP_MIN,
  QUEST_BOARD_REWARD_EXP_MAX,
  QUEST_BOARD_REWARD_ASTRA_MIN,
  QUEST_BOARD_REWARD_ASTRA_MAX,
  QUEST_BOARD_ISSUER_REWARD_ASTRA_MIN,
  QUEST_BOARD_ISSUER_REWARD_ASTRA_MAX,
  QUEST_BOARD_MAX_ACCEPTS_PER_DAY,
  QUEST_BOARD_MAX_PAIR_ACCEPTS_PER_DAY,
  QUEST_BOARD_MAX_ACTIVE_ACCEPTS,
  QUEST_BOARD_EXPIRE_REFUND_ASTRA,
  questPostRewardCapsForLevel,
  TRAIN_EXP_PER_SESSION,
  TRAIN_DAILY_MAX_SESSIONS,
  TRAIN_FOCUS_BONUS_PCT,
  TRAIN_FOCUS_CHARGES_PER_SESSION,
  TRAIN_FOCUS_MAX_CHARGES,
  ASTRA_SHOP_DAILY_REROLL_COST,
  ASTRA_SHOP_STREAK_SHIELD_COST,
  ASTRA_SHOP_FOCUS_SIP_COST,
};
