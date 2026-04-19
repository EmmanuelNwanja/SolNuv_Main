-- 062_solar_resource_multi_source.sql
--
-- Adds a `sources` JSONB column to `solar_resource_cache` so we can record the
-- per-source breakdown (name, weight, fetched_at) when blending multiple
-- weather providers (NASA POWER + PVGIS, etc.). Older rows will simply have
-- NULL and are treated as single-source NASA POWER entries by the service.

ALTER TABLE solar_resource_cache
  ADD COLUMN IF NOT EXISTS sources JSONB;

COMMENT ON COLUMN solar_resource_cache.sources IS
  'Per-source contribution metadata for blended weather rows: [{name, weight, fetched_at}, ...]. NULL for legacy single-source rows.';
