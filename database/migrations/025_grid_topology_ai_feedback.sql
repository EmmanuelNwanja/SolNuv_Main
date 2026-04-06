-- ============================================================
-- 025: Grid Topology Support + AI Expert Feedback
-- ============================================================
-- Adds system topology selection (grid-tied, grid-tied+BESS, off-grid, hybrid)
-- with topology-specific design parameters. Also adds AI expert feedback
-- to simulation results.

BEGIN;

-- 1. Add grid topology enum
DO $$ BEGIN
  CREATE TYPE grid_topology AS ENUM (
    'grid_tied',       -- PV only, no battery, grid always available
    'grid_tied_bess',  -- PV + Battery, grid as backup
    'off_grid',        -- No grid connection, PV + Battery mandatory
    'hybrid'           -- Grid + PV + Battery, can island during outages
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add topology & off-grid columns to project_designs
ALTER TABLE project_designs
  ADD COLUMN IF NOT EXISTS grid_topology grid_topology NOT NULL DEFAULT 'grid_tied_bess',
  ADD COLUMN IF NOT EXISTS autonomy_days DECIMAL(4,1) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS backup_generator_kw DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diesel_cost_per_litre DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grid_availability_pct DECIMAL(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS grid_outage_hours_day DECIMAL(4,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feed_in_tariff_per_kwh DECIMAL(10,4) DEFAULT 0;

-- 3. Add topology-specific result columns to simulation_results
ALTER TABLE simulation_results
  ADD COLUMN IF NOT EXISTS grid_topology grid_topology,
  ADD COLUMN IF NOT EXISTS unmet_load_kwh DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unmet_load_hours INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loss_of_load_pct DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autonomy_achieved_days DECIMAL(4,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diesel_avoided_litres DECIMAL(10,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS islanded_hours INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feed_in_revenue DECIMAL(14,2) DEFAULT 0;

-- 4. Add AI expert feedback columns to simulation_results
ALTER TABLE simulation_results
  ADD COLUMN IF NOT EXISTS ai_expert_feedback JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_feedback_edited TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_feedback_generated_at TIMESTAMPTZ DEFAULT NULL;

-- 5. Index for faster topology-filtered queries
CREATE INDEX IF NOT EXISTS idx_project_designs_topology
  ON project_designs(grid_topology);

COMMIT;
