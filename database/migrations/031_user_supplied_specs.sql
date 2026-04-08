-- 031: Add user-supplied PV, Battery, Inverter spec columns to project_designs
-- All columns are nullable/optional for backward compatibility

ALTER TABLE project_designs
  ADD COLUMN IF NOT EXISTS pv_brand TEXT,
  ADD COLUMN IF NOT EXISTS pv_model TEXT,
  ADD COLUMN IF NOT EXISTS pv_rated_power_kw NUMERIC,
  ADD COLUMN IF NOT EXISTS pv_type TEXT,
  ADD COLUMN IF NOT EXISTS pv_module_count INTEGER,
  ADD COLUMN IF NOT EXISTS pv_efficiency NUMERIC,
  ADD COLUMN IF NOT EXISTS pv_voltage NUMERIC,
  ADD COLUMN IF NOT EXISTS pv_current NUMERIC,

  ADD COLUMN IF NOT EXISTS battery_brand TEXT,
  ADD COLUMN IF NOT EXISTS battery_model TEXT,
  ADD COLUMN IF NOT EXISTS battery_chemistry TEXT,
  ADD COLUMN IF NOT EXISTS battery_capacity_kwh NUMERIC,
  ADD COLUMN IF NOT EXISTS battery_power_kw NUMERIC,
  ADD COLUMN IF NOT EXISTS battery_dod_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS battery_voltage NUMERIC,
  ADD COLUMN IF NOT EXISTS battery_crate NUMERIC,
  ADD COLUMN IF NOT EXISTS battery_is_complete_package BOOLEAN,
  ADD COLUMN IF NOT EXISTS pcs_power_kw NUMERIC,
  ADD COLUMN IF NOT EXISTS pcs_efficiency NUMERIC,
  ADD COLUMN IF NOT EXISTS pcs_type TEXT,

  ADD COLUMN IF NOT EXISTS inverter_brand TEXT,
  ADD COLUMN IF NOT EXISTS inverter_model TEXT,
  ADD COLUMN IF NOT EXISTS inverter_rated_power_kw NUMERIC,
  ADD COLUMN IF NOT EXISTS inverter_type TEXT,
  ADD COLUMN IF NOT EXISTS inverter_phases INTEGER,
  ADD COLUMN IF NOT EXISTS inverter_max_voltage NUMERIC,
  ADD COLUMN IF NOT EXISTS inverter_max_current NUMERIC,
  ADD COLUMN IF NOT EXISTS inverter_efficiency NUMERIC;

COMMENT ON COLUMN project_designs.pv_brand IS 'User-supplied PV brand';
COMMENT ON COLUMN project_designs.pv_model IS 'User-supplied PV model';
COMMENT ON COLUMN project_designs.pv_rated_power_kw IS 'User-supplied PV rated power (kW)';
COMMENT ON COLUMN project_designs.pv_type IS 'User-supplied PV type/technology';
COMMENT ON COLUMN project_designs.pv_module_count IS 'User-supplied PV module count';
COMMENT ON COLUMN project_designs.pv_efficiency IS 'User-supplied PV efficiency';
COMMENT ON COLUMN project_designs.pv_voltage IS 'User-supplied PV voltage';
COMMENT ON COLUMN project_designs.pv_current IS 'User-supplied PV current';

COMMENT ON COLUMN project_designs.battery_brand IS 'User-supplied battery brand';
COMMENT ON COLUMN project_designs.battery_model IS 'User-supplied battery model';
COMMENT ON COLUMN project_designs.battery_chemistry IS 'User-supplied battery chemistry/type';
COMMENT ON COLUMN project_designs.battery_capacity_kwh IS 'User-supplied battery capacity (kWh)';
COMMENT ON COLUMN project_designs.battery_power_kw IS 'User-supplied battery power (kW)';
COMMENT ON COLUMN project_designs.battery_dod_pct IS 'User-supplied battery depth of discharge (%)';
COMMENT ON COLUMN project_designs.battery_voltage IS 'User-supplied battery voltage';
COMMENT ON COLUMN project_designs.battery_crate IS 'User-supplied battery C-rate';
COMMENT ON COLUMN project_designs.battery_is_complete_package IS 'User-supplied: battery is a complete package with PCS';
COMMENT ON COLUMN project_designs.pcs_power_kw IS 'User-supplied PCS power (kW)';
COMMENT ON COLUMN project_designs.pcs_efficiency IS 'User-supplied PCS efficiency (%)';
COMMENT ON COLUMN project_designs.pcs_type IS 'User-supplied PCS type';

COMMENT ON COLUMN project_designs.inverter_brand IS 'User-supplied inverter brand';
COMMENT ON COLUMN project_designs.inverter_model IS 'User-supplied inverter model';
COMMENT ON COLUMN project_designs.inverter_rated_power_kw IS 'User-supplied inverter rated power (kW)';
COMMENT ON COLUMN project_designs.inverter_type IS 'User-supplied inverter type';
COMMENT ON COLUMN project_designs.inverter_phases IS 'User-supplied inverter phases';
COMMENT ON COLUMN project_designs.inverter_max_voltage IS 'User-supplied inverter max voltage';
COMMENT ON COLUMN project_designs.inverter_max_current IS 'User-supplied inverter max current';
COMMENT ON COLUMN project_designs.inverter_efficiency IS 'User-supplied inverter efficiency';
