/**
 * SolNuv Financial Modelling Service
 * 25-year cashflow projections with NPV, IRR, LCOE, payback, and financing comparisons.
 */

const { PANEL_TECHNOLOGIES, DEFAULT_PANEL_TECHNOLOGY, BATTERY_CHEMISTRIES, resolveChemistry, cyclesAtDoD } = require('../constants/technologyConstants');

/**
 * Calculate 25-year cashflow projection.
 * @param {object} config
 * @returns {{ yearlyCashflow: object[], npv: number, irr: number, roi: number, paybackMonths: number, lcoe: number }}
 */
function calculate25YearCashflow(config) {
  const {
    analysisPeriodYears = 25,
    capexTotal = 0,
    capexBreakdown = {},
    omAnnual = 0,
    omEscalationPct = 5,
    tariffEscalationPct = 8,
    discountRatePct = 10,
    year1Savings = 0,
    year1GenKwh = 0,
    pvTechnology = DEFAULT_PANEL_TECHNOLOGY,
    bessCapacityKwh = 0,
    bessChemistry = 'lfp',
    bessDodPct = 80,
    annualBatteryCycles = 0,
    bessCapexShare = 0, // BESS portion of capex for replacement calculation
    financingType = 'cash',
    loanInterestRatePct = 0,
    loanTermYears = 0,
    ppaRatePerKwh = 0,
    ppaEscalationPct = 0,
    baselineAnnualCost = 0,
  } = config;

  const tech = PANEL_TECHNOLOGIES[pvTechnology] || PANEL_TECHNOLOGIES[DEFAULT_PANEL_TECHNOLOGY];
  const annualDegPct = tech.deg_rate_pct_yr / 100;
  const discountRate = discountRatePct / 100;
  const tariffEsc = tariffEscalationPct / 100;
  const omEsc = omEscalationPct / 100;

  // Battery replacement year calculation
  const battCycleLife = bessCapacityKwh > 0 ? cyclesAtDoD(bessChemistry, bessDodPct) : Infinity;
  const battReplacementYear = annualBatteryCycles > 0
    ? Math.ceil(battCycleLife / annualBatteryCycles) : Infinity;

  // Loan payment calculation (PMT formula)
  let annualLoanPayment = 0;
  if (financingType === 'loan' && loanInterestRatePct > 0 && loanTermYears > 0) {
    const r = loanInterestRatePct / 100;
    annualLoanPayment = capexTotal * (r * Math.pow(1 + r, loanTermYears)) /
      (Math.pow(1 + r, loanTermYears) - 1);
  } else if (financingType === 'loan' && loanTermYears > 0) {
    annualLoanPayment = capexTotal / loanTermYears;
  }

  const yearlyCashflow = [];
  let cumulativeCashflow = -capexTotal;
  let paybackMonths = null;

  // Year 0
  yearlyCashflow.push({
    year: 0,
    generation_kwh: 0,
    savings: 0,
    om_cost: 0,
    loan_payment: 0,
    battery_replacement: 0,
    net_cashflow: -capexTotal,
    cumulative_cashflow: cumulativeCashflow,
    discounted_cashflow: -capexTotal,
  });

  let totalDiscountedCosts = capexTotal;
  let totalDiscountedGeneration = 0;

  for (let year = 1; year <= analysisPeriodYears; year++) {
    // Degraded generation
    const genFactor = Math.pow(1 - annualDegPct, year - 1);
    const yearGenKwh = year1GenKwh * genFactor;

    // Escalated savings
    let yearSavings;
    if (financingType === 'ppa') {
      // PPA: savings = baseline cost escalated - PPA cost escalated
      const escalatedBaseline = baselineAnnualCost * Math.pow(1 + tariffEsc, year - 1);
      const ppaCost = yearGenKwh * ppaRatePerKwh * Math.pow(1 + (ppaEscalationPct / 100), year - 1);
      yearSavings = escalatedBaseline - ppaCost;
    } else {
      yearSavings = year1Savings * genFactor * Math.pow(1 + tariffEsc, year - 1);
    }

    // Escalated O&M
    const yearOm = omAnnual * Math.pow(1 + omEsc, year - 1);

    // Loan payment
    const yearLoanPayment = (financingType === 'loan' && year <= loanTermYears) ? annualLoanPayment : 0;

    // Battery replacement
    let battReplacement = 0;
    if (year === battReplacementYear && bessCapexShare > 0) {
      // Battery replacement cost with learning-curve price decline (~8%/yr real decline)
      // After N years: cost = original × (1 - 0.08)^N
      const priceFactor = Math.pow(1 - 0.08, year);
      battReplacement = bessCapexShare * Math.max(0.3, priceFactor); // Floor at 30% of original
    }

    const netCashflow = yearSavings - yearOm - yearLoanPayment - battReplacement;
    cumulativeCashflow += netCashflow;

    const discountFactor = Math.pow(1 + discountRate, year);
    const discountedCashflow = netCashflow / discountFactor;
    totalDiscountedCosts += (yearOm + battReplacement) / discountFactor;
    totalDiscountedGeneration += yearGenKwh / discountFactor;

    // Track payback month
    if (paybackMonths === null && cumulativeCashflow >= 0) {
      const prevCumulative = yearlyCashflow[year - 1].cumulative_cashflow;
      const fractionalYear = netCashflow > 0 ? -prevCumulative / netCashflow : 0;
      paybackMonths = Math.round(((year - 1) + fractionalYear) * 12);
    }

    yearlyCashflow.push({
      year,
      generation_kwh: Math.round(yearGenKwh),
      savings: Math.round(yearSavings),
      om_cost: Math.round(yearOm),
      loan_payment: Math.round(yearLoanPayment),
      battery_replacement: Math.round(battReplacement),
      net_cashflow: Math.round(netCashflow),
      cumulative_cashflow: Math.round(cumulativeCashflow),
      discounted_cashflow: Math.round(discountedCashflow),
    });
  }

  // NPV
  const cashflows = yearlyCashflow.map(y => y.net_cashflow);
  const npv = calculateNPV(cashflows, discountRate);

  // IRR
  const irr = calculateIRR(cashflows);

  // ROI
  const totalSavings = yearlyCashflow.slice(1).reduce((s, y) => s + y.savings, 0);
  const totalCosts = capexTotal + yearlyCashflow.slice(1).reduce((s, y) => s + y.om_cost + y.battery_replacement, 0);
  const roi = totalCosts > 0 ? ((totalSavings - totalCosts) / capexTotal) * 100 : 0;

  // LCOE
  const lcoe = totalDiscountedGeneration > 0 ? totalDiscountedCosts / totalDiscountedGeneration : 0;

  return {
    yearlyCashflow,
    npv: Math.round(npv),
    irr: Math.round(irr * 1000) / 10, // as percentage with 1 decimal
    roi: Math.round(roi),
    paybackMonths: paybackMonths || analysisPeriodYears * 12,
    lcoe: Math.round(lcoe * 100) / 100,
    batteryReplacementYear: battReplacementYear <= analysisPeriodYears ? battReplacementYear : null,
  };
}

