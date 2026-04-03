-- ============================================================
-- Migration 011: Popup Ad View Limits
-- Adds max_total_views and max_unique_accounts columns to ads
-- ============================================================

ALTER TABLE ads ADD COLUMN IF NOT EXISTS max_total_views     int;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS max_unique_accounts int;

COMMENT ON COLUMN ads.max_total_views     IS 'Stop serving this popup ad after this many total impressions (NULL = unlimited)';
COMMENT ON COLUMN ads.max_unique_accounts IS 'Stop serving this popup ad after this many distinct user_id impressions (NULL = unlimited)';
