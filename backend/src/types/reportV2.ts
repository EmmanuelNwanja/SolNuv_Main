export type UnitSymbol =
  | "kWh"
  | "kWp"
  | "kW"
  | "MWh"
  | "tCO2"
  | "gCO2/kWh"
  | "NGN"
  | "USD"
  | "GHS"
  | "%"
  | "years"
  | "months"
  | "none";

export type RoundingMode = "half_away_from_zero" | "half_even" | "floor" | "ceil";

export type ValueWithMeta = {
  value: number;
  unit: UnitSymbol;
  precision: number;
  display_precision: number;
  rounding_mode: RoundingMode;
};

export type ReportTrace = {
  engine_version: string;
  schema_version: "2.0.0";
  input_snapshot_hash: string;
  formula_bundle_hash: string;
  weather_dataset_hash: string | null;
  generated_at: string;
};

export type ProjectContext = {
  project_id: string;
  project_name: string;
  location: string | null;
  country_code: string | null;
};

export type SiteContext = {
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  weather_source: string | null;
};

export type SystemTopology = {
  grid_topology: string;
  pv_capacity_kwp: ValueWithMeta;
  inverter_power_kwac: ValueWithMeta | null;
  battery_capacity_kwh: ValueWithMeta | null;
  dc_ac_ratio: ValueWithMeta | null;
};

export type AssumptionSet = {
  discount_rate_pct: ValueWithMeta;
  tariff_escalation_pct: ValueWithMeta;
  om_escalation_pct: ValueWithMeta;
  annual_degradation_pct: ValueWithMeta;
};

export type ResultSet = {
  annual_generation_kwh: ValueWithMeta;
  annual_solar_utilised_kwh: ValueWithMeta;
  annual_grid_import_kwh: ValueWithMeta;
  specific_yield_kwh_per_kwp: ValueWithMeta;
  performance_ratio_pct: ValueWithMeta;
  solar_fraction_pct: ValueWithMeta;
  self_consumption_pct: ValueWithMeta;
};

export type UncertaintySet = {
  weather_variability_pct: ValueWithMeta | null;
  model_variability_pct: ValueWithMeta | null;
  p50_mwh: ValueWithMeta | null;
  p90_mwh: ValueWithMeta | null;
  p95_mwh: ValueWithMeta | null;
};

export type EconomicSet = {
  capex: ValueWithMeta;
  opex_annual: ValueWithMeta;
  year1_savings: ValueWithMeta;
  lcoe: ValueWithMeta;
  npv: ValueWithMeta;
  irr_pct: ValueWithMeta;
  payback_years: ValueWithMeta;
  roi_pct: ValueWithMeta;
};

export type EnvironmentalSet = {
  co2_avoided_lifetime_tonnes: ValueWithMeta;
  grid_emission_factor: ValueWithMeta | null;
};

export type ComplianceSet = {
  report_standard: "solnuv-v2";
  compliance_notes: string[];
};

export type ExplainabilitySet = {
  assumptions: string[];
  formula_references: string[];
  limitations: string[];
  kpi_formula_map?: Record<string, string>;
  formula_registry_entries?: Array<{
    id: string;
    version: string;
    expression_ref: string;
    input_units: Record<string, string>;
    output_unit: string;
    rounding_mode: RoundingMode;
    test_vectors: string[];
    invariants: string[];
    status: "active" | "deprecated";
  }>;
};

export type DesignReportV2 = {
  schema_version: "2.0.0";
  report_id: string;
  generated_at?: string;
  trace: ReportTrace;
  project: ProjectContext;
  site: SiteContext;
  system: SystemTopology;
  assumptions: AssumptionSet;
  results: ResultSet;
  uncertainty: UncertaintySet;
  economics: EconomicSet;
  environmental: EnvironmentalSet;
  compliance: ComplianceSet;
  explainability: ExplainabilitySet;
};
