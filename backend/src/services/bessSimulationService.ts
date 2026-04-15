/**
 * SolNuv BESS Dispatch Engine
 * Hourly battery energy storage system simulation with 4 dispatch strategies:
 * 1. Self-consumption maximization
 * 2. TOU arbitrage (charge off-peak, discharge peak)
 * 3. Peak demand shaving
 * 4. Load shedding backup
 */

const { BATTERY_CHEMISTRIES, resolveChemistry, cyclesAtDoD } = require('../constants/technologyConstants');

const HOURS_PER_YEAR = 8760;

/**
 * Run BESS dispatch simulation for a full year.
 *
 * @param {object} config
 * @param {number} config.capacityKwh - Total battery capacity (kWh)
 * @param {string} config.chemistry - Battery chemistry key
 * @param {number} config.dodPct - Depth of discharge (%)
 * @param {number} config.cRate - C-rate for max charge/discharge (default 0.5)
 * @param {string} config.strategy - 'self_consumption'|'tou_arbitrage'|'peak_shave'|'backup'
 * @param {number} config.peakShaveThresholdKw - Grid import limit for peak shaving (kW)
 * @param {boolean} config.allowGridCharge - Allow charging from grid (for arbitrage)
 * @param {number[]} config.hourlyPvKw - 8760 PV generation array (kW)
 * @param {number[]} config.hourlyLoadKw - 8760 load array (kW)
 * @param {Array} [config.touMap] - 8760 TOU period info from tariffService
 * @param {string} [config.gridTopology] - 'grid_tied_bess'|'off_grid'|'hybrid'
 * @param {number[]} [config.gridAvailability] - 8760 booleans (1=grid available, 0=outage)
 * @returns {object} Dispatch results with hourly flows and annual metrics
 */
