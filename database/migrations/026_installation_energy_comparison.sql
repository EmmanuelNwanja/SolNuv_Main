-- ============================================================
-- 026: Installation Types + Energy Comparison Fields
-- ============================================================
-- Adds installation type selection to project designs and stores
-- energy source comparison results (solar vs grid vs diesel vs petrol).

BEGIN;

-- 1. Add installation type enum
DO $$ BEGIN
  CREATE TYPE installation_type AS ENUM (
    'rooftop_flat',      -- Flush-mounted on flat roof
    'rooftop_tilted',    -- Tilted racks on roof
    'ground_fixed',      -- Fixed-tilt ground mount
    'ground_tracker',    -- Single-axis tracker ground mount
    'carport',           -- Elevated canopy/carport
    'bipv',              -- Building-integrated PV
    'floating'           -- Floating solar on water
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add installation type and DC/AC ratio to project_designs
ALTER TABLE project_designs
  ADD COLUMN IF NOT EXISTS installation_type installation_type NOT NULL DEFAULT 'rooftop_tilted',
  ADD COLUMN IF NOT EXISTS dc_ac_ratio DECIMAL(4,2) DEFAULT 1.20,
  ADD COLUMN IF NOT EXISTS diesel_price_per_litre DECIMAL(10,2) DEFAULT 1100,
  ADD COLUMN IF NOT EXISTS petrol_price_per_litre DECIMAL(10,2) DEFAULT 700,
  ADD COLUMN IF NOT EXISTS fuel_escalation_pct DECIMAL(5,2) DEFAULT 10.0,
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'NG';

-- 3. Add energy comparison result columns to simulation_results
ALTER TABLE simulation_results
  ADD COLUMN IF NOT EXISTS installation_type installation_type,
  ADD COLUMN IF NOT EXISTS energy_comparison JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS co2_avoided_tonnes DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diesel_annual_cost DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS petrol_annual_cost DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grid_only_annual_cost DECIMAL(14,2) DEFAULT 0;

-- 4. Index for installation type queries
CREATE INDEX IF NOT EXISTS idx_project_designs_installation_type
  ON project_designs(installation_type);

COMMIT;
