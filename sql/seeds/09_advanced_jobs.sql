-- Advanced (tier-2) jobs + progressions + quest pools copied from tier-1 parent.
-- Requires job_progressions.min_job_quests columns (npm run db:migrate-job-progression-reqs).
USE reborn;

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM job_progressions WHERE to_job_id BETWEEN 100 AND 115;
DELETE FROM job_task_types WHERE job_id BETWEEN 100 AND 115;
DELETE FROM job_weekly_regular WHERE job_id BETWEEN 100 AND 115;
DELETE FROM job_weekly_boss WHERE job_id BETWEEN 100 AND 115;
DELETE FROM jobs WHERE id BETWEEN 100 AND 115;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO jobs (id, slug, name, description, tier, parent_job_id, sort_order) VALUES
(100, 'lord_knight', 'Knight', 'Peak discipline and strength — elite path for the Swordsman who lives the standard.', 2, 2, 210),
(101, 'crusader', 'Crusader', 'Holy order energy in real life: protect your routine, your people, and your word with steel resolve.', 2, 2, 211),
(102, 'hunter', 'Hunter', 'Field craft and sustained precision — track targets, close distance, repeat with patience.', 2, 3, 220),
(103, 'sniper', 'Sniper', 'Elite focus: one shot quality — deep concentration and ruthless elimination of noise.', 2, 3, 221),
(104, 'wizard', 'Wizard', 'Advanced knowledge and strategy — systems thinking, pattern libraries, decisive theory-to-practice.', 2, 4, 230),
(105, 'sage', 'Sage', 'Wisdom over volume — synthesis, teaching, and long-arc mastery of your domain.', 2, 4, 231),
(106, 'priest', 'Priest', 'Emotional wisdom and healing leadership — hold space, guide others, keep the sanctuary.', 2, 5, 240),
(107, 'monk', 'Monk', 'Body-mind ascetic clarity — discipline through simplicity, breath, and deliberate practice.', 2, 5, 241),
(108, 'assassin_cross', 'Assassin', 'Elite execution speed — strike clean, leave no loose ends, compress time-to-done.', 2, 6, 250),
(109, 'stalker', 'Stalker', 'Adaptive hunter — read the field, reposition fast, win without burning out.', 2, 6, 251),
(110, 'creator', 'Creator', 'Product and narrative as art — ship signature work that carries your voice.', 2, 7, 260),
(111, 'business_master', 'Business Master', 'Advanced value creation and scaling — systems, leverage, and repeatable revenue.', 2, 7, 261),
(112, 'engineer', 'Engineer', 'Advanced builder — reliability, architecture, and products that survive reality.', 2, 8, 270),
(113, 'master_builder', 'Master Builder', 'Craft at scale — mentorship-level quality bar and end-to-end ownership.', 2, 8, 271),
(114, 'polymath', 'Polymath', 'Breadth with backbone — connect disciplines; Harmonist path evolved.', 2, 9, 280),
(115, 'pathwalker', 'Pathwalker', 'Integration over specialization — one life, many skills, coherent story.', 2, 9, 281);

-- Tier-1 → tier-2: level 10 on base class + 30 quests + 3 weekly boss clears + 7-day login streak
INSERT INTO job_progressions (from_job_id, to_job_id, min_level, min_job_quests, min_weekly_boss_wins, min_login_streak) VALUES
(2, 100, 10, 30, 3, 7), (2, 101, 10, 30, 3, 7),
(3, 102, 10, 30, 3, 7), (3, 103, 10, 30, 3, 7),
(4, 104, 10, 30, 3, 7), (4, 105, 10, 30, 3, 7),
(5, 106, 10, 30, 3, 7), (5, 107, 10, 30, 3, 7),
(6, 108, 10, 30, 3, 7), (6, 109, 10, 30, 3, 7),
(7, 110, 10, 30, 3, 7), (7, 111, 10, 30, 3, 7),
(8, 112, 10, 30, 3, 7), (8, 113, 10, 30, 3, 7),
(9, 114, 10, 30, 3, 7), (9, 115, 10, 30, 3, 7);

