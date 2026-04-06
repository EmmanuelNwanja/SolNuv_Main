/**
 * SolNuv Simulation Orchestrator
 * Master service that coordinates PV + BESS + Tariff + Financial simulation.
 */

const supabase = require('../config/database');
const logger = require('../utils/logger');
const { getHourlySolarResource } = require('./solarResourceService');
const { simulatePVGeneration, distributeHelioscapeToHourly } = require('./pvSimulationService');
const { simulateBESS } = require('./bessSimulationService');
const { buildHourlyTOUMap, calculateAnnualBill } = require('./tariffService');
const { calculate25YearCashflow, calculateLCOE } = require('./financialService');
const { calculateProfileStats } = require('./loadProfileService');
const { PANEL_TECHNOLOGIES, DEFAULT_PANEL_TECHNOLOGY, BATTERY_CHEMISTRIES, resolveChemistry } = require('../constants/technologyConstants');

const HOURS_PER_YEAR = 8760;
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Run a complete simulation for a project design.
 * @param {string} projectDesignId
 * @returns {object} Simulation results
 */
async function runSimulation(projectDesignId) {
  // 1. Load design configuration
  const { data: design, error: dErr } = await supabase
    .from('project_designs')
    .select('*')
    .eq('id', projectDesignId)
    .single();

  if (dErr || !design) throw new Error('Project design not found');

  // 2. Load tariff structure + rates + ancillary
  let tariffStructure = null, tariffRates = [], ancillaryCharges = [];
  if (design.tariff_structure_id) {
    const [structRes, ratesRes, chargesRes] = await Promise.all([
      supabase.from('tariff_structures').select('*').eq('id', design.tariff_structure_id).single(),
      supabase.from('tariff_rates').select('*').eq('tariff_structure_id', design.tariff_structure_id),
      supabase.from('tariff_ancillary_charges').select('*').eq('tariff_structure_id', design.tariff_structure_id),
    ]);
    tariffStructure = structRes.data;
    tariffRates = ratesRes.data || [];
    ancillaryCharges = chargesRes.data || [];
  }

  // 3. Load hourly load profile
  let hourlyLoadKw = new Array(HOURS_PER_YEAR).fill(0);
  if (design.load_profile_id) {
    const { data: profileData } = await supabase
      .from('load_profile_data')
      .select('hourly_kw')
      .eq('load_profile_id', design.load_profile_id)
      .order('year')
      .limit(1)
      .single();

    if (profileData?.hourly_kw) {
      hourlyLoadKw = Array.isArray(profileData.hourly_kw)
        ? profileData.hourly_kw.map(v => Number(v) || 0)
        : new Array(HOURS_PER_YEAR).fill(0);
    }
  }

  // 4. Fetch solar resource data
  const lat = Number(design.location_lat) || 6.5; // Default Lagos
  const lon = Number(design.location_lon) || 3.4;
  const solarResource = await getHourlySolarResource(lat, lon);

  // 5. Run PV simulation
  let hourlyPvKw;
  const pvCapacity = Number(design.pv_capacity_kwp) || 0;
  const pvTech = design.pv_technology || DEFAULT_PANEL_TECHNOLOGY;

  if (design.pv_generation_source === 'helioscope' && design.pv_monthly_gen_kwh) {
    hourlyPvKw = distributeHelioscapeToHourly(design.pv_monthly_gen_kwh, solarResource.hourlyGhi);
  } else if (pvCapacity > 0) {
    const pvResult = simulatePVGeneration({
      capacityKwp: pvCapacity,
      tiltDeg: Number(design.pv_tilt_deg) || Math.abs(lat),
      azimuthDeg: Number(design.pv_azimuth_deg) || (lat >= 0 ? 180 : 0),
      lat,
      technology: pvTech,
      systemLossesPct: Number(design.pv_system_losses_pct) || 14,
      inverterEffPct: Number(design.pv_inverter_eff_pct) || 96,
      hourlyGhi: solarResource.hourlyGhi,
      hourlyTemp: solarResource.hourlyTemp,
      degradationYear: 1,
    });
    hourlyPvKw = pvResult.hourlyAcKw;
  } else {
    hourlyPvKw = new Array(HOURS_PER_YEAR).fill(0);
  }

  // 6. Build TOU map
  let touMap = null;
  if (tariffStructure && tariffRates.length > 0) {
    touMap = buildHourlyTOUMap(tariffStructure, tariffRates);
  }

  // 7. Run BESS simulation
  const bessCapacity = Number(design.bess_capacity_kwh) || 0;
  let bessResults;

  if (bessCapacity > 0) {
    bessResults = simulateBESS({
      capacityKwh: bessCapacity,
      chemistry: design.bess_chemistry || 'lfp',
      dodPct: Number(design.bess_dod_pct) || 80,
      cRate: Number(design.bess_c_rate) || 0.5,
      strategy: design.bess_dispatch_strategy || 'self_consumption',
      peakShaveThresholdKw: Number(design.peak_shave_threshold_kw) || Infinity,
      allowGridCharge: design.bess_max_grid_charge || false,
      hourlyPvKw,
      hourlyLoadKw,
      touMap,
    });
  } else {
    // PV-only: calculate direct self-consumption
    bessResults = calculatePVOnlyFlows(hourlyPvKw, hourlyLoadKw);
  }

  // 8. Calculate tariff costs — baseline and with-solar
  const loadStats = calculateProfileStats(hourlyLoadKw);
  let baselineBill = null, withSolarBill = null;

  if (tariffStructure && tariffRates.length > 0) {
    baselineBill = calculateAnnualBill(hourlyLoadKw, tariffStructure, tariffRates, ancillaryCharges, {
      peakDemandKva: loadStats.peakKw,
    });

    // With-solar: grid import profile
    const gridImportProfile = bessResults.hourlyFlows.map(f => f.grid_import);
    withSolarBill = calculateAnnualBill(gridImportProfile, tariffStructure, tariffRates, ancillaryCharges, {
      peakDemandKva: bessResults.annual.peak_grid_demand_kw,
    });
  }

  const baselineAnnualCost = baselineBill?.annual.total_cost || 0;
  const withSolarAnnualCost = withSolarBill?.annual.total_cost || 0;
  const year1Savings = baselineAnnualCost - withSolarAnnualCost;

  // 9. Run financial model
  const capexTotal = Number(design.capex_total) || 0;
  const annualPvKwh = bessResults.annual.solar_gen_kwh;
  const bessChemistry = resolveChemistry(design.bess_chemistry);

  const financials = calculate25YearCashflow({
    analysisPeriodYears: Number(design.analysis_period_years) || 25,
    capexTotal,
    capexBreakdown: design.capex_breakdown || {},
    omAnnual: Number(design.om_annual) || 0,
    omEscalationPct: Number(design.om_escalation_pct) || 5,
    tariffEscalationPct: Number(design.tariff_escalation_pct) || 8,
    discountRatePct: Number(design.discount_rate_pct) || 10,
    year1Savings,
    year1GenKwh: annualPvKwh,
    pvTechnology: pvTech,
    bessCapacityKwh: bessCapacity,
    bessChemistry,
    bessDodPct: Number(design.bess_dod_pct) || 80,
    annualBatteryCycles: bessResults.annual.battery_cycles || 0,
    bessCapexShare: (design.capex_breakdown?.bess) || capexTotal * 0.4,
    financingType: design.financing_type || 'cash',
    loanInterestRatePct: Number(design.loan_interest_rate_pct) || 0,
    loanTermYears: Number(design.loan_term_years) || 0,
    ppaRatePerKwh: Number(design.ppa_rate_per_kwh) || 0,
    ppaEscalationPct: Number(design.ppa_escalation_pct) || 0,
    baselineAnnualCost,
  });

  // 10. Calculate LCOE
  const lcoeResult = calculateLCOE({
    capexTotal,
    omAnnual: Number(design.om_annual) || 0,
    omEscalationPct: Number(design.om_escalation_pct) || 5,
    discountRatePct: Number(design.discount_rate_pct) || 10,
    analysisPeriodYears: Number(design.analysis_period_years) || 25,
    year1GenKwh: annualPvKwh,
    pvTechnology: pvTech,
  });

  // 11. Build monthly summary
  const monthlySummary = buildMonthlySummary(bessResults.hourlyFlows, baselineBill, withSolarBill);

  // 12. Performance ratio
  const performanceRatio = pvCapacity > 0 ? Math.round(annualPvKwh / pvCapacity) : 0;

  // 13. Assemble results
  const results = {
    project_design_id: projectDesignId,
    run_at: new Date().toISOString(),

    annual_solar_gen_kwh: bessResults.annual.solar_gen_kwh,
    solar_utilised_kwh: bessResults.annual.solar_utilised_kwh,
    solar_exported_kwh: bessResults.annual.solar_exported_kwh,
    curtailed_kwh: bessResults.annual.curtailed_kwh,
    battery_discharged_kwh: bessResults.annual.battery_discharged_kwh,
    battery_charged_kwh: bessResults.annual.battery_charged_kwh,
    battery_cycles_annual: bessResults.annual.battery_cycles,
    grid_import_kwh: bessResults.annual.grid_import_kwh,
    grid_export_kwh: bessResults.annual.grid_export_kwh,

    peak_demand_before_kw: loadStats.peakKw,
    peak_demand_after_kw: bessResults.annual.peak_grid_demand_kw,

    performance_ratio: performanceRatio,
    utilisation_pct: bessResults.annual.utilisation_pct,
    self_consumption_pct: bessResults.annual.self_consumption_pct,

    baseline_annual_cost: Math.round(baselineAnnualCost),
    year1_annual_cost: Math.round(withSolarAnnualCost),
    year1_savings: Math.round(year1Savings),

    lcoe_normal: lcoeResult.lcoeNormal,
    lcoe_ls: lcoeResult.lcoeLS,

    npv_25yr: financials.npv,
    irr_pct: financials.irr,
    roi_pct: financials.roi,
    simple_payback_months: financials.paybackMonths,

    hourly_flows: bessResults.hourlyFlows,
    monthly_summary: monthlySummary,
    yearly_cashflow: financials.yearlyCashflow,
    tou_breakdown: baselineBill?.touBreakdown || null,
    executive_summary_text: null, // Will be filled by AI narration
  };

  // 14. Store results
  const { data: stored, error: storeErr } = await supabase
    .from('simulation_results')
    .insert(results)
    .select('id, run_at')
    .single();

  if (storeErr) {
    logger.error('Failed to store simulation results', { message: storeErr.message });
    throw storeErr;
  }

  // 15. Mark design as completed
  await supabase
    .from('projects')
    .update({ design_completed_at: new Date().toISOString() })
    .eq('id', design.project_id);

  return { ...results, id: stored.id };
}

