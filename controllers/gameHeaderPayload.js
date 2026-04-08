const { expProgressPercent, levelFromTotalExp, expTowardNextLevel } = require('../config/experience');

/** @param {object|undefined} row user row from findWithJobById */
function headerPayloadFromUserRow(row) {
  if (!row) return null;
  const n = (v, d) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  };
  const totalExp = Number(row.totalExp) || 0;
  const level = levelFromTotalExp(totalExp);
  const expBar = expTowardNextLevel(totalExp);
  const expPct = Math.min(100, Math.max(0, expProgressPercent(totalExp)));
  const expMaxLvl = expBar.capped;
  const expIn = Math.max(0, Number(expBar.current) || 0);
  const expNeed = Math.max(0, Number(expBar.needed) || 0);
  const expCountTxt =
    expMaxLvl ? 'Max level' : expNeed > 0 ? `${expIn}/${expNeed} EXP` : `${expPct}%`;
  const statOrder = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
  const statLabels = { str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DEX', luk: 'LUK' };
  const statList = statOrder.map((k) => ({
    key: k,
    label: statLabels[k],
    v: n(row[`stat_${k}`], 1),
  }));
  statList.sort((a, b) => {
    if (b.v !== a.v) return b.v - a.v;
    return statOrder.indexOf(a.key) - statOrder.indexOf(b.key);
  });
  const topStats = statList.slice(0, 3).map((s) => ({ label: s.label, v: s.v }));
  return {
    level,
    displayName: row.displayName,
    job: row.jobName,
    expPct,
    expCountTxt,
    expMaxLevel: expMaxLvl,
    statPointsUnspent: n(row.stat_points_unspent, 0),
    topStats,
    astraBalance: Math.max(0, n(row.astra_balance, 0)),
  };
}

module.exports = { headerPayloadFromUserRow };
