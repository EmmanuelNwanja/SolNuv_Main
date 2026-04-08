-- 030: Add design_warnings JSONB column to simulation_results
-- Stores validation warnings generated during simulation (inverter undersized, BESS power low, etc.)

ALTER TABLE simulation_results
  ADD COLUMN IF NOT EXISTS design_warnings JSONB;

COMMENT ON COLUMN simulation_results.design_warnings IS 'Array of {type, severity, message} validation warnings from simulation';
