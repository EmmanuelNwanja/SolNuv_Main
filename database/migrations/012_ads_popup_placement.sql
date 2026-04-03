-- ============================================================
-- Migration 012: Add popup placement to ads check constraint
-- ============================================================

ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_placement_check;

ALTER TABLE ads ADD CONSTRAINT ads_placement_check
  CHECK (placement IN ('sidebar','banner','in-feed','footer','blog-top','blog-bottom','popup'));