/**
 * PV-only flows (no battery).
 */
function calculatePVOnlyFlows(hourlyPvKw, hourlyLoadKw) {
  const hourlyFlows = new Array(HOURS_PER_YEAR);
  let totalSolarUtilised = 0, totalGridImport = 0, totalGridExport = 0, peakGridDemand = 0;

  for (let h = 0; h < HOURS_PER_YEAR; h++) {
    const pv = hourlyPvKw[h] || 0;
    const load = hourlyLoadKw[h] || 0;
    const solarToLoad = Math.min(pv, load);
    const gridImport = Math.max(0, load - pv);
    const gridExport = Math.max(0, pv - load);

    totalSolarUtilised += solarToLoad;
    totalGridImport += gridImport;
    totalGridExport += gridExport;
    if (gridImport > peakGridDemand) peakGridDemand = gridImport;

    hourlyFlows[h] = {
      pv: Math.round(pv * 100) / 100,
      load: Math.round(load * 100) / 100,
      batt_charge: 0, batt_discharge: 0,
      grid_import: Math.round(gridImport * 100) / 100,
      grid_export: Math.round(gridExport * 100) / 100,
      soc: 0, curtailed: 0,
    };
  }

  const annualPvKwh = hourlyPvKw.reduce((s, v) => s + (v || 0), 0);
  const annualLoadKwh = hourlyLoadKw.reduce((s, v) => s + (v || 0), 0);

  return {
    hourlyFlows,
    annual: {
      solar_gen_kwh: Math.round(annualPvKwh * 100) / 100,
      solar_utilised_kwh: Math.round(totalSolarUtilised * 100) / 100,
      solar_exported_kwh: Math.round(totalGridExport * 100) / 100,
      curtailed_kwh: 0,
      battery_charged_kwh: 0,
      battery_discharged_kwh: 0,
      battery_cycles: 0,
      grid_import_kwh: Math.round(totalGridImport * 100) / 100,
      grid_export_kwh: Math.round(totalGridExport * 100) / 100,
      load_kwh: Math.round(annualLoadKwh * 100) / 100,
      peak_grid_demand_kw: Math.round(peakGridDemand * 100) / 100,
      utilisation_pct: annualPvKwh > 0 ? Math.round((totalSolarUtilised / annualPvKwh) * 10000) / 100 : 0,
      self_consumption_pct: annualLoadKwh > 0 ? Math.round((totalSolarUtilised / annualLoadKwh) * 10000) / 100 : 0,
    },
  };
}

