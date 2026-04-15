-- ============================================================================
-- Migration 050: Dynamic NERC rule configuration
-- Adds updateable threshold table used by triage logic.
-- ============================================================================

CREATE TABLE IF NOT EXISTS nerc_rule_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  permit_threshold_kw NUMERIC(12,2) NOT NULL DEFAULT 100,
  annual_reporting_threshold_kw NUMERIC(12,2) NOT NULL DEFAULT 1000,
  net_metering_min_kw NUMERIC(12,2) NOT NULL DEFAULT 50,
  net_metering_max_kw NUMERIC(12,2) NOT NULL DEFAULT 5000,
  net_metering_injection_cap_pct NUMERIC(5,2) NOT NULL DEFAULT 30,
  regulation_version TEXT NOT NULL DEFAULT 'NERC-R-001-2026',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nerc_rule_config_active ON nerc_rule_config(is_active);

DO $$
BEGIN
  INSERT INTO nerc_rule_config (
    rule_name,
    permit_threshold_kw,
    annual_reporting_threshold_kw,
    net_metering_min_kw,
    net_metering_max_kw,
    net_metering_injection_cap_pct,
    regulation_version,
    is_active
  )
  VALUES (
    'default_nerc_binary_thresholds',
    100,
    1000,
    50,
    5000,
    30,
    'NERC-R-001-2026',
    TRUE
  )
  ON CONFLICT (rule_name) DO UPDATE
    SET permit_threshold_kw = EXCLUDED.permit_threshold_kw,
        annual_reporting_threshold_kw = EXCLUDED.annual_reporting_threshold_kw,
        net_metering_min_kw = EXCLUDED.net_metering_min_kw,
        net_metering_max_kw = EXCLUDED.net_metering_max_kw,
        net_metering_injection_cap_pct = EXCLUDED.net_metering_injection_cap_pct,
        regulation_version = EXCLUDED.regulation_version,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_nerc_rule_config_updated
    BEFORE UPDATE ON nerc_rule_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
