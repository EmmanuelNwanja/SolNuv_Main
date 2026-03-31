/**
 * SolNuv Calculator Controller
 * Public demo calculators — no auth required
 */

const { sendSuccess, sendError } = require('../utils/responseHelper');
const { calculatePanelValue, calculateBatteryValue, getSilverPrice } = require('../services/silverService');
const { calculateDecommissionDate } = require('../services/degradationService');
const { generateProposalPdf, generateCableComplianceCertificate } = require('../services/pdfService');
const supabase = require('../config/database');

const TARIFF_BANDS = {
  A: 225,
  B: 63,
  C: 50,
  D: 41,
  E: 32,
};

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cycleLifeAtDoD(chemistry, dodPct) {
  const dod = Math.max(5, Math.min(100, toNum(dodPct, 60)));
  if (chemistry === 'lithium-iron-phosphate' || chemistry === 'lithium') {
    const a = 9500;
    const b = 1.12;
    return a * Math.pow(100 / dod, b);
  }
  if (chemistry === 'lead-acid') {
    const a = 1600;
    const b = 1.18;
    return a * Math.pow(100 / dod, b);
  }

  const a = 4000;
  const b = 1.1;
  return a * Math.pow(100 / dod, b);
}

function nearestStandardMm2(required) {
  const standards = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  const req = Math.max(0.5, toNum(required, 1.5));
  return standards.find((v) => v >= req) || 240;
}

/**
 * POST /api/calculator/panel
 * Full panel valuation: silver + second-life + recommendation
 */
exports.calculatePanel = async (req, res) => {
  try {
    const {
      size_watts       = 400,
      quantity         = 1,
      installation_date,
      climate_zone     = 'mixed',
      condition        = 'good',
    } = req.body;

    if (parseFloat(size_watts) <= 0) return sendError(res, 'Panel wattage must be greater than 0', 400);
    if (parseInt(quantity) <= 0)     return sendError(res, 'Quantity must be at least 1', 400);
    if (parseInt(quantity) > 200000) return sendError(res, 'Maximum 200,000 panels per calculation', 400);

    const result = await calculatePanelValue(
      parseFloat(size_watts),
      parseInt(quantity),
      installation_date || null,
      climate_zone,
      condition,
    );

    return sendSuccess(res, result);
  } catch (error) {
    console.error('Panel calc error:', error);
    return sendError(res, 'Calculation failed', 500);
  }
};

/**
 * POST /api/calculator/silver
 * Legacy endpoint — kept for compatibility, now returns full panel value
 */
exports.calculateSilver = async (req, res) => {
  try {
    const { size_watts = 400, quantity = 1, brand = 'Other', installation_date } = req.body;

    const result = await calculatePanelValue(
      parseFloat(size_watts),
      parseInt(quantity),
      installation_date || null,
      'mixed',
      'good',
    );

    // Return full result with legacy-compatible fields
    return sendSuccess(res, {
      ...result,
      // Legacy aliases still present so existing frontend code doesn't break
      total_silver_grams:          result.silver_recycling.total_silver_grams,
      recovery_value_expected_ngn: result.silver_recycling.installer_receives_ngn,
      silver_mg_per_wp:            parseFloat(((result.silver_recycling.silver_grams_per_panel / result.original_watts) * 1000).toFixed(4)),
    });
  } catch (error) {
    return sendError(res, 'Calculation failed', 500);
  }
};

/**
 * POST /api/calculator/battery
 * Full battery valuation: recycling + second-life + recommendation
 */
exports.calculateBattery = async (req, res) => {
  try {
    const {
      brand            = 'Other Lead-Acid',
      capacity_kwh     = 2.4,
      quantity         = 1,
      installation_date,
      condition        = 'good',
    } = req.body;

    if (parseFloat(capacity_kwh) <= 0) return sendError(res, 'Capacity must be greater than 0', 400);
    if (parseInt(quantity) <= 0)       return sendError(res, 'Quantity must be at least 1', 400);

    const result = await calculateBatteryValue(
      brand,
      parseFloat(capacity_kwh),
      parseInt(quantity),
      installation_date || null,
      condition,
    );

    return sendSuccess(res, result);
  } catch (error) {
    console.error('Battery calc error:', error);
    return sendError(res, 'Calculation failed', 500);
  }
};

/**
 * POST /api/calculator/degradation
 */
