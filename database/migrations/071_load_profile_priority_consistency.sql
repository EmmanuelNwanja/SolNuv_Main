-- ============================================================================
-- Migration 071: Load Profile Priority + Consistency Metadata
-- ============================================================================
-- Persists synthetic-profile intent/outcome so reports can communicate whether
-- annual and requested peak were fully compatible or required tradeoffs.

ALTER TABLE load_profiles
  ADD COLUMN IF NOT EXISTS synthetic_priority_mode TEXT,
  ADD COLUMN IF NOT EXISTS synthetic_requested_peak_kw DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS synthetic_achieved_peak_kw DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS synthetic_requested_annual_kwh DECIMAL(14,4),
  ADD COLUMN IF NOT EXISTS synthetic_achieved_annual_kwh DECIMAL(14,4),
  ADD COLUMN IF NOT EXISTS synthetic_warnings JSONB;

COMMENT ON COLUMN load_profiles.synthetic_priority_mode IS 'Synthetic generation priority mode: annual or peak';
COMMENT ON COLUMN load_profiles.synthetic_requested_peak_kw IS 'Requested target peak load (kW) used in synthetic generation';
COMMENT ON COLUMN load_profiles.synthetic_achieved_peak_kw IS 'Achieved peak load (kW) after synthetic profile shaping';
COMMENT ON COLUMN load_profiles.synthetic_requested_annual_kwh IS 'Requested annual load (kWh) used in synthetic generation';
COMMENT ON COLUMN load_profiles.synthetic_achieved_annual_kwh IS 'Achieved annual load (kWh) after synthetic profile shaping';
COMMENT ON COLUMN load_profiles.synthetic_warnings IS 'Array of warning strings for physically inconsistent annual/peak combinations';