INSERT INTO job_task_types (job_id, task_type_id)
SELECT 100, task_type_id FROM job_task_types WHERE job_id = 2;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 101, task_type_id FROM job_task_types WHERE job_id = 2;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 102, task_type_id FROM job_task_types WHERE job_id = 3;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 103, task_type_id FROM job_task_types WHERE job_id = 3;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 104, task_type_id FROM job_task_types WHERE job_id = 4;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 105, task_type_id FROM job_task_types WHERE job_id = 4;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 106, task_type_id FROM job_task_types WHERE job_id = 5;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 107, task_type_id FROM job_task_types WHERE job_id = 5;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 108, task_type_id FROM job_task_types WHERE job_id = 6;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 109, task_type_id FROM job_task_types WHERE job_id = 6;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 110, task_type_id FROM job_task_types WHERE job_id = 7;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 111, task_type_id FROM job_task_types WHERE job_id = 7;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 112, task_type_id FROM job_task_types WHERE job_id = 8;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 113, task_type_id FROM job_task_types WHERE job_id = 8;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 114, task_type_id FROM job_task_types WHERE job_id = 9;
INSERT INTO job_task_types (job_id, task_type_id)
SELECT 115, task_type_id FROM job_task_types WHERE job_id = 9;

INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 100, task_type_id FROM job_weekly_regular WHERE job_id = 2;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 101, task_type_id FROM job_weekly_regular WHERE job_id = 2;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 102, task_type_id FROM job_weekly_regular WHERE job_id = 3;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 103, task_type_id FROM job_weekly_regular WHERE job_id = 3;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 104, task_type_id FROM job_weekly_regular WHERE job_id = 4;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 105, task_type_id FROM job_weekly_regular WHERE job_id = 4;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 106, task_type_id FROM job_weekly_regular WHERE job_id = 5;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 107, task_type_id FROM job_weekly_regular WHERE job_id = 5;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 108, task_type_id FROM job_weekly_regular WHERE job_id = 6;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 109, task_type_id FROM job_weekly_regular WHERE job_id = 6;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 110, task_type_id FROM job_weekly_regular WHERE job_id = 7;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 111, task_type_id FROM job_weekly_regular WHERE job_id = 7;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 112, task_type_id FROM job_weekly_regular WHERE job_id = 8;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 113, task_type_id FROM job_weekly_regular WHERE job_id = 8;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 114, task_type_id FROM job_weekly_regular WHERE job_id = 9;
INSERT INTO job_weekly_regular (job_id, task_type_id)
SELECT 115, task_type_id FROM job_weekly_regular WHERE job_id = 9;

INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 100, task_type_id FROM job_weekly_boss WHERE job_id = 2;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 101, task_type_id FROM job_weekly_boss WHERE job_id = 2;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 102, task_type_id FROM job_weekly_boss WHERE job_id = 3;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 103, task_type_id FROM job_weekly_boss WHERE job_id = 3;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 104, task_type_id FROM job_weekly_boss WHERE job_id = 4;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 105, task_type_id FROM job_weekly_boss WHERE job_id = 4;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 106, task_type_id FROM job_weekly_boss WHERE job_id = 5;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 107, task_type_id FROM job_weekly_boss WHERE job_id = 5;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 108, task_type_id FROM job_weekly_boss WHERE job_id = 6;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 109, task_type_id FROM job_weekly_boss WHERE job_id = 6;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 110, task_type_id FROM job_weekly_boss WHERE job_id = 7;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 111, task_type_id FROM job_weekly_boss WHERE job_id = 7;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 112, task_type_id FROM job_weekly_boss WHERE job_id = 8;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 113, task_type_id FROM job_weekly_boss WHERE job_id = 8;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 114, task_type_id FROM job_weekly_boss WHERE job_id = 9;
INSERT INTO job_weekly_boss (job_id, task_type_id)
SELECT 115, task_type_id FROM job_weekly_boss WHERE job_id = 9;
