-- ============================================================
-- Migration 066: Field mappings for external integrations
-- ============================================================

ALTER TABLE external_integrations
  ADD COLUMN IF NOT EXISTS field_mappings jsonb NOT NULL DEFAULT '{}'::jsonb;
