const crypto = require("crypto");
const supabase = require("../config/database");
const { SIMULATION_ENGINE_VERSION } = require("../constants/simulationVersion");
const {
  getFormulaBundleHash,
  getKpiFormulaReferences,
  listFormulaRegistry,
} = require("./formulaRegistry");
const { computeEnergyUncertainty } = require("./uncertaintyService");

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function withMeta(value, unit, precision = 2, displayPrecision = precision, roundingMode = "half_away_from_zero") {
  return {
    value: num(value, 0),
    unit,
    precision,
    display_precision: displayPrecision,
    rounding_mode: roundingMode,
  };
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}

async function loadSimulationContext(simulationResultId) {
  const { data: result, error: resultErr } = await supabase
    .from("simulation_results")
    .select("*")
    .eq("id", simulationResultId)
    .single();
  if (resultErr || !result) {
    throw new Error(`Simulation result not found: ${resultErr?.message || "unknown"}`);
  }

  const { data: design } = await supabase
    .from("project_designs")
    .select("*")
    .eq("id", result.project_design_id)
    .maybeSingle();

  const { data: project } = await supabase
    .from("projects")
    .select("id,name,state,city,country_code,location_lat,location_lon,company_id")
    .eq("id", design?.project_id || "")
    .maybeSingle();

  const { data: tariff } = await supabase
    .from("tariff_structures")
    .select("id,currency,utility_name,tariff_name")
    .eq("id", design?.tariff_structure_id || "")
    .maybeSingle();

  const { data: imported } = await supabase
    .from("project_imported_design_reports")
    .select("id,source,file_name,file_public_url,report_label,created_at")
    .eq("project_id", design?.project_id || "")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { result, design: design || {}, project: project || {}, tariff: tariff || null, imported: imported || null };
}