function simulateBESS(config) {
  const {
    capacityKwh,
    chemistry = 'lfp',
    dodPct = 80,
    cRate = 0.5,
    strategy = 'self_consumption',
    peakShaveThresholdKw = Infinity,
    allowGridCharge = false,
    hourlyPvKw,
    hourlyLoadKw,
    touMap = null,
    gridTopology = 'grid_tied_bess',
    gridAvailability = null,
  } = config;

  const isOffGrid = gridTopology === 'off_grid';
  const isHybrid = gridTopology === 'hybrid';

  const chem = BATTERY_CHEMISTRIES[resolveChemistry(chemistry)];
  const roundTripEff = chem ? chem.round_trip_eff : 0.95;
  // Asymmetric efficiency: charging has more loss than discharging
  // Typical LFP: charge ~97%, discharge ~99.5% → RTE ~96.5%
  // For other chemistries, weight 60% loss on charge, 40% on discharge
  const chargeEff = Math.pow(roundTripEff, 0.6);
  const dischargeEff = Math.pow(roundTripEff, 0.4);

  // Self-discharge rate per hour (calendar loss)
  // LFP: ~0.5%/month at 25°C, scales with temperature sensitivity
  const monthlySelfdischargePct = chem ? (chem.annual_soh_loss_pct * 100 / 12) : 0.04;
  const selfDischargePerHour = monthlySelfdischargePct / (30 * 24) / 100;

  const minSoc = capacityKwh * (1 - dodPct / 100);
  const maxSoc = capacityKwh;
  const maxChargeKw = capacityKwh * cRate;
  const maxDischargeKw = capacityKwh * cRate;

  // State tracking
  let soc = minSoc + (maxSoc - minSoc) * 0.5; // Start at 50% usable

  const hourlyFlows = new Array(HOURS_PER_YEAR);
  let totalCharged = 0;
  let totalDischarged = 0;
  let totalGridImport = 0;
  let totalGridExport = 0;
  let totalCurtailed = 0;
  let totalSolarUtilised = 0;
  let peakGridDemand = 0;
  let totalUnmetLoad = 0;
  let unmetLoadHours = 0;
  let islandedHours = 0;

  for (let h = 0; h < HOURS_PER_YEAR; h++) {
    const pvKw = hourlyPvKw[h] || 0;
    const loadKw = hourlyLoadKw[h] || 0;
    const touPeriod = touMap ? touMap[h]?.period_name : null;

    let battCharge = 0;
    let battDischarge = 0;
    let gridImport = 0;
    let gridExport = 0;
    let curtailed = 0;
    let solarToLoad = 0;

    // Net power: positive = surplus PV, negative = deficit
    const net = pvKw - loadKw;

    // Determine if grid is available this hour
    const gridAvail = isOffGrid ? false : (gridAvailability ? !!gridAvailability[h] : true);

    if (!gridAvail && isHybrid) islandedHours++;

    if (isOffGrid || !gridAvail) {
      // Off-grid or islanded: NO grid import/export allowed
      ({ battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad } =
        dispatchOffGrid(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw,
          chargeEff, dischargeEff));
      // Track unmet load
      const unmet = loadKw - solarToLoad - battDischarge;
      if (unmet > 0.01) {
        totalUnmetLoad += unmet;
        unmetLoadHours++;
      }
    } else {
      // Grid-connected dispatch
      switch (strategy) {
      case 'tou_arbitrage':
        ({ battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad } =
          dispatchTOUArbitrage(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw,
            chargeEff, dischargeEff, touPeriod, allowGridCharge));
        break;

      case 'peak_shave':
        ({ battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad } =
          dispatchPeakShave(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw,
            chargeEff, dischargeEff, peakShaveThresholdKw));
        break;

      case 'backup':
        ({ battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad } =
          dispatchSelfConsumption(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw,
            chargeEff, dischargeEff));
        break;

      case 'self_consumption':
      default:
        ({ battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad } =
          dispatchSelfConsumption(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw,
            chargeEff, dischargeEff));
        break;
    }
    } // end grid-connected else

    // Update SOC (with self-discharge)
    soc = soc + (battCharge * chargeEff) - (battDischarge / dischargeEff);
    // Apply hourly self-discharge (calendar aging)
    soc *= (1 - selfDischargePerHour);
    soc = Math.max(minSoc, Math.min(maxSoc, soc));

    // Track grid peak
    if (gridImport > peakGridDemand) peakGridDemand = gridImport;

    // Accumulate
    totalCharged += battCharge;
    totalDischarged += battDischarge;
    totalGridImport += gridImport;
    totalGridExport += gridExport;
    totalCurtailed += curtailed;
    totalSolarUtilised += solarToLoad;

    hourlyFlows[h] = {
      pv: round2(pvKw),
      load: round2(loadKw),
      batt_charge: round2(battCharge),
      batt_discharge: round2(battDischarge),
      grid_import: round2(gridImport),
      grid_export: round2(gridExport),
      soc: round2(soc),
      curtailed: round2(curtailed),
    };
  }

  // Annual metrics
  const annualPvKwh = hourlyPvKw.reduce((s, v) => s + (v || 0), 0);
  const annualLoadKwh = hourlyLoadKw.reduce((s, v) => s + (v || 0), 0);
  const cycleEquivalents = capacityKwh > 0 ? totalDischarged / (capacityKwh * dodPct / 100) : 0;

  return {
    hourlyFlows,
    annual: {
      solar_gen_kwh: round2(annualPvKwh),
      solar_utilised_kwh: round2(totalSolarUtilised),
      solar_exported_kwh: round2(totalGridExport),
      curtailed_kwh: round2(totalCurtailed),
      battery_charged_kwh: round2(totalCharged),
      battery_discharged_kwh: round2(totalDischarged),
      battery_cycles: round2(cycleEquivalents),
      grid_import_kwh: round2(totalGridImport),
      grid_export_kwh: round2(totalGridExport),
      load_kwh: round2(annualLoadKwh),
      peak_grid_demand_kw: round2(peakGridDemand),
      utilisation_pct: annualPvKwh > 0 ? round2((totalSolarUtilised / annualPvKwh) * 100) : 0,
      self_consumption_pct: annualLoadKwh > 0
        ? round2(((totalSolarUtilised + totalDischarged) / annualLoadKwh) * 100) : 0,
      unmet_load_kwh: round2(totalUnmetLoad),
      unmet_load_hours: unmetLoadHours,
      loss_of_load_pct: annualLoadKwh > 0 ? round2((totalUnmetLoad / annualLoadKwh) * 100) : 0,
      islanded_hours: islandedHours,
    },
  };
}

// ─── DISPATCH STRATEGIES ─────────────────────────────────────────────────────

function dispatchSelfConsumption(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw, chargeEff, dischargeEff) {
  let battCharge = 0, battDischarge = 0, gridImport = 0, gridExport = 0, curtailed = 0;
  let solarToLoad = 0;

  if (net >= 0) {
    // Surplus PV
    solarToLoad = loadKw;
    const surplus = net;

    // Charge battery with surplus
    const canCharge = Math.min(surplus, maxChargeKw, (maxSoc - soc) / chargeEff);
    battCharge = Math.max(0, canCharge);

    const remaining = surplus - battCharge;
    if (remaining > 0) {
      gridExport = remaining; // or curtailed if no export allowed
      curtailed = 0; // Assuming export is allowed
    }
  } else {
    // Deficit — PV insufficient
    solarToLoad = pvKw;
    const deficit = -net;

    // Discharge battery
    const canDischarge = Math.min(deficit, maxDischargeKw, (soc - minSoc) * dischargeEff);
    battDischarge = Math.max(0, canDischarge);

    gridImport = deficit - battDischarge;
  }

  return { battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad };
}