/**
 * Net Present Value calculation.
 * @param {number[]} cashflows - Year 0..N cashflows (year 0 = initial investment, negative)
 * @param {number} rate - Discount rate as decimal
 * @returns {number}
 */
function calculateNPV(cashflows, rate) {
  return cashflows.reduce((npv, cf, year) => {
    return npv + cf / Math.pow(1 + rate, year);
  }, 0);
}

/**
 * Internal Rate of Return using Newton-Raphson method.
 * @param {number[]} cashflows - Year 0..N
 * @returns {number} IRR as decimal (e.g. 0.15 = 15%)
 */
function calculateIRR(cashflows, maxIterations = 100, tolerance = 1e-7) {
  if (!cashflows || cashflows.length < 2) return 0;

  // Initial guess: simple payback-based
  const investment = -cashflows[0];
  const avgReturn = cashflows.slice(1).reduce((s, v) => s + v, 0) / (cashflows.length - 1);
  let rate = investment > 0 && avgReturn > 0 ? (avgReturn / investment) : 0.1;
  rate = Math.max(0.001, Math.min(rate, 2));

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0; // derivative

    for (let t = 0; t < cashflows.length; t++) {
      const factor = Math.pow(1 + rate, t);
      npv += cashflows[t] / factor;
      dnpv -= t * cashflows[t] / (factor * (1 + rate));
    }

    if (Math.abs(dnpv) < 1e-12) break;

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tolerance) {
      return Math.max(0, newRate);
    }

    rate = Math.max(-0.99, Math.min(newRate, 10)); // Clamp to prevent divergence
  }

  return Math.max(0, rate);
}

