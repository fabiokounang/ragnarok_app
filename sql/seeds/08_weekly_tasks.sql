-- Weekly missions: class pools (Novice 71–73, Swordsman 76–79, Archer 80–83, Acolyte 84–87, Rogue 88–91, Merchant 92–95, Blacksmith 96–99) + shared 51–52 for Mage/All-Rounder.
-- Requires task_types.weekly_target_steps (npm run db:migrate-weekly-target on existing DBs).
USE reborn;

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM user_weekly_tasks WHERE task_type_id BETWEEN 51 AND 60 OR task_type_id IN (71, 72, 73, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99);
DELETE FROM job_weekly_boss WHERE job_id BETWEEN 1 AND 9;
DELETE FROM job_weekly_regular WHERE job_id BETWEEN 1 AND 9;
DELETE FROM task_types WHERE id BETWEEN 51 AND 60 OR id IN (71, 72, 73, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99);
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO task_types (id, slug, name, description, alternatives, stat_tag, base_exp, sort_order, quest_kind) VALUES
(51, 'wk_move_3x', 'Weekly: move three times', 'Complete at least three real movement sessions this week (gym, run, long walk, sport — honor system).',
 NULL, 'endurance', 40, 510, 'weekly'),
(52, 'wk_learn_build', 'Weekly: learn or build', 'At least 5 hours total on learning or shipping (course, reading, coding, creative work — tally honestly).',
 NULL, 'intelligence', 40, 520, 'weekly'),
(53, 'boss_swordsman', 'Weekly boss: Iron week', 'No skipped planned workouts for the full week — you showed up for every session you scheduled (honor system). Honorable alternate: a clear personal best in the gym this week (weight, reps, or volume).',
 NULL, 'strength', 120, 531, 'weekly_boss'),
(54, 'boss_archer', 'Weekly boss: Bullseye week', 'Either: five different days this week with a real deep-work session — OR one important project milestone finished with sustained, distraction-aware focus. One honest completion.',
 NULL, 'precision', 120, 541, 'weekly_boss'),
(55, 'boss_mage', 'Weekly boss: Grimoire week', 'Boss quest — finish one book section or full course module + written summary (10+ bullets).',
 NULL, 'intelligence', 115, 551, 'weekly_boss'),
(56, 'boss_acolyte', 'Weekly boss: Sanctuary week', 'Either: a 7-day peace streak — each day includes meditation, prayer, or quiet reflection. OR: every night you hit enough sleep plus a calm wind-down routine all week. One honest completion.',
 NULL, 'spirit', 120, 561, 'weekly_boss'),
(57, 'boss_rogue', 'Weekly boss: Blitz week', 'Either: finally finish one task you have delayed for weeks — OR one full action-only productivity sprint day (decide fast, execute, minimal rumination). One honest completion.',
 NULL, 'agility', 120, 571, 'weekly_boss'),
(58, 'boss_merchant', 'Weekly boss: Ledger week', 'Either: launch one new product, package, or clear offer/landing page customers can buy from — OR your first profitable week (income exceeded expenses with honest tracking). One completion.',
 NULL, 'discipline', 150, 581, 'weekly_boss'),
(59, 'boss_blacksmith', 'Weekly boss: Forge week', 'Either: ship one finished mini project end-to-end (usable artifact) — OR complete one full product page, module, or major flow slice you can demo. One honest completion.',
 NULL, 'intelligence', 150, 591, 'weekly_boss'),
(60, 'boss_balanced', 'Weekly boss: All pillars', 'Boss quest — touch all four: physical, mental/mindful, money, learning — each with a real win this week.',
 NULL, 'balance', 120, 601, 'weekly_boss');

INSERT INTO task_types (id, slug, name, description, alternatives, stat_tag, base_exp, sort_order, quest_kind, weekly_target_steps) VALUES
(71, 'nov_wk_move_5d', 'Weekly: 5 movement days', 'This week: log 5 different days with real movement (walk 20+ min, workout, sport — honest tally, one tap per day you earn it).',
 NULL, 'endurance', 55, 705, 'weekly', 5),
