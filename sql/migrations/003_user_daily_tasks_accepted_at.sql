-- Adds quest acceptance step (safe to run on existing DBs).
-- If column already exists (e.g. from updated schema.sql), migrate script ignores duplicate-column error.

ALTER TABLE user_daily_tasks
ADD COLUMN accepted_at TIMESTAMP NULL DEFAULT NULL COMMENT 'User took quest; NULL until Take quest' AFTER completed_at;