function dispatchTOUArbitrage(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw, chargeEff, dischargeEff, touPeriod, allowGridCharge) {
  let battCharge = 0, battDischarge = 0, gridImport = 0, gridExport = 0, curtailed = 0;
  let solarToLoad = 0;

  if (touPeriod === 'peak') {
    // Peak: discharge battery aggressively
    solarToLoad = Math.min(pvKw, loadKw);
    const deficit = loadKw - pvKw;

    if (deficit > 0) {
      const canDischarge = Math.min(deficit, maxDischargeKw, (soc - minSoc) * dischargeEff);
      battDischarge = Math.max(0, canDischarge);
      gridImport = deficit - battDischarge;
    } else {
      // Surplus during peak — export or charge
      const surplus = -deficit;
      const canCharge = Math.min(surplus, maxChargeKw, (maxSoc - soc) / chargeEff);
      battCharge = Math.max(0, canCharge);
      gridExport = surplus - battCharge;
    }
  } else if (touPeriod === 'off_peak') {
    // Off-peak: charge battery (from PV surplus first, then grid if allowed)
    solarToLoad = Math.min(pvKw, loadKw);

    if (net >= 0) {
      const surplus = net;
      const canCharge = Math.min(surplus, maxChargeKw, (maxSoc - soc) / chargeEff);
      battCharge = Math.max(0, canCharge);
      gridExport = surplus - battCharge;
    } else {
      const deficit = -net;
      // Charge from grid during off-peak if allowed
      if (allowGridCharge) {
        const canCharge = Math.min(maxChargeKw, (maxSoc - soc) / chargeEff);
        battCharge = Math.max(0, canCharge);
        gridImport = deficit + battCharge;
      } else {
        gridImport = deficit;
      }
    }
  } else {
    // Standard hours: self-consumption only
    return dispatchSelfConsumption(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw, chargeEff, dischargeEff);
  }

  return { battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad };
}

function dispatchPeakShave(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw, chargeEff, dischargeEff, threshold) {
  let battCharge = 0, battDischarge = 0, gridImport = 0, gridExport = 0, curtailed = 0;
  let solarToLoad = 0;

  // First: self-consumption
  if (net >= 0) {
    solarToLoad = loadKw;
    const surplus = net;
    const canCharge = Math.min(surplus, maxChargeKw, (maxSoc - soc) / chargeEff);
    battCharge = Math.max(0, canCharge);
    gridExport = surplus - battCharge;
  } else {
    solarToLoad = pvKw;
    const deficit = -net;

    // Check if grid import would exceed threshold
    if (deficit > threshold) {
      // Discharge battery to bring grid import down to threshold
      const neededDischarge = deficit - threshold;
      const canDischarge = Math.min(neededDischarge, maxDischargeKw, (soc - minSoc) * dischargeEff);
      battDischarge = Math.max(0, canDischarge);
      gridImport = deficit - battDischarge;
    } else {
      gridImport = deficit;
      // Charge battery when below threshold to prepare for peak
      const headroom = threshold - deficit;
      if (headroom > 0) {
        const canCharge = Math.min(headroom, maxChargeKw, (maxSoc - soc) / chargeEff);
        battCharge = Math.max(0, canCharge);
        gridImport += battCharge; // Grid also feeds battery
      }
    }
  }

  return { battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad };
}

function dispatchOffGrid(net, pvKw, loadKw, soc, minSoc, maxSoc, maxChargeKw, maxDischargeKw, chargeEff, dischargeEff) {
  let battCharge = 0, battDischarge = 0, gridImport = 0, gridExport = 0, curtailed = 0;
  let solarToLoad = 0;

  // No grid — only PV + battery can serve load
  if (net >= 0) {
    // PV surplus
    solarToLoad = loadKw;
    const surplus = net;
    const canCharge = Math.min(surplus, maxChargeKw, (maxSoc - soc) / chargeEff);
    battCharge = Math.max(0, canCharge);
    // Cannot export — curtail the rest
    curtailed = surplus - battCharge;
  } else {
    // PV deficit — battery must cover
    solarToLoad = pvKw;
    const deficit = -net;
    const canDischarge = Math.min(deficit, maxDischargeKw, (soc - minSoc) * dischargeEff);
    battDischarge = Math.max(0, canDischarge);
    // Remaining deficit is unmet load (no grid to import from)
    // gridImport stays 0 — caller tracks unmet separately
  }

  return { battCharge, battDischarge, gridImport, gridExport, curtailed, solarToLoad };
}

function round2(v) {
  return Math.round((v || 0) * 100) / 100;
}

module.exports = {
  simulateBESS,
};
