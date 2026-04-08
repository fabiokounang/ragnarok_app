-- In-app ambient music preference (0 = off, 1 = on when a track is configured).
USE reborn;

ALTER TABLE users
  ADD COLUMN music_enabled TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1=user wants BGM in webapp when file/env allows'
  AFTER stat_points_unspent;
