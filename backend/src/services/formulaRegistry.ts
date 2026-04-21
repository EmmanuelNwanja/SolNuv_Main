import crypto from "crypto";

export type FormulaRegistryEntry = {
  id: string;
  version: string;
  expression_ref: string;
  input_units: Record<string, string>;
  output_unit: string;
  rounding_mode: "half_away_from_zero" | "half_even" | "floor" | "ceil";
  test_vectors: string[];
  invariants: string[];
  status: "active" | "deprecated";
};

const FORMULA_REGISTRY: FormulaRegistryEntry[] = [
  {
    id: "energy.performance_ratio",
    version: "1.0.0",
    expression_ref: "simulationService.performance_ratio",
    input_units: {
      annual_solar_gen_kwh: "kWh",
      pv_capacity_kwp: "kWp",
    },
    output_unit: "kWh/kWp/year",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["energy.pr.nominal.001"],
    invariants: ["energy.non_negative", "energy.finite"],
    status: "active",
  },
  {
    id: "energy.annual_generation",
    version: "1.0.0",
    expression_ref: "simulationService.annual_solar_gen_kwh",
    input_units: {
      hourly_pv_generation: "kWh[]",
    },
    output_unit: "kWh",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["energy.annual_generation.base.001"],
    invariants: ["energy.non_negative", "energy.finite", "energy.monthly_sum_closure"],
    status: "active",
  },
  {
    id: "energy.self_consumption",
    version: "1.0.0",
    expression_ref: "simulationService.self_consumption_pct",
    input_units: {
      solar_utilised_kwh: "kWh",
      battery_discharged_kwh: "kWh",
      annual_load_kwh: "kWh",
    },
    output_unit: "%",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["energy.self_consumption.base.001"],
    invariants: ["energy.percent_bounds_0_100", "energy.finite"],
    status: "active",
  },
  {
    id: "storage.bess_dispatch",
    version: "1.0.0",
    expression_ref: "bessSimulationService.simulateBESS",
    input_units: {
      capacity_kwh: "kWh",
      power_kw: "kW",
      hourly_load: "kWh[]",
      hourly_pv: "kWh[]",
    },
    output_unit: "kWh",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["storage.bess.base.001"],
    invariants: ["storage.soc_bounds", "energy.balance_closure"],
    status: "active",
  },
  {
    id: "tariff.annual_bill",
    version: "1.0.0",
    expression_ref: "tariffService.calculateAnnualBill",
    input_units: {
      hourly_load: "kWh[]",
      tariff_rates: "currency/kWh",
    },
    output_unit: "currency",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["tariff.annual_bill.flat.001"],
    invariants: ["financial.non_negative", "financial.finite"],
    status: "active",
  },
  {
    id: "financial.npv",
    version: "1.0.0",
    expression_ref: "financialService.calculateNPV",
    input_units: {
      cashflows: "currency[]",
      discount_rate: "%",
    },
    output_unit: "currency",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["financial.npv.base.001"],
    invariants: ["financial.cashflow_consistency"],
    status: "active",
  },
  {
    id: "financial.irr",
    version: "1.0.0",
    expression_ref: "financialService.calculateIRR",
    input_units: {
      cashflows: "currency[]",
    },
    output_unit: "%",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["financial.irr.base.001"],
    invariants: ["financial.irr_bounds"],
    status: "active",
  },
  {
    id: "financial.lcoe",
    version: "1.0.0",
    expression_ref: "financialService.calculateLCOE",
    input_units: {
      discounted_costs: "currency",
      discounted_generation: "kWh",
    },
    output_unit: "currency/kWh",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["financial.lcoe.base.001"],
    invariants: ["financial.lcoe_non_negative", "energy.non_zero_generation_for_lcoe"],
    status: "active",
  },
  {
    id: "uncertainty.energy_pxx",
    version: "1.0.0",
    expression_ref: "uncertaintyService.computeEnergyUncertainty",
    input_units: {
      annual_generation_kwh: "kWh",
      total_uncertainty_pct: "%",
    },
    output_unit: "MWh",
    rounding_mode: "half_away_from_zero",
    test_vectors: ["uncertainty.energy.base.001"],
    invariants: ["uncertainty.ordering_p95_p90_p50_p10", "energy.non_negative"],
    status: "active",
  },
];

export function listFormulaRegistry(): FormulaRegistryEntry[] {
  return FORMULA_REGISTRY.slice();
}

export function getFormulaRegistryEntry(id: string): FormulaRegistryEntry | null {
  return FORMULA_REGISTRY.find((entry) => entry.id === id) || null;
}

export function getFormulaBundleHashInput(): string {
  return FORMULA_REGISTRY
    .filter((entry) => entry.status === "active")
    .map((entry) => `${entry.id}@${entry.version}`)
    .sort()
    .join("|");
}

export function getFormulaBundleHash(): string {
  const hashInput = getFormulaBundleHashInput();
  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

export function getKpiFormulaReferences(): Record<string, string> {
  return {
    annual_generation_kwh: "energy.annual_generation",
    performance_ratio: "energy.performance_ratio",
    self_consumption_pct: "energy.self_consumption",
    baseline_annual_cost: "tariff.annual_bill",
    year1_annual_cost: "tariff.annual_bill",
    npv_25yr: "financial.npv",
    irr_pct: "financial.irr",
    lcoe_normal: "financial.lcoe",
    p50_mwh: "uncertainty.energy_pxx",
    p90_mwh: "uncertainty.energy_pxx",
    p95_mwh: "uncertainty.energy_pxx",
  };
}
