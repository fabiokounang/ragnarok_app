/**
 * Six quest pillars for daily UI (maps from task slug + stat_tag; no DB column required).
 * Body · Mind · Focus · Money · Craft · Recovery
 */

/** @typedef {{ id: string, label: string, hint: string }} DailyPillar */

/** @type {Record<string, DailyPillar>} */
const PILLARS = {
  body: { id: 'body', label: 'Body', hint: 'Movement, strength, energy' },
  mind: { id: 'mind', label: 'Mind', hint: 'Learning, knowledge, ideas' },
  focus: { id: 'focus', label: 'Focus', hint: 'Attention, discipline, deep work' },
  money: { id: 'money', label: 'Money', hint: 'Value, sales, finances' },
  craft: { id: 'craft', label: 'Craft', hint: 'Build, design, ship' },
  recovery: { id: 'recovery', label: 'Recovery', hint: 'Rest, emotion, regulation' },
};

const PILLAR_LIST = Object.values(PILLARS);

/**
 * @param {string | null | undefined} slug
 * @param {string | null | undefined} statTag
 * @returns {DailyPillar}
 */
function pillarForTask(slug, statTag) {
  const s = String(slug || '').toLowerCase();
  const tag = String(statTag || '').toLowerCase();

  if (s.startsWith('mer_') || s === 'arnd_money') return PILLARS.money;
  if (s.startsWith('blk_')) return PILLARS.craft;
  if (s === 'arnd_physical' || s === 'arnd_steps') return PILLARS.body;
  if (s === 'arnd_learning') return PILLARS.mind;
  if (s === 'arnd_mental') return PILLARS.recovery;

  if (tag === 'strength' || tag === 'endurance' || tag === 'agility' || tag === 'vitality') {
    return PILLARS.body;
  }
  if (tag === 'intelligence') return PILLARS.mind;
  if (tag === 'precision' || tag === 'discipline') return PILLARS.focus;
  if (tag === 'spirit' || tag === 'balance') return PILLARS.recovery;

  return PILLARS.focus;
}

module.exports = {
  PILLARS,
  PILLAR_LIST,
  pillarForTask,
};