async function computeDesignReportV2(simulationResultId) {
  const { result, design, project, imported } = await loadSimulationContext(simulationResultId);
  const annualGeneration = num(result.annual_solar_gen_kwh || result.annual_generation_kwh, 0);
  const uncertainty = computeEnergyUncertainty({
    annualGenerationKwh: annualGeneration,
    weatherVariabilityPct: result?.extended_metrics?.uncertainty?.components_pct?.weather,
    modelVariabilityPct: result?.extended_metrics?.uncertainty?.components_pct?.model,
    componentVariabilityPct: result?.extended_metrics?.uncertainty?.components_pct?.component,
    operationalVariabilityPct: result?.extended_metrics?.uncertainty?.components_pct?.operational,
  });

  const runProv = result.run_provenance || {};
  const inputHash = runProv.input_snapshot_hash || runProv.inputs_hash || hash(result.design_snapshot || design);
  const weatherHash = runProv.weather_dataset_hash || hash(runProv.weather || {});
  const formulaHash = runProv.formula_bundle_hash || getFormulaBundleHash();
  const kpiReferences = getKpiFormulaReferences();
  const formulaRefs = Object.keys(kpiReferences).map((kpi) => `${kpi} -> ${kpiReferences[kpi]}`);

  const report = {
    schema_version: "2.0.0",
    report_id: `rptv2-${result.id}`,
    generated_at: new Date().toISOString(),
    trace: {
      engine_version: runProv.engine_version || SIMULATION_ENGINE_VERSION,
      schema_version: "2.0.0",
      input_snapshot_hash: inputHash,
      formula_bundle_hash: formulaHash,
      weather_dataset_hash: weatherHash,
      generated_at: new Date().toISOString(),
    },
    project: {
      project_id: project.id || design.project_id || "",
      project_name: project.name || "Solar Project",
      location: [project.city, project.state].filter(Boolean).join(", ") || null,
      country_code: project.country_code || null,
    },
    site: {
      latitude: num(design.location_lat || project.location_lat, 0),
      longitude: num(design.location_lon || project.location_lon, 0),
      altitude_m: null,
      weather_source: runProv?.weather?.source || null,
    },
    system: {
      grid_topology: String(design.grid_topology || "grid_tied_bess"),
      pv_capacity_kwp: withMeta(design.pv_capacity_kwp, "kWp", 2, 2),
      inverter_power_kwac: withMeta(
        design.user_inverter_power_kw || design.user_pcs_power_kw || design.bess_power_kw || 0,
        "kW",
        2,
        1
      ),
      battery_capacity_kwh: withMeta(design.bess_capacity_kwh || 0, "kWh", 2, 1),
      dc_ac_ratio: withMeta(design.dc_ac_ratio || 0, "none", 3, 2),
    },
    assumptions: {
      discount_rate_pct: withMeta(design.discount_rate_pct || 0, "%", 3, 2),
      tariff_escalation_pct: withMeta(design.tariff_escalation_pct || 0, "%", 3, 2),
      om_escalation_pct: withMeta(design.om_escalation_pct || 0, "%", 3, 2),
      annual_degradation_pct: withMeta(design.pv_degradation_annual_pct || 0, "%", 3, 2),
    },
    results: {
      annual_generation_kwh: withMeta(annualGeneration, "kWh", 2, 0),
      annual_solar_utilised_kwh: withMeta(result.solar_utilised_kwh || 0, "kWh", 2, 0),
      annual_grid_import_kwh: withMeta(result.grid_import_kwh || 0, "kWh", 2, 0),
      specific_yield_kwh_per_kwp: withMeta(result.performance_ratio || 0, "none", 4, 2),
      performance_ratio_pct: withMeta(result.performance_ratio || 0, "%", 3, 2),
      solar_fraction_pct: withMeta(result.utilisation_pct || 0, "%", 3, 2),
      self_consumption_pct: withMeta(result.self_consumption_pct || 0, "%", 3, 2),
    },
    uncertainty: {
      weather_variability_pct: withMeta(uncertainty.components_pct.weather, "%", 2, 2),
      model_variability_pct: withMeta(uncertainty.components_pct.model, "%", 2, 2),
      p50_mwh: withMeta(uncertainty.annual_generation_mwh.p50, "MWh", 3, 2),
      p90_mwh: withMeta(uncertainty.annual_generation_mwh.p90, "MWh", 3, 2),
      p95_mwh: withMeta(uncertainty.annual_generation_mwh.p95, "MWh", 3, 2),
    },
    economics: {
      capex: withMeta(design.capex_total || 0, "NGN", 2, 0),
      opex_annual: withMeta(design.om_annual || 0, "NGN", 2, 0),
      year1_savings: withMeta(result.year1_savings || 0, "NGN", 2, 0),
      lcoe: withMeta(result.lcoe_normal || 0, "NGN", 4, 2),
      npv: withMeta(result.npv_25yr || 0, "NGN", 2, 0),
      irr_pct: withMeta(result.irr_pct || 0, "%", 3, 2),
      payback_years: withMeta((num(result.simple_payback_months, 0) || 0) / 12, "years", 3, 2),
      roi_pct: withMeta(result.roi_pct || 0, "%", 3, 2),
    },
    environmental: {
      co2_avoided_lifetime_tonnes: withMeta(
        result?.energy_comparison?.environmental?.co2_avoided_lifetime_tonnes || result.co2_avoided_tonnes || 0,
        "tCO2",
        3,
        2
      ),
      grid_emission_factor: withMeta(
        result?.energy_comparison?.environmental?.grid_emission_factor || 0.43,
        "gCO2/kWh",
        3,
        3
      ),
    },
    compliance: {
      report_standard: "solnuv-v2",
      compliance_notes: [
        "Deterministic replay supported via input snapshot hash and engine version.",
        "Formula bundle is versioned and hash-stamped.",
        "Uncertainty treatment includes P50/P90/P95 traceability.",
        imported ? `External report imported: ${imported.file_name}` : "No external imported report attached.",
      ],
    },
    explainability: {
      assumptions: [
        `Discount rate: ${num(design.discount_rate_pct, 0)}%`,
        `Tariff escalation: ${num(design.tariff_escalation_pct, 0)}%`,
        `O&M escalation: ${num(design.om_escalation_pct, 0)}%`,
        `PV degradation: ${num(design.pv_degradation_annual_pct, 0)}%`,
      ],
      formula_references: formulaRefs,
      limitations: [
        "Uncertainty aggregation assumes independent uncertainty components.",
        "Weather and tariff data are dependent on selected source snapshots.",
        "Operational events outside modeled assumptions can shift realized outcomes.",
      ],
      kpi_formula_map: kpiReferences,
      formula_registry_entries: listFormulaRegistry(),
    },
  };

  return report;
}

module.exports = {
  computeDesignReportV2,
  loadSimulationContext,
};

