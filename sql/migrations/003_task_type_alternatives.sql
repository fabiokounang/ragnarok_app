-- Add swap-in alternatives for task types (gym vs home, etc.). Safe to run once.
-- Target DB: set via migrate script (DB_NAME in .env).

ALTER TABLE task_types
  ADD COLUMN alternatives JSON NULL COMMENT 'Swap-in options (gym vs home, equipment, etc.)' AFTER description;
