-- Novice → tier-1 (min_level 10; no extra reqs). Tier-1 → tier-2: see 09_advanced_jobs.sql after migrate-013.
USE reborn;

INSERT INTO job_progressions (from_job_id, to_job_id, min_level, min_job_quests, min_weekly_boss_wins, min_login_streak) VALUES
(1, 2, 10, 0, 0, 0), (1, 3, 10, 0, 0, 0), (1, 4, 10, 0, 0, 0), (1, 5, 10, 0, 0, 0),
(1, 6, 10, 0, 0, 0), (1, 7, 10, 0, 0, 0), (1, 8, 10, 0, 0, 0), (1, 9, 10, 0, 0, 0);
