-- =====================================================
-- SolNuv - Project Stage & Capacity Classification
-- 017: Extends project_status enum with draft/maintenance
--      and adds auto-calculated capacity columns.
-- =====================================================

-- 1. Add new lifecycle stage values to existing project_status ENUM.
--    'draft'       – planned / pre-installation
--    'maintenance' – under upgrade / maintenance work
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'maintenance';

-- 2. Add capacity columns to projects table.
--    capacity_kw       – total system capacity (panel kWp + battery kWh combined)
--    capacity_category – derived size tier: home | commercial | industrial_minigrid | utility
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS capacity_kw        DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS capacity_category  VARCHAR(30);

COMMENT ON COLUMN projects.capacity_kw IS
  'Total system capacity: sum(panel_watts * qty) / 1000  +  sum(battery_kwh * qty). '
  'Panels with no battery use 0 for battery side; batteries-only projects use 0 for panel side.';

COMMENT ON COLUMN projects.capacity_category IS
  'Derived tier: home (0.1–30 kW), commercial (>30–100 kW), '
  'industrial_minigrid (>100–1000 kW), utility (>1000 kW).';

CREATE INDEX IF NOT EXISTS idx_projects_capacity_category
  ON projects(capacity_category);