(72, 'nov_wk_read_5d', 'Weekly: 5 reading days', 'This week: 5 days where you read 5–10+ pages or 15+ minutes of focused reading (not feeds).',
 NULL, 'intelligence', 55, 706, 'weekly', 5),
(73, 'nov_wk_boss_focus_day', 'Weekly boss: Zero-procrastination day', 'Pick one day this week: start priorities early, no avoidance spirals, end with your main outcomes done — one honest completion when you nailed it.',
 NULL, 'discipline', 100, 707, 'weekly_boss', 1);

INSERT INTO task_types (id, slug, name, description, alternatives, stat_tag, base_exp, sort_order, quest_kind, weekly_target_steps) VALUES
(76, 'wk_sn_gym_4', 'Weekly: 4 strength sessions', 'Log 4 separate strength or structured resistance sessions this week — gym or serious home workout (one tap per day you actually trained).',
 NULL, 'strength', 48, 708, 'weekly', 4),
(77, 'wk_sn_protein_5', 'Weekly: protein target 5 days', 'Hit your protein target on 5 different days (grams or g/kg you committed to — track honestly, one tap per qualifying day).',
 NULL, 'vitality', 45, 709, 'weekly', 5),
(78, 'wk_sn_morning_6', 'Weekly: morning routine 6 days', 'Run your morning routine on 6 days — whatever you defined: wake window, water, light movement, first priority block, etc.',
 NULL, 'discipline', 50, 710, 'weekly', 6),
(79, 'wk_sn_avoided_task', 'Weekly: the task you avoided', 'Finish one difficult or overdue task you have been avoiding — one completion when it is truly off your back.',
 NULL, 'discipline', 40, 711, 'weekly', 1);

INSERT INTO task_types (id, slug, name, description, alternatives, stat_tag, base_exp, sort_order, quest_kind, weekly_target_steps) VALUES
(80, 'wk_arc_deep_5', 'Weekly: 5 deep work sessions', 'Log 5 separate days with at least one real deep-work block (45–60+ min, honest) this week — one tap per qualifying day.',
 NULL, 'precision', 52, 712, 'weekly', 5),
(81, 'wk_arc_screen_budget_5', 'Weekly: screen distraction budget', 'Stay under a limit you chose at the week start (opens/day, scroll minutes, or check count) on 5 days — honor system, one tap per compliant day.',
 NULL, 'discipline', 48, 713, 'weekly', 5),
(82, 'wk_arc_milestone', 'Weekly: focused milestone', 'Ship one clear project milestone with high focus — a checkpoint you can name (feature, chapter, module, deliverable). One completion.',
 NULL, 'precision', 45, 714, 'weekly', 1),
(83, 'wk_arc_skill_days_4', 'Weekly: 4 skill days', 'Four different days with at least 1 hour of deliberate skill practice (code, design, writing, study — same standards as your dailies).',
 NULL, 'intelligence', 50, 715, 'weekly', 4);

INSERT INTO task_types (id, slug, name, description, alternatives, stat_tag, base_exp, sort_order, quest_kind, weekly_target_steps) VALUES
(84, 'wk_aco_meditate_5', 'Weekly: 5 meditation days', 'Five separate days with at least 10 minutes of meditation or seated prayer (one tap per day you actually did it).',
 NULL, 'spirit', 52, 716, 'weekly', 5),
(85, 'wk_aco_journal_3', 'Weekly: 3 journaling sessions', 'Three focused journaling sessions this week — gratitude, emotional check-in, or reflection (15+ minutes each, honest).',
 NULL, 'spirit', 46, 717, 'weekly', 3),
(86, 'wk_aco_calm_day', 'Weekly: one low-stimulation day', 'One full day of low-stimulation calm: minimal news/social, gentle pace, quiet meals — one completion when you honored it.',
 NULL, 'balance', 48, 718, 'weekly', 1),
(87, 'wk_aco_sleep_7', 'Weekly: 7 nights enough sleep', 'Seven nights where you got the sleep duration you need (define “enough” honestly at week start — one tap per qualifying morning).',
 NULL, 'discipline', 55, 719, 'weekly', 7);

