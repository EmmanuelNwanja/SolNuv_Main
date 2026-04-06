-- =====================================================
-- SolNuv Migration 025 - AI Geo Verification & Device GPS
-- Adds device_gps geo_source option, confidence score,
-- and verification metadata for AI-assisted verification.
-- =====================================================

-- 1. Expand geo_source check constraint to include 'device_gps'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_geo_source_check;
ALTER TABLE projects ADD CONSTRAINT projects_geo_source_check
  CHECK (geo_source IN ('image_exif', 'manual', 'device_gps', 'none'));

-- 2. Add AI verification metadata columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS geo_confidence_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS geo_verification_method VARCHAR(30),
  ADD COLUMN IF NOT EXISTS geo_verification_details JSONB;

-- geo_verification_method: 'address_match', 'satellite', 'device_proximity', 'admin_manual'
-- geo_verification_details: { address_geocoded: {lat, lon}, distance_m: 150, ... }

-- 3. Index for filtering by verification confidence
CREATE INDEX IF NOT EXISTS idx_projects_geo_confidence ON projects(geo_confidence_pct);

-- 4. Platform config key-value store (for AI-managed settings like tariff band overrides)
CREATE TABLE IF NOT EXISTS platform_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
