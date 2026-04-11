-- Migration 045: Impact Score Redesign — new leaderboard_cache columns
-- Adds platform-activity dimensions to the leaderboard cache for the
-- rebalanced impact scoring formula.

ALTER TABLE leaderboard_cache
  ADD COLUMN IF NOT EXISTS designs_completed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_conversations_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saved_calculations_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_verified         BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN leaderboard_cache.designs_completed_count  IS 'Number of project designs marked as completed by this user.';
COMMENT ON COLUMN leaderboard_cache.ai_conversations_count   IS 'Number of completed AI agent conversations by this user.';
COMMENT ON COLUMN leaderboard_cache.saved_calculations_count IS 'Number of saved calculations created by this user.';
COMMENT ON COLUMN leaderboard_cache.account_verified         IS 'Whether the user account holds a verified status at the time of the last leaderboard refresh.';
