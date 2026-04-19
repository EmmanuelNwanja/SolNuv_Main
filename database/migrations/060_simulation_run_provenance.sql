-- =====================================================
-- Migration 060: Simulation run provenance + extended metrics
-- =====================================================
-- Adds reproducibility metadata and a general-purpose JSONB for engine outputs
-- that don't yet warrant their own columns (loss waterfall, financial risk bands,
-- tariff snapshots, etc.). Nullable so existing rows remain valid.

ALTER TABLE simulation_results
  ADD COLUMN IF NOT EXISTS run_provenance JSONB,
  ADD COLUMN IF NOT EXISTS extended_metrics JSONB;

COMMENT ON COLUMN simulation_results.run_provenance IS
  'Reproducibility metadata for this run: { engine_version, inputs_hash, weather: {source, fetched_at, lat_rounded, lon_rounded, cache_hit}, tariff: {tariff_structure_id, as_of, snapshot, band_hash} }.';

COMMENT ON COLUMN simulation_results.extended_metrics IS
  'Engine outputs that do not yet have dedicated columns (e.g. pv_loss_waterfall, financial_risk). Shape is versioned by run_provenance.engine_version.';
