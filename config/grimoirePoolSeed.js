'use strict';

/**
 * Static catalog + daily-pick pool definitions used when seeding Grimoire into MySQL.
 * Runtime reads pools from DB (see models/grimoireModel.js).
 */

/** @type {Array<{ id: string, title: string, deck: string, articleSlugs: string[] }>} */
const CATEGORIES = [
  {
    id: 'it',
    title: 'IT & computing',
    deck: 'What computers are, how the internet works, cloud, security, careers — long, detailed articles.',
    articleSlugs: [
      'it_computer_what',
      'it_software_vs_hardware',
      'it_internet_what',
      'it_internet_how_works',
      'it_web_browsers',
      'it_cloud_simple',
      'it_security_basics',
      'it_careers_intro',
    ],
  },
  {
    id: 'business',
    title: 'Business',
    deck: 'Starting from zero, validation, running a small business, cash flow, marketing, legal shapes — plain language.',
    articleSlugs: [
      'biz_start_from_scratch',
      'biz_validate_idea',
      'biz_run_small_daily',
      'biz_cash_flow',
      'biz_marketing_minimal',
      'biz_structure_simple',
    ],
  },
  {
    id: 'economy',
    title: 'Economy',
    deck: 'What an economy is, supply and demand, money, GDP, government, trade — news becomes easier to read.',
    articleSlugs: [
      'eco_what_economy',
      'eco_supply_demand',
      'eco_money_inflation',
      'eco_gdp_growth',
      'eco_government_role',
      'eco_trade_basics',
    ],
  },
  {
    id: 'life',
    title: 'Mind, habits & learning',
    deck: 'Brain health, discipline, kindness, reading, memory, planning, attention — skills behind every quest.',
    articleSlugs: [
      'life_brain_health',
      'life_discipline',
      'life_kindness',
      'life_reading_mind',
      'life_memory_learning',
      'life_planning',
      'life_attention',
    ],
  },
];

/** Old single-page topic keys → article slugs (URLs / bookmarks). */
const LEGACY_ALIASES = {
  brain: 'life_brain_health',
  discipline: 'life_discipline',
  kindness: 'life_kindness',
  reading_mind: 'life_reading_mind',
  learning_memory: 'life_memory_learning',
  planning_decisions: 'life_planning',
  attention_world: 'life_attention',
  it_basics: 'it_computer_what',
  economy_basics: 'eco_what_economy',
  business_basics: 'biz_start_from_scratch',
};

const LIFE_TASK_SLUGS = [
  'arc_skill_hour',
  'mg_read_book',
  'mg_watch_course',
  'mg_write_insight',
  'mg_learn_ai',
  'mg_reflect_learn',
  'mg_mind_map',
  'mer_offer_or_lesson',
  'mer_listing_polish',
  'arnd_learning',
  'nov_read_pages',
];
const ECO_TASK_SLUGS = [
  'mer_product_upload',
  'mer_marketing_post',
  'mer_lead_message',
  'mer_make_sale',
  'mer_finance_track_day',
  'arnd_money',
];
const IT_TASK_SLUGS = [
  'blk_feature_small',
  'blk_bug_fix',
  'blk_ui_section',
  'blk_refactor_file',
  'blk_doc_note',
  'blk_design_or_proto',
  'blk_system_pass',
];

/**
 * @param {string[]} allSlugsInBrowseOrder category order = CATEGORIES, then each articleSlugs
 * @returns {Record<string, string[]>}
 */
function buildPools(allSlugsInBrowseOrder) {
  const lifeCat = CATEGORIES.find((c) => c.id === 'life');
  const ecoCat = CATEGORIES.find((c) => c.id === 'economy');
  const bizCat = CATEGORIES.find((c) => c.id === 'business');
  const itCat = CATEGORIES.find((c) => c.id === 'it');
  if (!lifeCat || !ecoCat || !bizCat || !itCat) {
    throw new Error('[grimoirePoolSeed] Missing category');
  }
  const LIFE_SLUGS = [...lifeCat.articleSlugs];
  const ECO_BIZ_SLUGS = [...ecoCat.articleSlugs, ...bizCat.articleSlugs];
  const IT_SLUGS = [...itCat.articleSlugs];

  /** @type {Record<string, string[]>} */
  const POOLS = {
    int_spell_read: [...LIFE_SLUGS],
    int_cast_lesson: [
      'life_discipline',
      'life_memory_learning',
      'life_brain_health',
      'life_reading_mind',
      'life_attention',
    ],
    int_map_day: [...ECO_BIZ_SLUGS],
    default: [...allSlugsInBrowseOrder],
  };

  for (const s of LIFE_TASK_SLUGS) POOLS[s] = [...LIFE_SLUGS];
  for (const s of ECO_TASK_SLUGS) POOLS[s] = [...ECO_BIZ_SLUGS];
  for (const s of IT_TASK_SLUGS) POOLS[s] = [...IT_SLUGS];

  return POOLS;
}

module.exports = {
  CATEGORIES,
  LEGACY_ALIASES,
  buildPools,
};
