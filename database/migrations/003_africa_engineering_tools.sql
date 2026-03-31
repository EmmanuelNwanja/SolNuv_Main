-- =====================================================
-- SolNuv - African Engineering Tools Expansion
-- Adds localized proposal ROI, battery SoH ledger, and cable compliance records
-- =====================================================

CREATE TABLE IF NOT EXISTS proposal_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_name VARCHAR(255),
  tariff_band VARCHAR(10) NOT NULL,
  tariff_rate_ngn_per_kwh DECIMAL(12, 2) NOT NULL,
  generator_fuel_price_ngn_per_liter DECIMAL(12, 2) NOT NULL,
  current_grid_kwh_per_day DECIMAL(12, 2) NOT NULL,
  current_generator_liters_per_day DECIMAL(12, 2) NOT NULL,
  proposed_solar_capex_ngn DECIMAL(15, 2) NOT NULL,
  annual_om_cost_ngn DECIMAL(15, 2) NOT NULL DEFAULT 0,
  projected_grid_kwh_offset_per_day DECIMAL(12, 2) NOT NULL,
  projected_generator_liters_offset_per_day DECIMAL(12, 2) NOT NULL,
  payback_months DECIMAL(10, 2),
  annual_savings_ngn DECIMAL(15, 2),
  ten_year_savings_ngn DECIMAL(15, 2),
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS battery_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  brand VARCHAR(255) NOT NULL,
  chemistry VARCHAR(100) NOT NULL,
  capacity_kwh DECIMAL(12, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  installation_date DATE NOT NULL,
  qr_code_data VARCHAR(128) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  warranty_years INTEGER DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS battery_health_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battery_asset_id UUID NOT NULL REFERENCES battery_assets(id) ON DELETE CASCADE,
  logged_by UUID REFERENCES users(id),
  log_date DATE NOT NULL,
  measured_voltage DECIMAL(8, 2),
  measured_capacity_kwh DECIMAL(10, 2),
  avg_depth_of_discharge_pct DECIMAL(6, 2),
  estimated_cycles_per_day DECIMAL(6, 2),
  ambient_temperature_c DECIMAL(6, 2),
  estimated_soh_pct DECIMAL(6, 2),
  cumulative_damage_pct DECIMAL(6, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cable_compliance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  run_name VARCHAR(120) DEFAULT 'Main DC Run',
  current_amps DECIMAL(10, 2) NOT NULL,
  one_way_length_m DECIMAL(10, 2) NOT NULL,
  system_voltage_v DECIMAL(10, 2) NOT NULL,
  allowable_voltage_drop_pct DECIMAL(6, 2) NOT NULL DEFAULT 3,
  ambient_temperature_c DECIMAL(6, 2) NOT NULL DEFAULT 30,
  conductor_material VARCHAR(20) NOT NULL DEFAULT 'copper',
  computed_area_mm2 DECIMAL(12, 3) NOT NULL,
  recommended_standard_mm2 DECIMAL(12, 3) NOT NULL,
  estimated_voltage_drop_v DECIMAL(10, 3) NOT NULL,
  estimated_voltage_drop_pct DECIMAL(10, 3) NOT NULL,
  is_compliant BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_certificate_ref VARCHAR(128),
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_scenarios_company ON proposal_scenarios(company_id);
CREATE INDEX IF NOT EXISTS idx_battery_assets_project ON battery_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_battery_health_logs_asset ON battery_health_logs(battery_asset_id);
CREATE INDEX IF NOT EXISTS idx_cable_compliance_project ON cable_compliance_records(project_id);

DROP TRIGGER IF EXISTS update_battery_assets_updated_at ON battery_assets;
CREATE TRIGGER update_battery_assets_updated_at
BEFORE UPDATE ON battery_assets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
