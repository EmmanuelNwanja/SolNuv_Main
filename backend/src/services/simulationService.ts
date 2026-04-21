/**
 * SolNuv Simulation Orchestrator
 * Master service that coordinates PV + BESS + Tariff + Financial simulation.
 */

const supabase = require('../config/database');
const logger = require('../utils/logger');
const { getHourlySolarResource } = require('./solarResourceService');
const { simulatePVGeneration, distributeHelioscapeToHourly } = require('./pvSimulationService');
const { simulateBESS } = require('./bessSimulationService');
const { buildHourlyTOUMap, calculateAnnualBill, resolveRatesForDate } = require('./tariffService');
const { calculate25YearCashflow, calculateLCOE, runCashflowScenarios } = require('./financialService');
const { calculateEnergyComparison } = require('./energyComparisonService');
const { calculateProfileStats } = require('./loadProfileService');
const { PANEL_TECHNOLOGIES, DEFAULT_PANEL_TECHNOLOGY, BATTERY_CHEMISTRIES, resolveChemistry } = require('../constants/technologyConstants');
const { buildRunProvenance } = require('./simulationProvenance');
const { getKpiFormulaReferences } = require('./formulaRegistry');
const { computeEnergyUncertainty } = require('./uncertaintyService');

const HOURS_PER_YEAR = 8760;
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Format number to 2 decimal places for warning messages */
function fmt2(n) { return Math.round(n * 100) / 100; }

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

  // 2. Load tariff structure + rates + ancillary (effective as of design creation).
  //    Using resolveRatesForDate so run_provenance can record the regime snapshot.
  let tariffStructure = null, tariffRates = [], ancillaryCharges = [];
  let tariffMeta = null;
  if (design.tariff_structure_id) {
    const asOf = design.created_at || new Date().toISOString();
    const resolved = await resolveRatesForDate({
      tariffStructureId: design.tariff_structure_id,
      asOf,
      supabase,
    });
    tariffStructure = resolved.structure;
    tariffRates = resolved.rates;
    ancillaryCharges = resolved.ancillaryCharges;
    tariffMeta = {
      tariff_structure_id: design.tariff_structure_id,
      structure_name: tariffStructure?.name || null,
      as_of: resolved.asOf,
      band_hash: resolved.bandHash,
      rates_count: tariffRates.length,
      ancillary_count: ancillaryCharges.length,
      effective_from: tariffStructure?.effective_from || null,
      effective_to: tariffStructure?.effective_to || null,
      out_of_window: Boolean(tariffStructure?.__out_of_window),
    };
  }

  // 3. Load hourly load profile
  let hourlyLoadKw = new Array(HOURS_PER_YEAR).fill(0);
  let loadProfileMeta = null;
  if (design.load_profile_id) {
    const { data: profileMeta } = await supabase
      .from('load_profiles')
      .select('id, source_type, annual_consumption_kwh, peak_demand_kw, load_factor, synthetic_priority_mode, synthetic_requested_peak_kw, synthetic_achieved_peak_kw, synthetic_requested_annual_kwh, synthetic_achieved_annual_kwh, synthetic_warnings')
      .eq('id', design.load_profile_id)
      .maybeSingle();
    loadProfileMeta = profileMeta || null;

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

  // 5. Run PV simulation (use user-supplied specs if present)
  let hourlyPvKw;
  let pvLossWaterfall = null;
  // Prefer user-supplied PV specs if present
  const pvCapacity = Number(design.pv_capacity_kwp) || Number(design.pv_rated_power_kw) || 0;
  const pvTech = design.pv_type || design.pv_technology || DEFAULT_PANEL_TECHNOLOGY;
  const pvModuleCount = Number(design.pv_module_count) || null;
  const pvEfficiency = Number(design.pv_efficiency) || null;
  const pvVoltage = Number(design.pv_voltage) || null;
  const pvCurrent = Number(design.pv_current) || null;

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
      dcAcRatio: Number(design.dc_ac_ratio) || 1.2,
      hourlyGhi: solarResource.hourlyGhi,
      hourlyTemp: solarResource.hourlyTemp,
      installationType: design.installation_type || 'rooftop_tilted',
      degradationYear: 1,
      moduleCount: pvModuleCount,
      efficiency: pvEfficiency,
      voltage: pvVoltage,
      current: pvCurrent,
    });
    hourlyPvKw = pvResult.hourlyAcKw;
    pvLossWaterfall = pvResult.loss_waterfall || null;
  } else {
    hourlyPvKw = new Array(HOURS_PER_YEAR).fill(0);
  }

  // 6. Build TOU map
  let touMap = null;
  if (tariffStructure && tariffRates.length > 0) {
    touMap = buildHourlyTOUMap(tariffStructure, tariffRates);
  }

  // 7. Run BESS simulation
  const gridTopology = design.grid_topology || 'grid_tied_bess';
  // Prefer user-supplied battery specs if present
  const bessCapacity = Number(design.battery_capacity_kwh) || Number(design.bess_capacity_kwh) || 0;
  const bessChemistry = design.battery_chemistry || design.bess_chemistry || 'lfp';
  const bessPowerKw =
    Number(design.bess_power_kw) ||
    Number(design.battery_power_kw) ||
    Number(design.pcs_power_kw) ||
    Number(design.inverter_rated_power_kw) ||
    null;
  const bessDodPct = Number(design.battery_dod_pct) || Number(design.bess_dod_pct) || 80;
  const bessCRate = Number(design.battery_crate) || Number(design.bess_c_rate) || 0.5;
  const bessRoundTripEff = (() => {
    const pct = Number(design.bess_round_trip_eff_pct);
    if (Number.isFinite(pct) && pct > 0) return pct / 100;
    const ratio = Number(design.bess_round_trip_efficiency);
    if (Number.isFinite(ratio) && ratio > 0) return ratio <= 1 ? ratio : ratio / 100;
    return 0.9;
  })();
  const batteryIsCompletePackage = !!design.battery_is_complete_package;
  const pcsPowerKw = Number(design.pcs_power_kw) || null;
  const pcsEfficiency = Number(design.pcs_efficiency) || null;
  const pcsType = design.pcs_type || null;
  let bessResults;

  // Build grid availability array for hybrid topology
  let gridAvailability = null;
  if (gridTopology === 'hybrid' && design.grid_outage_hours_day) {
    const outageHours = Number(design.grid_outage_hours_day) || 0;
    if (outageHours > 0) {
      // Model outages: grid is down for the first N hours of each day
      gridAvailability = new Array(HOURS_PER_YEAR);
      for (let h = 0; h < HOURS_PER_YEAR; h++) {
        const hourOfDay = h % 24;
        gridAvailability[h] = hourOfDay >= outageHours ? 1 : 0;
      }
    }
  }

  if (gridTopology === 'grid_tied' || (gridTopology !== 'off_grid' && bessCapacity <= 0)) {
    // Pure grid-tied (no battery) — PV-only self-consumption
    bessResults = calculatePVOnlyFlows(hourlyPvKw, hourlyLoadKw);
  } else if (bessCapacity > 0) {
    bessResults = simulateBESS({
      capacityKwh: bessCapacity,
      chemistry: bessChemistry,
      dodPct: bessDodPct,
      roundTripEff: bessRoundTripEff,
      cRate: bessCRate,
      powerKw: bessPowerKw,
      pcsPowerKw: batteryIsCompletePackage ? pcsPowerKw : undefined,
      pcsEfficiency: batteryIsCompletePackage ? pcsEfficiency : undefined,
      pcsType: batteryIsCompletePackage ? pcsType : undefined,
      strategy: design.bess_dispatch_strategy || 'self_consumption',
      peakShaveThresholdKw: Number(design.peak_shave_threshold_kw) || Infinity,
      allowGridCharge: design.bess_max_grid_charge || false,
      hourlyPvKw,
      hourlyLoadKw,
      touMap,
      gridTopology,
      gridAvailability,
    });
  } else {
    // Off-grid with no battery specified — still run BESS engine with 0 capacity to get unmet load
    bessResults = simulateBESS({
      capacityKwh: 0,
      chemistry: 'lfp',
      dodPct: 80,
      strategy: 'self_consumption',
      hourlyPvKw,
      hourlyLoadKw,
      gridTopology,
      gridAvailability,
    });
  }

  // 8. Calculate tariff costs — baseline and with-solar
  const loadStats = calculateProfileStats(hourlyLoadKw);
  let baselineBill = null, withSolarBill = null;

  if (gridTopology === 'off_grid') {
    // Off-grid: no grid tariff applies
    baselineBill = null;
    withSolarBill = null;
  } else if (tariffStructure && tariffRates.length > 0) {
    baselineBill = calculateAnnualBill(hourlyLoadKw, tariffStructure, tariffRates, ancillaryCharges, {
      peakDemandKva: loadStats.peakKw,
    });

    // With-solar: grid import profile
    const gridImportProfile = bessResults.hourlyFlows.map(f => f.grid_import);
    withSolarBill = calculateAnnualBill(gridImportProfile, tariffStructure, tariffRates, ancillaryCharges, {
      peakDemandKva: bessResults.annual.peak_grid_demand_kw,
    });
  }

  let baselineAnnualCost = baselineBill?.annual.total_cost || 0;
  let withSolarAnnualCost = withSolarBill?.annual.total_cost || 0;

  // For off-grid systems with no grid tariff, derive baseline from diesel-equivalent cost
  // so savings and financial metrics are meaningful (savings = diesel cost avoided by solar)
  if (gridTopology === 'off_grid' && baselineAnnualCost === 0) {
    const annualLoadForBaseline = bessResults.annual.load_kwh;
    const dieselPricePerLitre = Number(design.diesel_price_per_litre) || 1100;
    const DIESEL_KWH_PER_LITRE = 3.5;
    const dieselLitresBaseline = annualLoadForBaseline / DIESEL_KWH_PER_LITRE;
    const dieselFuelBaseline = dieselLitresBaseline * dieselPricePerLitre;
    const dieselRunHours = annualLoadForBaseline > 0 ? 8760 * 0.7 : 0;
    const dieselMaintBaseline = dieselRunHours * 500; // ₦500/hr maintenance
    baselineAnnualCost = Math.round(dieselFuelBaseline + dieselMaintBaseline);
    withSolarAnnualCost = 0; // Off-grid solar has no residual grid cost
  }

  const year1Savings = baselineAnnualCost - withSolarAnnualCost;

  // 9. Run financial model
  const capexTotal = Number(design.capex_total) || 0;
  const annualPvKwh = bessResults.annual.solar_gen_kwh;
  const bessChemistryResolved = resolveChemistry(design.bess_chemistry);

  const financialConfig = {
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
    bessChemistry: bessChemistryResolved,
    bessDodPct: Number(design.bess_dod_pct) || 80,
    annualBatteryCycles: bessResults.annual.battery_cycles || 0,
    bessCapexShare: (design.capex_breakdown?.bess) || capexTotal * 0.4,
    financingType: design.financing_type || 'cash',
    loanInterestRatePct: Number(design.loan_interest_rate_pct) || 0,
    loanTermYears: Number(design.loan_term_years) || 0,
    ppaRatePerKwh: Number(design.ppa_rate_per_kwh) || 0,
    ppaEscalationPct: Number(design.ppa_escalation_pct) || 0,
    baselineAnnualCost,
  };
  const financials = calculate25YearCashflow(financialConfig);

  // Monte Carlo risk envelope around the base case. Seeded so the same design
  // always produces the same P10/P50/P90 band — CI-stable and audit-safe.
  const financialRisk = runCashflowScenarios(financialConfig, { iterations: 500, seed: 1337 });

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

  // 12b. Energy source comparison (solar vs grid vs diesel vs petrol)
  const energyComparison = calculateEnergyComparison({
    annualLoadKwh: bessResults.annual.load_kwh,
    annualSolarGenKwh: annualPvKwh,
    solarUtilisedKwh: bessResults.annual.solar_utilised_kwh,
    gridImportKwh: bessResults.annual.grid_import_kwh,
    unmetLoadKwh: bessResults.annual.unmet_load_kwh || 0,
    gridTopology,
    baselineAnnualCost,
    withSolarAnnualCost,
    capexTotal,
    analysisPeriodYears: Number(design.analysis_period_years) || 25,
    tariffEscalationPct: Number(design.tariff_escalation_pct) || 8,
    dieselPricePerLitre: Number(design.diesel_price_per_litre) || 1100,
    petrolPricePerLitre: Number(design.petrol_price_per_litre) || 700,
    fuelEscalationPct: Number(design.fuel_escalation_pct) || 10,
    country: design.country_code || 'NG',
    gridAvailabilityPct: Number(design.grid_availability_pct) || 100,
    batteryDischargedKwh: bessResults.annual.battery_discharged_kwh,
    feedInRevenue: 0, // calculated below
  });
  const energyUncertainty = computeEnergyUncertainty({
    annualGenerationKwh: annualPvKwh,
  });

  // 12c. Generate design validation warnings
  const designWarnings = [];
  // Prefer user-supplied inverter specs if present
  const inverterRatedPower = Number(design.inverter_rated_power_kw) || (pvCapacity / (Number(design.dc_ac_ratio) || 1.2));
  const inverterType = design.inverter_type || null;
  const inverterPhases = Number(design.inverter_phases) || null;
  const inverterBrand = design.inverter_brand || null;
  const inverterModel = design.inverter_model || null;
  const inverterEfficiency = Number(design.inverter_efficiency) || null;
  // Inverter undersized for peak load (critical for off-grid/hybrid)
  if ((gridTopology === 'off_grid' || gridTopology === 'hybrid') && loadStats.peakKw > inverterRatedPower * 1.05) {
    designWarnings.push({
      type: 'inverter_undersized',
      severity: 'critical',
      message: `Inverter AC capacity (${fmt2(inverterRatedPower)} kW${inverterBrand ? `, ${inverterBrand}` : ''}${inverterModel ? `, ${inverterModel}` : ''}) is below peak load demand (${fmt2(loadStats.peakKw)} kW). The system cannot serve full peak load during grid outages. Consider increasing inverter size or selecting a higher-rated model.`,
    });
  }

  // BESS power rating insufficient for peak demand (off-grid/hybrid)
  if (bessCapacity > 0) {
    const bessPowerKw = bessCapacity * (Number(design.bess_c_rate) || 0.5);
    if ((gridTopology === 'off_grid' || gridTopology === 'hybrid') && bessPowerKw < loadStats.peakKw * 0.7) {
      designWarnings.push({
        type: 'bess_power_low',
        severity: 'warning',
        message: `Battery max discharge power (${fmt2(bessPowerKw)} kW at ${design.bess_c_rate || 0.5}C) is significantly below peak demand (${fmt2(loadStats.peakKw)} kW). During evening/night peaks without solar, unmet load is likely. Consider a higher C-rate battery or larger capacity.`,
      });
    }
  }

  // Very low load factor — spiky load profile warning
  if (loadStats.loadFactor > 0 && loadStats.loadFactor < 0.2) {
    designWarnings.push({
      type: 'spiky_load_profile',
      severity: 'info',
      message: `Load profile has a very low load factor (${(loadStats.loadFactor * 100).toFixed(0)}%) — peak demand (${fmt2(loadStats.peakKw)} kW) is ${Math.round(1 / loadStats.loadFactor)}× the average (${fmt2(loadStats.averageKw)} kW). Ensure inverter and battery power ratings can handle peak transients.`,
    });
  }

  // High unmet load for off-grid/hybrid
  if (bessResults.annual.unmet_load_kwh > 0 && bessResults.annual.load_kwh > 0) {
    const unmetPct = (bessResults.annual.unmet_load_kwh / bessResults.annual.load_kwh * 100);
    if (unmetPct > 5) {
      designWarnings.push({
        type: 'high_unmet_load',
        severity: unmetPct > 15 ? 'critical' : 'warning',
        message: `${fmt2(unmetPct)}% of annual load (${Math.round(bessResults.annual.unmet_load_kwh)} kWh) cannot be served. Consider increasing PV capacity, battery storage, or adding a backup generator.`,
      });
    }
  }

  // Heavy battery cycling
  if (bessResults.annual.battery_cycles > 0) {
    const cycleLifeEstimate = design.bess_chemistry === 'lfp' ? 6000 : design.bess_chemistry === 'nmc' ? 3000 : 4000;
    const yearsToReplacement = bessResults.annual.battery_cycles > 0 ? Math.round(cycleLifeEstimate / bessResults.annual.battery_cycles * 10) / 10 : null;
    if (yearsToReplacement && yearsToReplacement < 5) {
      designWarnings.push({
        type: 'heavy_cycling',
        severity: 'warning',
        message: `Battery is heavily cycled (${Math.round(bessResults.annual.battery_cycles)} cycles/year). Estimated replacement needed in ~${yearsToReplacement} years. Consider a larger battery to reduce cycle depth and extend lifespan.`,
      });
    }
  }

  // 13. Assemble results
  const feedInTariff = Number(design.feed_in_tariff_per_kwh) || 0;
  const feedInRevenue = feedInTariff > 0 ? Math.round(bessResults.annual.grid_export_kwh * feedInTariff * 100) / 100 : 0;

  const results: any = {
    project_design_id: projectDesignId,
    run_at: new Date().toISOString(),
    grid_topology: gridTopology,

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

    // Topology-specific metrics
    unmet_load_kwh: bessResults.annual.unmet_load_kwh || 0,
    unmet_load_hours: bessResults.annual.unmet_load_hours || 0,
    loss_of_load_pct: bessResults.annual.loss_of_load_pct || 0,
    autonomy_achieved_days: bessCapacity > 0 && loadStats.averageKw > 0
      ? Math.round((bessCapacity * (Number(design.bess_dod_pct) || 80) / 100) / (loadStats.averageKw * 24) * 10) / 10
      : 0,
    islanded_hours: bessResults.annual.islanded_hours || 0,
    feed_in_revenue: feedInRevenue,

    hourly_flows: bessResults.hourlyFlows,
    monthly_summary: monthlySummary,
    yearly_cashflow: financials.yearlyCashflow,
    tou_breakdown: baselineBill?.touBreakdown || null,
    energy_comparison: energyComparison,
    installation_type: design.installation_type || 'rooftop_tilted',
    co2_avoided_tonnes: energyComparison.environmental.co2_avoided_lifetime_tonnes,
    diesel_annual_cost: energyComparison.annual_costs.diesel,
    petrol_annual_cost: energyComparison.annual_costs.petrol,
    grid_only_annual_cost: energyComparison.annual_costs.grid_only,
    executive_summary_text: null, // Will be filled by AI narration
    design_warnings: designWarnings.length > 0 ? designWarnings : null,
    design_snapshot: {
      project_design_id: design.id,
      project_id: design.project_id,
      tariff_structure_id: design.tariff_structure_id,
      load_profile_id: design.load_profile_id,
      location_lat: design.location_lat,
      location_lon: design.location_lon,
      pv_capacity_kwp: design.pv_capacity_kwp,
      pv_technology: design.pv_technology,
      pv_tilt_deg: design.pv_tilt_deg,
      pv_azimuth_deg: design.pv_azimuth_deg,
      pv_generation_source: design.pv_generation_source,
      pv_system_losses_pct: design.pv_system_losses_pct,
      pv_degradation_annual_pct: design.pv_degradation_annual_pct,
      bess_capacity_kwh: design.bess_capacity_kwh,
      bess_chemistry: design.bess_chemistry,
      bess_dispatch_strategy: design.bess_dispatch_strategy,
      peak_shave_threshold_kw: design.peak_shave_threshold_kw,
      bess_dod_pct: design.bess_dod_pct,
      bess_round_trip_eff_pct: design.bess_round_trip_eff_pct,
      capex_total: design.capex_total,
      om_annual: design.om_annual,
      discount_rate_pct: design.discount_rate_pct,
      tariff_escalation_pct: design.tariff_escalation_pct,
      financing_type: design.financing_type,
      loan_interest_rate_pct: design.loan_interest_rate_pct,
      loan_term_years: design.loan_term_years,
      analysis_period_years: design.analysis_period_years,
      grid_topology: design.grid_topology,
      installation_type: design.installation_type,
      autonomy_days: design.autonomy_days,
      backup_generator_kw: design.backup_generator_kw,
      diesel_cost_per_litre: design.diesel_cost_per_litre,
      grid_availability_pct: design.grid_availability_pct,
      grid_outage_hours_day: design.grid_outage_hours_day,
      feed_in_tariff_per_kwh: design.feed_in_tariff_per_kwh,
    },
  };

  // 13b. Extended metrics: engine outputs that don't have dedicated columns.
  //      Shape is versioned alongside run_provenance.engine_version.
  results.extended_metrics = {
    pv_loss_waterfall: pvLossWaterfall,
    financial_risk: financialRisk,
    uncertainty: energyUncertainty,
    formula_references: getKpiFormulaReferences(),
    load_profile_consistency: loadProfileMeta ? {
      source_type: loadProfileMeta.source_type || null,
      annual_consumption_kwh: loadProfileMeta.annual_consumption_kwh,
      peak_demand_kw: loadProfileMeta.peak_demand_kw,
      load_factor: loadProfileMeta.load_factor,
      priority_mode: loadProfileMeta.synthetic_priority_mode || null,
      requested_peak_kw: loadProfileMeta.synthetic_requested_peak_kw,
      achieved_peak_kw: loadProfileMeta.synthetic_achieved_peak_kw,
      requested_annual_kwh: loadProfileMeta.synthetic_requested_annual_kwh,
      achieved_annual_kwh: loadProfileMeta.synthetic_achieved_annual_kwh,
      warnings: Array.isArray(loadProfileMeta.synthetic_warnings) ? loadProfileMeta.synthetic_warnings : [],
    } : null,
  };

  // 13c. Provenance: stamp engine version, inputs hash, weather + tariff meta.
  results.run_provenance = buildRunProvenance({
    designSnapshot: results.design_snapshot,
    weatherMeta: solarResource.meta || null,
    tariffMeta,
    extra: {
      grid_topology: gridTopology,
      analysis_period_years: Number(design.analysis_period_years) || 25,
    },
  });

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
  try {
    await supabase
      .from('projects')
      .update({ design_completed_at: new Date().toISOString() })
      .eq('id', design.project_id);
  } catch (err) {
    logger.error('Failed to update design_completed_at', { projectId: design.project_id, error: err.message });
  }

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
    const summary: Record<string, any> = {
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

/**
 * Lightweight "preview" simulation for the design wizard.
 *
 * Runs the same PV + BESS + finance engines as the full orchestrator but:
 *   - Accepts an in-memory config (no project_designs / simulation_results row).
 *   - Builds a flat load profile from annual_load_kwh (caller can later pass a
 *     shape id once we productise that).
 *   - Uses a simple flat tariff rate instead of TOU bands.
 *   - Skips hourly persistence, AI narration, and energy-comparison modelling.
 *
 * The goal is sub-second feedback while the user tweaks slider inputs.
 */
async function runSimulationPreview(config) {
  const {
    lat = 6.5,
    lon = 3.4,
    pv_capacity_kwp = 0,
    pv_technology = DEFAULT_PANEL_TECHNOLOGY,
    tilt_deg,
    azimuth_deg,
    system_losses_pct = 14,
    inverter_eff_pct = 96,
    dc_ac_ratio = 1.2,
    installation_type = 'rooftop_tilted',
    bess_capacity_kwh = 0,
    bess_chemistry = 'lfp',
    bess_dod_pct = 80,
    bess_c_rate = 0.5,
    grid_topology = 'grid_tied_bess',
    annual_load_kwh = 0,
    baseline_tariff_per_kwh = 0,
    capex_total = 0,
    om_annual = 0,
    om_escalation_pct = 5,
    tariff_escalation_pct = 8,
    discount_rate_pct = 10,
    analysis_period_years = 25,
    financing_type = 'cash',
    include_risk = true,
  } = config || {};

  const solarResource = await getHourlySolarResource(Number(lat), Number(lon));

  let hourlyPvKw = new Array(HOURS_PER_YEAR).fill(0);
  let pvLossWaterfall = null;
  if (pv_capacity_kwp > 0) {
    const pvResult = simulatePVGeneration({
      capacityKwp: Number(pv_capacity_kwp),
      tiltDeg: Number(tilt_deg) || Math.abs(Number(lat)),
      azimuthDeg: Number(azimuth_deg) || (Number(lat) >= 0 ? 180 : 0),
      lat: Number(lat),
      technology: pv_technology,
      systemLossesPct: Number(system_losses_pct),
      inverterEffPct: Number(inverter_eff_pct),
      dcAcRatio: Number(dc_ac_ratio),
      hourlyGhi: solarResource.hourlyGhi,
      hourlyTemp: solarResource.hourlyTemp,
      installationType: installation_type,
      degradationYear: 1,
    });
    hourlyPvKw = pvResult.hourlyAcKw;
    pvLossWaterfall = pvResult.loss_waterfall || null;
  }

  const avgLoadKw = Number(annual_load_kwh) > 0 ? Number(annual_load_kwh) / HOURS_PER_YEAR : 0;
  const hourlyLoadKw = new Array(HOURS_PER_YEAR).fill(avgLoadKw);

  let bessResults;
  if (bess_capacity_kwh > 0 && grid_topology !== 'grid_tied') {
    bessResults = simulateBESS({
      capacityKwh: Number(bess_capacity_kwh),
      chemistry: bess_chemistry,
      dodPct: Number(bess_dod_pct),
      cRate: Number(bess_c_rate),
      strategy: 'self_consumption',
      hourlyPvKw,
      hourlyLoadKw,
      gridTopology: grid_topology,
    });
  } else {
    bessResults = calculatePVOnlyFlows(hourlyPvKw, hourlyLoadKw);
  }

  const annualPvKwh = bessResults.annual.solar_gen_kwh;
  const solarUtilisedKwh = bessResults.annual.solar_utilised_kwh;
  const gridImportKwh = bessResults.annual.grid_import_kwh;
  const rate = Math.max(0, Number(baseline_tariff_per_kwh) || 0);
  const baselineAnnualCost = Number(annual_load_kwh) * rate;
  const withSolarAnnualCost = gridImportKwh * rate;
  const year1Savings = baselineAnnualCost - withSolarAnnualCost;

  const financialConfig = {
    analysisPeriodYears: Number(analysis_period_years) || 25,
    capexTotal: Number(capex_total) || 0,
    omAnnual: Number(om_annual) || 0,
    omEscalationPct: Number(om_escalation_pct) || 5,
    tariffEscalationPct: Number(tariff_escalation_pct) || 8,
    discountRatePct: Number(discount_rate_pct) || 10,
    year1Savings,
    year1GenKwh: annualPvKwh,
    pvTechnology: pv_technology,
    bessCapacityKwh: Number(bess_capacity_kwh) || 0,
    bessChemistry: resolveChemistry(bess_chemistry),
    bessDodPct: Number(bess_dod_pct) || 80,
    annualBatteryCycles: bessResults.annual.battery_cycles || 0,
    financingType: financing_type,
    baselineAnnualCost,
  };
  const financials = calculate25YearCashflow(financialConfig);
  const lcoe = calculateLCOE({
    capexTotal: financialConfig.capexTotal,
    omAnnual: financialConfig.omAnnual,
    omEscalationPct: financialConfig.omEscalationPct,
    discountRatePct: financialConfig.discountRatePct,
    analysisPeriodYears: financialConfig.analysisPeriodYears,
    year1GenKwh: annualPvKwh,
    pvTechnology: pv_technology,
  });

  const financialRisk = include_risk
    ? runCashflowScenarios(financialConfig, { iterations: 200, seed: 1337 })
    : null;

  return {
    annual_solar_gen_kwh: annualPvKwh,
    solar_utilised_kwh: solarUtilisedKwh,
    grid_import_kwh: gridImportKwh,
    year1_savings: Math.round(year1Savings),
    baseline_annual_cost: Math.round(baselineAnnualCost),
    npv_25yr: financials.npv,
    irr_pct: financials.irr,
    roi_pct: financials.roi,
    simple_payback_months: financials.paybackMonths,
    lcoe_normal: lcoe.lcoeNormal,
    financial_risk: financialRisk,
    pv_loss_waterfall: pvLossWaterfall,
    weather_meta: solarResource.meta || null,
  };
}

module.exports = {
  runSimulation,
  runSimulationPreview,
};