exports.calculateDegradation = async (req, res) => {
  try {
    const { state, installation_date, brand } = req.body;
    if (!state)             return sendError(res, 'State is required', 400);
    if (!installation_date) return sendError(res, 'Installation date is required', 400);

    const result = await calculateDecommissionDate(state, installation_date, brand);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 'Calculation failed', 500);
  }
};

/**
 * GET /api/calculator/silver-price
 */
exports.getSilverPrice = async (req, res) => {
  try {
    const price = await getSilverPrice();
    return sendSuccess(res, price);
  } catch (error) {
    return sendError(res, 'Failed to fetch price', 500);
  }
};

/**
 * GET /api/calculator/brands
 */
exports.getBrands = async (req, res) => {
  try {
    // Popular solar brands in African market
    const POPULAR_PANEL_BRANDS = [
      { brand: 'Jinko Solar', silver_content_mg_per_wp: 7.2, is_popular_in_nigeria: true },
      { brand: 'JA Solar', silver_content_mg_per_wp: 6.8, is_popular_in_nigeria: true },
      { brand: 'Longi', silver_content_mg_per_wp: 6.5, is_popular_in_nigeria: true },
      { brand: 'Tongwei', silver_content_mg_per_wp: 7.0, is_popular_in_nigeria: true },
      { brand: 'Risen', silver_content_mg_per_wp: 6.9, is_popular_in_nigeria: true },
      { brand: 'Canadian Solar', silver_content_mg_per_wp: 7.1, is_popular_in_nigeria: false },
      { brand: 'Trina Solar', silver_content_mg_per_wp: 6.7, is_popular_in_nigeria: false },
      { brand: 'First Solar', silver_content_mg_per_wp: 8.5, is_popular_in_nigeria: false },
    ];

    const POPULAR_BATTERY_BRANDS = [
      { brand: 'BYD', chemistry: 'lithium-iron-phosphate', is_popular_in_nigeria: true },
      { brand: 'LG', chemistry: 'lithium-ion', is_popular_in_nigeria: true },
      { brand: 'Samsung', chemistry: 'lithium-ion', is_popular_in_nigeria: false },
      { brand: 'Growatt', chemistry: 'lithium-iron-phosphate', is_popular_in_nigeria: true },
      { brand: 'CATL', chemistry: 'lithium-iron-phosphate', is_popular_in_nigeria: false },
      { brand: 'Felicity', chemistry: 'lead-acid', is_popular_in_nigeria: true },
      { brand: 'Victron', chemistry: 'lithium-iron-phosphate', is_popular_in_nigeria: false },
    ];

    const POPULAR_INVERTER_BRANDS = [
      { brand: 'Growatt', is_popular_in_nigeria: true },
      { brand: 'Fronius', is_popular_in_nigeria: false },
      { brand: 'SMA', is_popular_in_nigeria: false },
      { brand: 'Schneider Electric', is_popular_in_nigeria: true },
      { brand: 'Solis', is_popular_in_nigeria: true },
      { brand: 'IMEON', is_popular_in_nigeria: false },
      { brand: 'Victron', is_popular_in_nigeria: true },
      { brand: 'Huawei', is_popular_in_nigeria: false },
    ];

    // Try to fetch from database first, but fallback to hardcoded list
    let { data: panelBrands } = await supabase.from('panel_brands').select('brand, silver_content_mg_per_wp, is_popular_in_nigeria').order('is_popular_in_nigeria', { ascending: false });
    if (!panelBrands || panelBrands.length === 0) {
      panelBrands = POPULAR_PANEL_BRANDS;
    }

    let { data: batteryBrands } = await supabase.from('battery_brands').select('brand, chemistry, is_popular_in_nigeria').order('is_popular_in_nigeria', { ascending: false });
    if (!batteryBrands || batteryBrands.length === 0) {
      batteryBrands = POPULAR_BATTERY_BRANDS;
    }

    // Inverters are new, so use fallback for now
    const inverterBrands = POPULAR_INVERTER_BRANDS;

    return sendSuccess(res, { 
      panels: panelBrands, 
      batteries: batteryBrands,
      inverters: inverterBrands
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch brands', 500);
  }
};

/**
 * GET /api/calculator/states
 */
exports.getStates = async (req, res) => {
  try {
    const { data: states } = await supabase.from('nigeria_climate_zones').select('state, climate_zone').order('state');
    return sendSuccess(res, states || []);
  } catch (error) {
    return sendError(res, 'Failed to fetch states', 500);
  }
};

/**
 * POST /api/calculator/roi
 * Hyper-localized hybrid ROI model for African solar proposal workflows
 */
exports.calculateROI = async (req, res) => {
  try {
    const {
      tariff_band = 'A',
      tariff_rate_ngn_per_kwh,
      generator_fuel_price_ngn_per_liter = 1000,
      current_grid_kwh_per_day = 20,
      current_generator_liters_per_day = 8,
      proposed_solar_capex_ngn = 3500000,
      annual_om_cost_ngn = 120000,
      projected_grid_kwh_offset_per_day = 14,
      projected_generator_liters_offset_per_day = 6,
    } = req.body;

    const band = String(tariff_band || 'A').toUpperCase();
    const effectiveTariff = toNum(tariff_rate_ngn_per_kwh, TARIFF_BANDS[band] || TARIFF_BANDS.A);
    const fuel = toNum(generator_fuel_price_ngn_per_liter, 1000);
    const gridOffset = Math.max(0, toNum(projected_grid_kwh_offset_per_day, 0));
    const genOffset = Math.max(0, toNum(projected_generator_liters_offset_per_day, 0));
    const capex = Math.max(0, toNum(proposed_solar_capex_ngn, 0));
    const annualOM = Math.max(0, toNum(annual_om_cost_ngn, 0));

    if (capex <= 0) return sendError(res, 'Proposed solar CAPEX must be greater than 0', 400);

    const annualGridSavings = gridOffset * effectiveTariff * 365;
    const annualGeneratorSavings = genOffset * fuel * 365;
    const annualGrossSavings = annualGridSavings + annualGeneratorSavings;
    const annualNetSavings = Math.max(0, annualGrossSavings - annualOM);

    const paybackYears = annualNetSavings > 0 ? capex / annualNetSavings : null;
    const paybackMonths = paybackYears ? paybackYears * 12 : null;

    const tenYearNetSavings = (annualNetSavings * 10) - capex;
    const roiPct10y = capex > 0 ? (tenYearNetSavings / capex) * 100 : 0;

    return sendSuccess(res, {
      assumptions: {
        tariff_band: band,
        tariff_rate_ngn_per_kwh: effectiveTariff,
        generator_fuel_price_ngn_per_liter: fuel,
        current_grid_kwh_per_day: toNum(current_grid_kwh_per_day, 0),
        current_generator_liters_per_day: toNum(current_generator_liters_per_day, 0),
        projected_grid_kwh_offset_per_day: gridOffset,
        projected_generator_liters_offset_per_day: genOffset,
        proposed_solar_capex_ngn: capex,
        annual_om_cost_ngn: annualOM,
      },
      annual_savings: {
        grid_ngn: parseFloat(annualGridSavings.toFixed(2)),
        generator_ngn: parseFloat(annualGeneratorSavings.toFixed(2)),
        gross_ngn: parseFloat(annualGrossSavings.toFixed(2)),
        net_ngn: parseFloat(annualNetSavings.toFixed(2)),
      },
      investment_metrics: {
        payback_months: paybackMonths ? parseFloat(paybackMonths.toFixed(1)) : null,
        payback_years: paybackYears ? parseFloat(paybackYears.toFixed(2)) : null,
        ten_year_net_savings_ngn: parseFloat(tenYearNetSavings.toFixed(2)),
        ten_year_roi_pct: parseFloat(roiPct10y.toFixed(2)),
      },
    });
  } catch (error) {
    return sendError(res, 'Failed to calculate proposal ROI', 500);
  }
};

/**
 * POST /api/calculator/battery-soh
 * Heuristic battery SoH estimator for warranty and maintenance decision support
 */
exports.estimateBatterySoH = async (req, res) => {
  try {
    const {
      chemistry = 'lithium-iron-phosphate',
      installation_date,
      rated_capacity_kwh = 10,
      measured_capacity_kwh,
      avg_depth_of_discharge_pct = 65,
      estimated_cycles_per_day = 1,
      ambient_temperature_c = 30,
      warranty_years = 5,
    } = req.body;

    if (!installation_date) return sendError(res, 'installation_date is required', 400);

    const now = new Date();
    const installed = new Date(installation_date);
    const ageDays = Math.max(1, Math.ceil((now - installed) / (1000 * 60 * 60 * 24)));
    const ageYears = ageDays / 365;

    const cyclesPerDay = Math.max(0.1, toNum(estimated_cycles_per_day, 1));
    const totalCycles = ageDays * cyclesPerDay;
    const dod = Math.max(5, Math.min(100, toNum(avg_depth_of_discharge_pct, 65)));
    const cycleLife = cycleLifeAtDoD(String(chemistry).toLowerCase(), dod);

    const alpha = 0.005;
    const thermalPenalty = 1 + Math.max(0, (toNum(ambient_temperature_c, 30) - 25) * alpha);
    const cumulativeDamage = Math.min(1, (totalCycles / cycleLife) * thermalPenalty);

    const nominalSoh = Math.max(0.35, 1 - cumulativeDamage);
    const rated = Math.max(0.5, toNum(rated_capacity_kwh, 10));
    const measured = toNum(measured_capacity_kwh, 0);
    const measuredSoh = measured > 0 ? Math.max(0, Math.min(1.1, measured / rated)) : null;
    const finalSoh = measuredSoh !== null ? Math.min(nominalSoh, measuredSoh) : nominalSoh;

    const warrantyWindowOpen = ageYears <= Math.max(1, toNum(warranty_years, 5));
    const likelyUserAbuse = dod > 80 && cyclesPerDay > 1.2;
    const warrantyRisk = !warrantyWindowOpen
      ? 'out_of_warranty'
      : likelyUserAbuse
        ? 'high_user_abuse_risk'
        : finalSoh < 0.7
          ? 'possible_manufacturing_or_usage_issue'
          : 'normal_usage_profile';

    return sendSuccess(res, {
      chemistry,
      age_days: ageDays,
      age_years: parseFloat(ageYears.toFixed(2)),
      cycle_model: {
        avg_depth_of_discharge_pct: dod,
        estimated_cycles_per_day: cyclesPerDay,
        total_cycles: Math.round(totalCycles),
        estimated_cycle_life_at_dod: Math.round(cycleLife),
        cumulative_damage_pct: parseFloat((cumulativeDamage * 100).toFixed(2)),
      },
      soh: {
        estimated_soh_pct: parseFloat((finalSoh * 100).toFixed(2)),
        estimated_usable_capacity_kwh: parseFloat((rated * finalSoh).toFixed(2)),
        measured_soh_pct: measuredSoh !== null ? parseFloat((measuredSoh * 100).toFixed(2)) : null,
      },
      warranty_assessment: {
        warranty_window_open: warrantyWindowOpen,
        likely_user_abuse: likelyUserAbuse,
        risk_flag: warrantyRisk,
      },
    });
  } catch (error) {
    return sendError(res, 'Failed to estimate battery SoH', 500);
  }
};

/**
 * POST /api/calculator/cable-size
 * Offline-friendly DC cable sizing and voltage-drop compliance model
 */
exports.calculateCableSize = async (req, res) => {
  try {
    const {
      current_amps,
      one_way_length_m,
      system_voltage_v,
      allowable_voltage_drop_pct = 3,
      conductor_material = 'copper',
      ambient_temperature_c = 30,
    } = req.body;

    const I = toNum(current_amps, 0);
    const L = toNum(one_way_length_m, 0);
    const V = toNum(system_voltage_v, 0);
    const dropPct = Math.max(1, Math.min(10, toNum(allowable_voltage_drop_pct, 3)));

    if (I <= 0 || L <= 0 || V <= 0) {
      return sendError(res, 'current_amps, one_way_length_m and system_voltage_v are required and must be > 0', 400);
    }

    const baseRho = String(conductor_material).toLowerCase() === 'aluminum'
      ? 0.0282
      : 0.0175;
    const alpha = 0.00393;
    const rhoT = baseRho * (1 + alpha * (toNum(ambient_temperature_c, 30) - 20));

    const deltaV = (dropPct / 100) * V;
    const requiredArea = (2 * L * I * rhoT) / deltaV;
    const recommendedArea = nearestStandardMm2(requiredArea);

    const predictedDropV = (2 * L * I * rhoT) / recommendedArea;
    const predictedDropPct = (predictedDropV / V) * 100;

    return sendSuccess(res, {
      inputs: {
        current_amps: I,
        one_way_length_m: L,
        system_voltage_v: V,
        allowable_voltage_drop_pct: dropPct,
        conductor_material,
        ambient_temperature_c: toNum(ambient_temperature_c, 30),
      },
      calculations: {
        resistivity_ohm_mm2_per_m: parseFloat(rhoT.toFixed(6)),
        required_area_mm2: parseFloat(requiredArea.toFixed(3)),
        recommended_standard_mm2: recommendedArea,
        predicted_voltage_drop_v: parseFloat(predictedDropV.toFixed(3)),
        predicted_voltage_drop_pct: parseFloat(predictedDropPct.toFixed(3)),
        compliant: predictedDropPct <= dropPct,
      },
      compliance_note: 'Use this output in field QA and cable compliance certificates for installation records.',
    });
  } catch (error) {
    return sendError(res, 'Failed to calculate cable size', 500);
  }
};

/**
 * POST /api/calculator/roi/pdf
 */
exports.exportRoiPdf = async (req, res) => {
  try {
    const payload = req.body || {};

    const band = String(payload.tariff_band || 'A').toUpperCase();
    const effectiveTariff = toNum(payload.tariff_rate_ngn_per_kwh, TARIFF_BANDS[band] || TARIFF_BANDS.A);
    const fuel = toNum(payload.generator_fuel_price_ngn_per_liter, 1000);
    const gridOffset = Math.max(0, toNum(payload.projected_grid_kwh_offset_per_day, 0));
    const genOffset = Math.max(0, toNum(payload.projected_generator_liters_offset_per_day, 0));
    const capex = Math.max(0, toNum(payload.proposed_solar_capex_ngn, 0));
    const annualOM = Math.max(0, toNum(payload.annual_om_cost_ngn, 0));

    const annualGridSavings = gridOffset * effectiveTariff * 365;
    const annualGeneratorSavings = genOffset * fuel * 365;
    const annualGrossSavings = annualGridSavings + annualGeneratorSavings;
    const annualNetSavings = Math.max(0, annualGrossSavings - annualOM);
    const paybackYears = annualNetSavings > 0 ? capex / annualNetSavings : null;
    const paybackMonths = paybackYears ? paybackYears * 12 : null;
    const tenYearNetSavings = (annualNetSavings * 10) - capex;
    const roiPct10y = capex > 0 ? (tenYearNetSavings / capex) * 100 : 0;

    const result = {
      annual_savings: {
        grid_ngn: parseFloat(annualGridSavings.toFixed(2)),
        generator_ngn: parseFloat(annualGeneratorSavings.toFixed(2)),
        gross_ngn: parseFloat(annualGrossSavings.toFixed(2)),
        net_ngn: parseFloat(annualNetSavings.toFixed(2)),
      },
      investment_metrics: {
        payback_months: paybackMonths ? parseFloat(paybackMonths.toFixed(1)) : null,
        payback_years: paybackYears ? parseFloat(paybackYears.toFixed(2)) : null,
        ten_year_net_savings_ngn: parseFloat(tenYearNetSavings.toFixed(2)),
        ten_year_roi_pct: parseFloat(roiPct10y.toFixed(2)),
      },
    };

    const pdfBuffer = await generateProposalPdf(payload, result);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SolNuv_Hybrid_ROI_Proposal_${Date.now()}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 'Failed to export ROI proposal PDF', 500);
  }
};

/**
 * POST /api/calculator/cable-size/pdf
 */
exports.exportCableCertificatePdf = async (req, res) => {
  try {
    const payload = req.body || {};
    const I = toNum(payload.current_amps, 0);
    const L = toNum(payload.one_way_length_m, 0);
    const V = toNum(payload.system_voltage_v, 0);
    const dropPct = Math.max(1, Math.min(10, toNum(payload.allowable_voltage_drop_pct, 3)));

    if (I <= 0 || L <= 0 || V <= 0) {
      return sendError(res, 'current_amps, one_way_length_m and system_voltage_v are required and must be > 0', 400);
    }

    const baseRho = String(payload.conductor_material || 'copper').toLowerCase() === 'aluminum'
      ? 0.0282
      : 0.0175;
    const alpha = 0.00393;
    const rhoT = baseRho * (1 + alpha * (toNum(payload.ambient_temperature_c, 30) - 20));
    const deltaV = (dropPct / 100) * V;
    const requiredArea = (2 * L * I * rhoT) / deltaV;
    const recommendedArea = nearestStandardMm2(requiredArea);
    const predictedDropV = (2 * L * I * rhoT) / recommendedArea;
    const predictedDropPct = (predictedDropV / V) * 100;

    const result = {
      calculations: {
        required_area_mm2: parseFloat(requiredArea.toFixed(3)),
        recommended_standard_mm2: recommendedArea,
        predicted_voltage_drop_v: parseFloat(predictedDropV.toFixed(3)),
        predicted_voltage_drop_pct: parseFloat(predictedDropPct.toFixed(3)),
        compliant: predictedDropPct <= dropPct,
      },
    };

    const pdfBuffer = await generateCableComplianceCertificate(payload, result);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SolNuv_Cable_Compliance_${Date.now()}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, 'Failed to export cable certificate PDF', 500);
  }
};
