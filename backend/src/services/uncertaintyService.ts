/**
 * SolNuv Uncertainty Service
 *
 * Energy-side probabilistic treatment for P50/P90/P95 reporting.
 * Uses a transparent normal-approximation model over aggregate uncertainty
 * components. Inputs are percentages expressed in %-points.
 */

type EnergyUncertaintyInput = {
  annualGenerationKwh: number;
  weatherVariabilityPct?: number;
  modelVariabilityPct?: number;
  componentVariabilityPct?: number;
  operationalVariabilityPct?: number;
};

type EnergyUncertaintyOutput = {
  components_pct: {
    weather: number;
    model: number;
    component: number;
    operational: number;
    total: number;
  };
  annual_generation_mwh: {
    p10: number;
    p50: number;
    p90: number;
    p95: number;
  };
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value: number, digits = 3): number {
  const scale = Math.pow(10, digits);
  return Math.round(value * scale) / scale;
}

/**
 * Compute annual-generation probabilistic band.
 *
 * Convention used:
 * - p50 is the expected annual generation.
 * - p90/p95 are conservative lower-bound production values.
 * - p10 is optimistic upper-bound value.
 */
export function computeEnergyUncertainty(input: EnergyUncertaintyInput): EnergyUncertaintyOutput {
  const annualGenerationKwh = Math.max(0, toNumber(input.annualGenerationKwh, 0));
  const weather = Math.max(0, toNumber(input.weatherVariabilityPct, 4.7));
  const model = Math.max(0, toNumber(input.modelVariabilityPct, 1.8));
  const component = Math.max(0, toNumber(input.componentVariabilityPct, 1.5));
  const operational = Math.max(0, toNumber(input.operationalVariabilityPct, 1.0));

  // Quadratic sum of independent uncertainty contributors.
  const totalPct = Math.sqrt(
    weather * weather +
    model * model +
    component * component +
    operational * operational,
  );

  const meanMwh = annualGenerationKwh / 1000;
  const sigma = totalPct / 100;

  // One-sided z-values
  const z90 = 1.2815515655;
  const z95 = 1.6448536269;

  const p50 = meanMwh;
  const p90 = Math.max(0, meanMwh * (1 - z90 * sigma));
  const p95 = Math.max(0, meanMwh * (1 - z95 * sigma));
  const p10 = Math.max(0, meanMwh * (1 + z90 * sigma));

  return {
    components_pct: {
      weather: round(weather, 2),
      model: round(model, 2),
      component: round(component, 2),
      operational: round(operational, 2),
      total: round(totalPct, 2),
    },
    annual_generation_mwh: {
      p10: round(p10, 3),
      p50: round(p50, 3),
      p90: round(p90, 3),
      p95: round(p95, 3),
    },
  };
}

