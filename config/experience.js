/**
 * Level curve: first step to level 2 costs 25 total EXP; each further level-up costs more (quadratic ramp).
 * Matches RO-ish scaling without mirroring exact job tables.
 */

const MAX_LEVEL = 99;

/**
 * EXP required to go from `level` → `level` + 1 (while current level is `level`).
 * @param {number} level Current level (1..98)
 */
function expForLevelUp(level) {
  const L = Math.max(1, Math.min(MAX_LEVEL - 1, Math.floor(Number(level) || 1)));
  return Math.round(25 + (L - 1) * 12 + (L - 1) * (L - 1) * 2.5);
}

/**
 * Minimum total EXP at which the player is considered to have reached `targetLevel`.
 * @param {number} targetLevel 1..99
 */
function cumulativeExpAtStartOfLevel(targetLevel) {
  const t = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(targetLevel) || 1)));
  let sum = 0;
  for (let L = 1; L < t; L++) {
    sum += expForLevelUp(L);
  }
  return sum;
}

/**
 * @param {number} totalExp
 * @returns {number} Level in 1..MAX_LEVEL
 */
function levelFromTotalExp(totalExp) {
  const exp = Math.max(0, Number(totalExp) || 0);
  let level = 1;
  let cum = 0;
  while (level < MAX_LEVEL) {
    const need = expForLevelUp(level);
    if (exp < cum + need) break;
    cum += need;
    level++;
  }
  return level;
}

/**
 * Progress bar fill toward the *next* level (0–100).
 * @param {number} totalExp
 */
function expProgressPercent(totalExp) {
  const exp = Math.max(0, Number(totalExp) || 0);
  const L = levelFromTotalExp(exp);
  if (L >= MAX_LEVEL) return 100;
  const start = cumulativeExpAtStartOfLevel(L);
  const span = expForLevelUp(L);
  if (span <= 0) return 100;
  const mod = exp - start;
  return Math.min(100, Math.max(0, Math.round((mod / span) * 100)));
}

/**
 * EXP accumulated toward the next level vs amount needed (for UI like "50 / 100 EXP").
 * @returns {{ current: number, needed: number, capped: boolean }}
 */
function expTowardNextLevel(totalExp) {
  const exp = Math.max(0, Number(totalExp) || 0);
  const L = levelFromTotalExp(exp);
  if (L >= MAX_LEVEL) {
    return { current: 0, needed: 0, capped: true };
  }
  const start = cumulativeExpAtStartOfLevel(L);
  const needed = expForLevelUp(L);
  if (needed <= 0) {
    return { current: 0, needed: 0, capped: true };
  }
  const current = Math.min(needed, Math.max(0, exp - start));
  return { current, needed, capped: false };
}

module.exports = {
  MAX_LEVEL,
  expForLevelUp,
  cumulativeExpAtStartOfLevel,
  levelFromTotalExp,
  expProgressPercent,
  expTowardNextLevel,
};