/**
 * Calculate LCOE separately for normal and load-shedding hours.
 * @param {object} params
 * @returns {{ lcoeNormal: number, lcoeLS: number }}
 */
function calculateLCOE(params) {
  const {
    capexTotal, omAnnual, omEscalationPct = 5,
    discountRatePct = 10, analysisPeriodYears = 25,
    year1GenKwh, pvTechnology = DEFAULT_PANEL_TECHNOLOGY,
    normalHoursSharePct = 95, // % of generation during normal grid hours
    generatorCostPerKwh = 0, // Cost of alternative (generator) during LS
  } = params;

  const discountRate = discountRatePct / 100;
  const omEsc = omEscalationPct / 100;
  const tech = PANEL_TECHNOLOGIES[pvTechnology] || PANEL_TECHNOLOGIES[DEFAULT_PANEL_TECHNOLOGY];
  const annualDeg = tech.deg_rate_pct_yr / 100;

  let totalDiscountedCost = capexTotal;
  let totalDiscountedGenNormal = 0;
  let totalDiscountedGenLS = 0;

  for (let year = 1; year <= analysisPeriodYears; year++) {
    const df = Math.pow(1 + discountRate, year);
    const genKwh = year1GenKwh * Math.pow(1 - annualDeg, year - 1);
    const om = omAnnual * Math.pow(1 + omEsc, year - 1);

    totalDiscountedCost += om / df;
    totalDiscountedGenNormal += (genKwh * normalHoursSharePct / 100) / df;
    totalDiscountedGenLS += (genKwh * (100 - normalHoursSharePct) / 100) / df;
  }

  const lcoeNormal = totalDiscountedGenNormal > 0 ? totalDiscountedCost / totalDiscountedGenNormal : 0;
  // LS LCOE: offset against generator cost
  const lcoeLS = totalDiscountedGenLS > 0
    ? (totalDiscountedCost * (100 - normalHoursSharePct) / 100) / totalDiscountedGenLS
    : 0;

  return {
    lcoeNormal: Math.round(lcoeNormal * 100) / 100,
    lcoeLS: Math.round(lcoeLS * 100) / 100,
  };
}

/**
 * Compare Purchase vs Loan vs PPA financing options.
 */
function compareFinancingOptions(baseConfig) {
  const cashResult = calculate25YearCashflow({ ...baseConfig, financingType: 'cash' });

  const loanResult = baseConfig.loanInterestRatePct
    ? calculate25YearCashflow({ ...baseConfig, financingType: 'loan' })
    : null;

  const ppaResult = baseConfig.ppaRatePerKwh
    ? calculate25YearCashflow({ ...baseConfig, financingType: 'ppa' })
    : null;

  return {
    cash: { npv: cashResult.npv, irr: cashResult.irr, paybackMonths: cashResult.paybackMonths, roi: cashResult.roi },
    loan: loanResult
      ? { npv: loanResult.npv, irr: loanResult.irr, paybackMonths: loanResult.paybackMonths, roi: loanResult.roi }
      : null,
    ppa: ppaResult
      ? { npv: ppaResult.npv, irr: ppaResult.irr, paybackMonths: ppaResult.paybackMonths, roi: ppaResult.roi }
      : null,
  };
}

/**
 * Seeded Mulberry32 PRNG for reproducible Monte Carlo runs.
 */
