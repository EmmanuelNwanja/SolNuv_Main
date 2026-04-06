-- ============================================================================
-- Migration 024: Solar Design, Modelling & Analysis System
-- Adds tariff engine, load profiles, project designs, simulation results,
-- and public report sharing — enabling full PV+BESS feasibility studies.
-- ============================================================================

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tariff_type AS ENUM ('tou', 'flat', 'demand', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE load_profile_source AS ENUM ('upload', 'manual', 'synthetic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pv_generation_source AS ENUM ('calculated', 'helioscope');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bess_dispatch_strategy AS ENUM ('self_consumption', 'tou_arbitrage', 'peak_shave', 'backup');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE financing_type AS ENUM ('cash', 'loan', 'ppa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 1. TARIFF STRUCTURES ───────────────────────────────────────────────────
-- Multi-country TOU tariff definitions with seasons and periods.
-- user_id NULL = system template (seeded); non-null = user-created custom tariff.

CREATE TABLE IF NOT EXISTS tariff_structures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  country         TEXT NOT NULL DEFAULT 'NG',
  utility_name    TEXT,                                 -- e.g. 'Eskom', 'Ikeja DisCo'
  tariff_name     TEXT NOT NULL,                        -- e.g. 'Megaflex 2025/26'
  tariff_type     tariff_type NOT NULL DEFAULT 'tou',
  currency        TEXT NOT NULL DEFAULT 'NGN',          -- ISO 4217
  -- Seasons config: [{key: 'low_demand', label: 'Low Demand', months: [9,10,11,12,1,2,3,4,5]}, ...]
  seasons         JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_template     BOOLEAN NOT NULL DEFAULT FALSE,       -- true for system-seeded templates
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tariff_structures_user ON tariff_structures(user_id);
CREATE INDEX IF NOT EXISTS idx_tariff_structures_company ON tariff_structures(company_id);
CREATE INDEX IF NOT EXISTS idx_tariff_structures_template ON tariff_structures(is_template) WHERE is_template = TRUE;


-- ─── 2. TARIFF RATES ────────────────────────────────────────────────────────
-- Rate per TOU period per season.

CREATE TABLE IF NOT EXISTS tariff_rates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_structure_id  UUID NOT NULL REFERENCES tariff_structures(id) ON DELETE CASCADE,
  season_key           TEXT NOT NULL,                     -- matches seasons[].key
  period_name          TEXT NOT NULL,                     -- 'peak', 'standard', 'off_peak'
  -- Hours as array of ranges: [[7,10],[18,21]] = 07:00-10:00 and 18:00-21:00
  weekday_hours        JSONB NOT NULL DEFAULT '[]'::jsonb,
  saturday_hours       JSONB NOT NULL DEFAULT '[]'::jsonb,
  sunday_hours         JSONB NOT NULL DEFAULT '[]'::jsonb,
  rate_per_kwh         DECIMAL(10,4) NOT NULL,            -- in tariff currency
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tariff_rates_structure ON tariff_rates(tariff_structure_id);


-- ─── 3. TARIFF ANCILLARY CHARGES ────────────────────────────────────────────
-- Demand charges, network fees, daily charges, etc.

CREATE TABLE IF NOT EXISTS tariff_ancillary_charges (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_structure_id  UUID NOT NULL REFERENCES tariff_structures(id) ON DELETE CASCADE,
  charge_type          TEXT NOT NULL,                     -- 'network_capacity', 'gen_capacity', 'legacy', 'peak_demand', 'netw_demand', 'ancillary', 'daily'
  charge_label         TEXT NOT NULL,                     -- Human-readable label
  rate                 DECIMAL(12,4) NOT NULL,
  unit                 TEXT NOT NULL DEFAULT 'R/kVA',     -- 'R/kVA', 'R/kWh', 'R/day', '₦/kVA', etc.
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tariff_ancillary_structure ON tariff_ancillary_charges(tariff_structure_id);


-- ─── 4. LOAD PROFILES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS load_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type              load_profile_source NOT NULL DEFAULT 'upload',
  data_interval_minutes    INT NOT NULL DEFAULT 60,       -- 30 or 60
  annual_consumption_kwh   DECIMAL(14,2),
  peak_demand_kw           DECIMAL(10,2),
  peak_demand_kva          DECIMAL(10,2),
  notified_max_demand_kva  DECIMAL(10,2),
  load_factor              DECIMAL(5,4),                  -- 0.0000 – 1.0000
  business_type            TEXT,                          -- 'office', 'factory', 'retail', etc.
  confirmed_by_user        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_load_profiles_project ON load_profiles(project_id);


-- ─── 5. LOAD PROFILE DATA ───────────────────────────────────────────────────
-- Hourly (or half-hourly) series stored as JSONB arrays.
-- For a typical year: 8760 entries (hourly) or 17520 (half-hourly).

CREATE TABLE IF NOT EXISTS load_profile_data (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_profile_id  UUID NOT NULL REFERENCES load_profiles(id) ON DELETE CASCADE,
  year             INT NOT NULL DEFAULT 1,               -- 1 = modelled year
  hourly_kw        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- array of 8760 kW values
  hourly_kva       JSONB,                                -- optional kVA array (for demand charges)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_load_profile_data_profile ON load_profile_data(load_profile_id);


-- ─── 6. SOLAR RESOURCE CACHE ────────────────────────────────────────────────
-- Cached NASA POWER irradiance data per location (rounded to 0.5° grid).

CREATE TABLE IF NOT EXISTS solar_resource_cache (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_rounded    DECIMAL(5,1) NOT NULL,
  lon_rounded    DECIMAL(5,1) NOT NULL,
  data_source    TEXT NOT NULL DEFAULT 'nasa_power',
  -- TMY hourly arrays (8760 values each)
  hourly_ghi_wm2 JSONB NOT NULL,                         -- W/m² for each hour
  hourly_temp_c   JSONB NOT NULL,                         -- °C for each hour
  hourly_wind_ms  JSONB,                                  -- m/s for each hour (optional)
  annual_ghi_kwh_m2 DECIMAL(8,2),                         -- annual sum kWh/m²
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(lat_rounded, lon_rounded, data_source)
);


-- ─── 7. PROJECT DESIGNS ─────────────────────────────────────────────────────
-- Complete simulation configuration per project.

CREATE TABLE IF NOT EXISTS project_designs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tariff_structure_id     UUID REFERENCES tariff_structures(id) ON DELETE SET NULL,
  load_profile_id         UUID REFERENCES load_profiles(id) ON DELETE SET NULL,

  -- Location
  location_lat            DECIMAL(10,7),
  location_lon            DECIMAL(10,7),

  -- PV Configuration
  pv_capacity_kwp         DECIMAL(10,2),
  pv_tilt_deg             DECIMAL(5,2),
  pv_azimuth_deg          DECIMAL(5,2) DEFAULT 0,         -- 0=North, 180=South
  pv_technology           TEXT DEFAULT 'mono_perc',
  pv_degradation_y1_pct   DECIMAL(5,3),                   -- override or auto from tech
  pv_degradation_annual_pct DECIMAL(5,3),                  -- override or auto from tech
  pv_performance_ratio    DECIMAL(5,4),                    -- e.g. 0.82
  pv_system_losses_pct    DECIMAL(5,2) DEFAULT 14.0,       -- total system losses %
  pv_inverter_eff_pct     DECIMAL(5,2) DEFAULT 96.0,
  pv_generation_source    pv_generation_source DEFAULT 'calculated',
  pv_monthly_gen_kwh      JSONB,                           -- [jan, feb, ..., dec] if Helioscope

  -- BESS Configuration
  bess_capacity_kwh       DECIMAL(10,2),
  bess_chemistry          TEXT DEFAULT 'lfp',
  bess_dod_pct            DECIMAL(5,2) DEFAULT 80,
  bess_round_trip_eff_pct DECIMAL(5,2),                    -- override or auto from chemistry
  bess_c_rate             DECIMAL(5,2) DEFAULT 0.5,        -- C-rate for charge/discharge
  bess_dispatch_strategy  bess_dispatch_strategy DEFAULT 'self_consumption',
  peak_shave_threshold_kw DECIMAL(10,2),
  bess_max_grid_charge    BOOLEAN DEFAULT FALSE,           -- allow grid charging

  -- Financial Configuration
  analysis_period_years   INT DEFAULT 25,
  capex_total             DECIMAL(14,2),
  capex_breakdown         JSONB,                           -- {pv: ..., bess: ..., bos: ..., installation: ...}
  om_annual               DECIMAL(12,2),
  om_escalation_pct       DECIMAL(5,2) DEFAULT 5.0,
  tariff_escalation_pct   DECIMAL(5,2) DEFAULT 8.0,
  discount_rate_pct       DECIMAL(5,2) DEFAULT 10.0,
  financing_type          financing_type DEFAULT 'cash',
  loan_interest_rate_pct  DECIMAL(5,2),
  loan_term_years         INT,
  ppa_rate_per_kwh        DECIMAL(10,4),
  ppa_escalation_pct      DECIMAL(5,2),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_designs_project ON project_designs(project_id);


-- ─── 8. SIMULATION RESULTS ──────────────────────────────────────────────────
-- Cached simulation outputs. One result per design run.

CREATE TABLE IF NOT EXISTS simulation_results (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_design_id        UUID NOT NULL REFERENCES project_designs(id) ON DELETE CASCADE,
  run_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Annual Energy Metrics
  annual_solar_gen_kwh     DECIMAL(14,2),
  solar_utilised_kwh       DECIMAL(14,2),
  solar_exported_kwh       DECIMAL(14,2),
  curtailed_kwh            DECIMAL(14,2),
  battery_discharged_kwh   DECIMAL(14,2),
  battery_charged_kwh      DECIMAL(14,2),
  battery_cycles_annual    DECIMAL(8,1),
  grid_import_kwh          DECIMAL(14,2),
  grid_export_kwh          DECIMAL(14,2),

  -- Demand Metrics
  peak_demand_before_kw    DECIMAL(10,2),
  peak_demand_after_kw     DECIMAL(10,2),

  -- Performance
  performance_ratio        DECIMAL(8,4),                   -- kWh/kWp
  utilisation_pct          DECIMAL(5,2),                   -- solar utilised / generated %
  self_consumption_pct     DECIMAL(5,2),                   -- (solar utilised + batt discharged) / load

  -- Cost & Savings
  baseline_annual_cost     DECIMAL(14,2),                  -- no-solar annual electricity cost
  year1_annual_cost        DECIMAL(14,2),                  -- with-solar annual cost
  year1_savings            DECIMAL(14,2),

  -- LCOE
  lcoe_normal              DECIMAL(10,4),                  -- R/kWh or ₦/kWh
  lcoe_ls                  DECIMAL(10,4),                  -- load-shedding LCOE

  -- Financial Summary
  npv_25yr                 DECIMAL(14,2),
  irr_pct                  DECIMAL(8,2),
  roi_pct                  DECIMAL(8,2),
  simple_payback_months    INT,

  -- Detailed Data (JSONB)
  -- hourly_flows: array of 8760 objects {pv, load, batt_charge, batt_discharge, grid_import, grid_export, soc, curtailed}
  hourly_flows             JSONB,
  -- monthly_summary: 12 objects with per-month aggregates
  monthly_summary          JSONB,
  -- yearly_cashflow: 25 objects with year-by-year financials
  yearly_cashflow          JSONB,
  -- tou_breakdown: {peak: {kwh, cost}, standard: {kwh, cost}, off_peak: {kwh, cost}}
  tou_breakdown            JSONB,

  -- AI-generated narrative sections
  executive_summary_text   JSONB,                          -- {system_sizing, tou_analysis, solar_summary, financial_summary}

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulation_results_design ON simulation_results(project_design_id);
CREATE INDEX IF NOT EXISTS idx_simulation_results_run ON simulation_results(run_at DESC);


-- ─── 9. REPORT SHARES ───────────────────────────────────────────────────────
-- Public shareable links to project reports.

CREATE TABLE IF NOT EXISTS report_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  share_token     UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at      TIMESTAMPTZ,                           -- null = permanent (Elite+)
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_shares_token ON report_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_report_shares_project ON report_shares(project_id);


-- ─── 10. EXTEND EXISTING TABLES ─────────────────────────────────────────────

-- Add location coordinates and design metadata to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10,7);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location_lon DECIMAL(10,7);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS annual_consumption_kwh DECIMAL(12,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_completed_at TIMESTAMPTZ;

-- Add planned flag to equipment (true during design phase, false when installed)
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS is_planned BOOLEAN DEFAULT FALSE;


-- ─── 11. UPDATE TRIGGER ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_tariff_structures_updated
    BEFORE UPDATE ON tariff_structures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_load_profiles_updated
    BEFORE UPDATE ON load_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_project_designs_updated
    BEFORE UPDATE ON project_designs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