INSERT INTO task_types (id, slug, name, description, alternatives, stat_tag, base_exp, sort_order, quest_kind, weekly_target_steps) VALUES
(88, 'wk_rog_delayed_10', 'Weekly: 10 delayed micro-tasks', 'Knock out 10 small tasks you kept delaying (each should be quick — honest tally, one tap per task finished).',
 NULL, 'agility', 58, 720, 'weekly', 10),
(89, 'wk_rog_action_first_day', 'Weekly: one action-first day', 'One full day in action-first mode: bias every block toward starting and shipping, not re-planning — one completion when you lived it.',
 NULL, 'precision', 52, 721, 'weekly', 1),
(90, 'wk_rog_hiit_3', 'Weekly: 3 HIIT sessions', 'Three separate HIIT sessions this week (15+ minutes each — one tap per session day).',
 NULL, 'endurance', 50, 722, 'weekly', 3),
(91, 'wk_rog_fast_open_5', 'Weekly: 5 fast starts', 'Five days where your first meaningful work action started within 10 minutes of sitting down to work (honor system).',
 NULL, 'agility', 51, 723, 'weekly', 5);

INSERT INTO task_types (id, slug, name, description, alternatives, stat_tag, base_exp, sort_order, quest_kind, weekly_target_steps) VALUES
(92, 'wk_mer_posts_5', 'Weekly: 5 sales posts', 'Publish five pieces of sales- or marketing-oriented content this week (posts, shorts, emails — one tap per publish).',
 NULL, 'discipline', 56, 724, 'weekly', 5),
(93, 'wk_mer_products_3', 'Weekly: 3 new listings', 'Add or fully refresh three products, SKUs, packages, or service lines this week (honest completions).',
 NULL, 'discipline', 54, 725, 'weekly', 3),
(94, 'wk_mer_close_sale', 'Weekly: close one sale', 'Complete at least one real sale or paid agreement this week (same bar as your daily “close sale” — one completion).',
 NULL, 'discipline', 68, 726, 'weekly', 1),
(95, 'wk_mer_track_spend_7', 'Weekly: track all spending 7 days', 'Seven days where every spend is logged (however you track — one tap per day you captured everything).',
 NULL, 'discipline', 62, 727, 'weekly', 7);

INSERT INTO task_types (id, slug, name, description, alternatives, stat_tag, base_exp, sort_order, quest_kind, weekly_target_steps) VALUES
(96, 'wk_blk_ship_feature', 'Weekly: ship one usable feature', 'Deliver one feature that is actually usable by someone — merged, deployed, or shared build; not just a stub (one completion).',
 NULL, 'intelligence', 62, 728, 'weekly', 1),
(97, 'wk_blk_bugs_5', 'Weekly: fix 5 bugs', 'Close five real bugs or papercuts this week (one tap per fix shipped).',
 NULL, 'intelligence', 58, 729, 'weekly', 5),
(98, 'wk_blk_landing_page', 'Weekly: one landing page', 'Ship one landing or marketing page: copy, layout, and primary CTA wired or deployable.',
 NULL, 'precision', 56, 730, 'weekly', 1),
(99, 'wk_blk_prototype_tool', 'Weekly: prototype or tool', 'Build one prototype, internal tool, or script that solves a concrete problem — runnable or clickable proof.',
 NULL, 'intelligence', 60, 731, 'weekly', 1);

-- Novice + class weeklies; Mage + All-Rounder: shared pillars + class boss
INSERT INTO job_weekly_regular (job_id, task_type_id) VALUES
(1, 71), (1, 72),
(2, 76), (2, 77), (2, 78), (2, 79),
(3, 80), (3, 81), (3, 82), (3, 83),
(4, 51), (4, 52),
(5, 84), (5, 85), (5, 86), (5, 87),
(6, 88), (6, 89), (6, 90), (6, 91),
(7, 92), (7, 93), (7, 94), (7, 95),
(8, 96), (8, 97), (8, 98), (8, 99),
(9, 51), (9, 52);

INSERT INTO job_weekly_boss (job_id, task_type_id) VALUES
(1, 73),
(2, 53),
(3, 54),
(4, 55),
(5, 56),
(6, 57),
(7, 58),
(8, 59),
(9, 60);

ALTER TABLE task_types AUTO_INCREMENT = 200;