function makeRng(seed) {
  let s = (seed | 0) || 1337;
  return function rand() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform: uniform → normal(0,1).
 */
function normal(rand) {
  const u1 = Math.max(1e-9, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.max(0, Math.round(p * (sortedArr.length - 1))));
  return sortedArr[idx];
}

/**
 * Monte Carlo risk analysis around the base cashflow config.
 *
 * Perturbs a small, defensible set of lender-salient inputs:
 *   - year1Savings     ±10% (triangular-ish via normal clipped)
 *   - year1GenKwh      ±5%  (weather + performance uncertainty)
 *   - omAnnual         ±15% (maintenance cost variance)
 *   - tariffEscalation ±2 percentage points absolute
 *   - discountRate     ±1.5 percentage points absolute
 *
 * Returns P10 / P50 / P90 for NPV and IRR. With a fixed seed + fixed base
 * inputs, the result is bit-stable — CI can assert exact equality.
 *
 * @param {object} baseConfig - Same shape as calculate25YearCashflow input.
 * @param {object} [opts]
 * @param {number} [opts.iterations=500]
 * @param {number} [opts.seed=1337]
 * @returns {{ iterations, seed, npv: { p10, p50, p90 }, irr: { p10, p50, p90 }, payback_months: { p10, p50, p90 } }}
 */
function runCashflowScenarios(baseConfig, opts: Record<string, any> = {}) {
  const iterations = Math.max(10, Math.min(5000, opts.iterations || 500));
  const seed = Number.isFinite(opts.seed) ? opts.seed : 1337;
  const rand = makeRng(seed);

  const npvSamples: number[] = [];
  const irrSamples: number[] = [];
  const paybackSamples: number[] = [];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  for (let i = 0; i < iterations; i++) {
    const zSavings = normal(rand);
    const zGen = normal(rand);
    const zOm = normal(rand);
    const zTariff = normal(rand);
    const zDiscount = normal(rand);

    const cfg = { ...baseConfig };
    cfg.year1Savings = (baseConfig.year1Savings || 0) * clamp(1 + 0.10 * zSavings, 0.5, 1.5);
    cfg.year1GenKwh = (baseConfig.year1GenKwh || 0) * clamp(1 + 0.05 * zGen, 0.7, 1.3);
    cfg.omAnnual = (baseConfig.omAnnual || 0) * clamp(1 + 0.15 * zOm, 0.5, 2.0);
    cfg.tariffEscalationPct = clamp((baseConfig.tariffEscalationPct || 0) + 2 * zTariff, 0, 30);
    cfg.discountRatePct = clamp((baseConfig.discountRatePct || 10) + 1.5 * zDiscount, 1, 30);

    const out = calculate25YearCashflow(cfg);
    npvSamples.push(out.npv);
    irrSamples.push(out.irr);
    paybackSamples.push(out.paybackMonths);
  }

  npvSamples.sort((a, b) => a - b);
  irrSamples.sort((a, b) => a - b);
  paybackSamples.sort((a, b) => a - b);

  return {
    iterations,
    seed,
    npv: {
      p10: Math.round(percentile(npvSamples, 0.10)),
      p50: Math.round(percentile(npvSamples, 0.50)),
      p90: Math.round(percentile(npvSamples, 0.90)),
    },
    irr: {
      p10: Math.round(percentile(irrSamples, 0.10) * 10) / 10,
      p50: Math.round(percentile(irrSamples, 0.50) * 10) / 10,
      p90: Math.round(percentile(irrSamples, 0.90) * 10) / 10,
    },
    payback_months: {
      p10: Math.round(percentile(paybackSamples, 0.10)),
      p50: Math.round(percentile(paybackSamples, 0.50)),
      p90: Math.round(percentile(paybackSamples, 0.90)),
    },
  };
}

module.exports = {
  calculate25YearCashflow,
  calculateNPV,
  calculateIRR,
  calculateLCOE,
  compareFinancingOptions,
  runCashflowScenarios,
};