/**
 * Build 12-month summary from hourly flows.
 */
function buildMonthlySummary(hourlyFlows, baselineBill, withSolarBill) {
  const monthly = [];
  let idx = 0;

  for (let m = 0; m < 12; m++) {
    const hoursInMonth = DAYS_PER_MONTH[m] * 24;
    const summary = {
      month: m + 1,
      pv_gen_kwh: 0, solar_utilised_kwh: 0, battery_charged_kwh: 0,
      battery_discharged_kwh: 0, grid_import_kwh: 0, grid_export_kwh: 0,
      curtailed_kwh: 0, load_kwh: 0, peak_demand_kw: 0, peak_grid_demand_kw: 0,
    };

    for (let h = 0; h < hoursInMonth && idx < hourlyFlows.length; h++, idx++) {
      const f = hourlyFlows[idx];
      summary.pv_gen_kwh += f.pv;
      summary.solar_utilised_kwh += Math.min(f.pv, f.load);
      summary.battery_charged_kwh += f.batt_charge;
      summary.battery_discharged_kwh += f.batt_discharge;
      summary.grid_import_kwh += f.grid_import;
      summary.grid_export_kwh += f.grid_export;
      summary.curtailed_kwh += f.curtailed;
      summary.load_kwh += f.load;
      if (f.load > summary.peak_demand_kw) summary.peak_demand_kw = f.load;
      if (f.grid_import > summary.peak_grid_demand_kw) summary.peak_grid_demand_kw = f.grid_import;
    }

    // Add cost data if available
    if (baselineBill) {
      summary.baseline_cost = baselineBill.monthly[m]?.total_cost || 0;
    }
    if (withSolarBill) {
      summary.with_solar_cost = withSolarBill.monthly[m]?.total_cost || 0;
      summary.savings = (summary.baseline_cost || 0) - summary.with_solar_cost;
    }

    // Round all values
    for (const key of Object.keys(summary)) {
      if (typeof summary[key] === 'number' && key !== 'month') {
        summary[key] = Math.round(summary[key] * 10) / 10;
      }
    }

    monthly.push(summary);
  }

  return monthly;
}

module.exports = {
  runSimulation,
};
