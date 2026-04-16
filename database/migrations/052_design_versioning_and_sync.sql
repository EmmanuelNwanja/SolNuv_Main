-- =====================================================
-- Migration 052: Design versioning + sync metadata
-- =====================================================

ALTER TABLE simulation_results
  ADD COLUMN IF NOT EXISTS design_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_simulation_results_project_design_run
  ON simulation_results(project_design_id, run_at DESC);

