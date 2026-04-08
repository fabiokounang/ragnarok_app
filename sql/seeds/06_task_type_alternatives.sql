-- v2: alternatives are defined inline in 02_task_types.sql.
USE reborn;

UPDATE jobs SET pick_count = COALESCE(pick_count, 0) WHERE 1 = 0;
