-- Migration 055: Leaderboard public display controls
-- Adds user-level controls for leaderboard identity privacy.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS leaderboard_public_display_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leaderboard_public_display_name VARCHAR(120);

COMMENT ON COLUMN users.leaderboard_public_display_enabled IS 'When true, allow public leaderboard to show a chosen display name.';
COMMENT ON COLUMN users.leaderboard_public_display_name IS 'Optional public name shown on leaderboard when enabled.';
