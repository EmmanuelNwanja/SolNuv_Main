/**
 * SolNuv Calculator Controller
 * Public demo calculators — no auth required
 */

const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { calculatePanelValue, calculateBatteryValue, getSilverPrice } = require('../services/silverService');
const { calculateDecommissionDate } = require('../services/degradationService');
const { generateProposalPdf, generateCableComplianceCertificate } = require('../services/pdfService');
const { PANEL_TECHNOLOGIES, BATTERY_CHEMISTRIES, resolveChemistry, cyclesAtDoD } = require('../constants/technologyConstants');
const supabase = require('../config/database');

const DEFAULT_TARIFF_BANDS = {
  A: 225,
  B: 63,
  C: 50,
  D: 41,
  E: 32,
};

/**
 * Get MYTO tariff bands — checks for AI-updated overrides in platform_config,
 * falls back to hardcoded defaults.
 */
async function getTariffBands() {
  try {
    const { data } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'myto_tariff_bands')
      .single();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      // Merge with defaults — override only valid bands
      return { ...DEFAULT_TARIFF_BANDS, ...parsed };
    }
  } catch { /* use defaults */ }
  return { ...DEFAULT_TARIFF_BANDS };
}

// Kept for sync contexts where the DB call isn't needed
const TARIFF_BANDS = DEFAULT_TARIFF_BANDS;

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cycleLifeAtDoD(chemistry, dodPct) {
  // Delegate to the canonical implementation in technologyConstants
  return cyclesAtDoD(resolveChemistry(String(chemistry).toLowerCase()), toNum(dodPct, 60));
}

function nearestStandardMm2(required) {
  const standards = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  const req = Math.max(0.5, toNum(required, 1.5));
  return standards.find((v) => v >= req) || 240;
}

function mergeBrands(dbBrands = [], fallbackBrands = []) {
  const map = new Map();
  for (const row of [...fallbackBrands, ...dbBrands]) {
    if (!row?.brand) continue;
    map.set(String(row.brand).toLowerCase(), row);
  }
  return Array.from(map.values()).sort((a, b) => {
    const aPopular = a.is_popular_in_nigeria ? 1 : 0;
    const bPopular = b.is_popular_in_nigeria ? 1 : 0;
    if (aPopular !== bPopular) return bPopular - aPopular;
    return String(a.brand).localeCompare(String(b.brand));
  });
}

/**
 * POST /api/calculator/panel
 * Full panel valuation: silver + second-life + recommendation
 */
exports.calculatePanel = async (req, res) => {
  try {
    const {
      size_watts         = 400,
      quantity           = 1,
      installation_date,
      climate_zone       = 'mixed',
      condition          = 'good',
      panel_technology   = null,
      cleaning_frequency = 'monthly',
    } = req.body;

    if (parseFloat(size_watts) <= 0) return sendError(res, 'Panel wattage must be greater than 0', 400);
    if (parseInt(quantity) <= 0)     return sendError(res, 'Quantity must be at least 1', 400);
    if (parseInt(quantity) > 200000) return sendError(res, 'Maximum 200,000 panels per calculation', 400);

    // Validate panel_technology if provided
    const tech = panel_technology && PANEL_TECHNOLOGIES[panel_technology] ? panel_technology : null;

    // Validate cleaning_frequency against allowed values; default to monthly if unknown
    const VALID_CLEANING_FREQ = ['daily', 'weekly', 'monthly', 'quarterly', 'rarely'];
    const cleanFreq = VALID_CLEANING_FREQ.includes(cleaning_frequency) ? cleaning_frequency : 'monthly';

    const result = await calculatePanelValue(
      parseFloat(size_watts),
      parseInt(quantity),
      installation_date || null,
      climate_zone,
      condition,
      tech,
      cleanFreq,
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
    const { size_watts = 400, quantity = 1, installation_date } = req.body;

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
  } catch (_error) {
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
    const { state, installation_date, brand, panel_technology = null } = req.body;
    if (!state)             return sendError(res, 'State is required', 400);
    if (!installation_date) return sendError(res, 'Installation date is required', 400);

    const tech = panel_technology && PANEL_TECHNOLOGIES[panel_technology] ? panel_technology : null;
    const result = await calculateDecommissionDate(state, installation_date, brand, tech);
    return sendSuccess(res, result);
  } catch (_error) {
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
  } catch (_error) {
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
    panelBrands = mergeBrands(panelBrands || [], POPULAR_PANEL_BRANDS);

    let { data: batteryBrands } = await supabase.from('battery_brands').select('brand, chemistry, is_popular_in_nigeria').order('is_popular_in_nigeria', { ascending: false });
    batteryBrands = mergeBrands(batteryBrands || [], POPULAR_BATTERY_BRANDS);

    let { data: dbInverterBrands } = await supabase
      .from('inverter_brands')
      .select('brand, is_popular_in_nigeria')
      .order('is_popular_in_nigeria', { ascending: false });
    const inverterBrands = mergeBrands(dbInverterBrands || [], POPULAR_INVERTER_BRANDS);

    return sendSuccess(res, { 
      panels: panelBrands, 
      batteries: batteryBrands,
      inverters: inverterBrands
    });
  } catch (_error) {
    return sendError(res, 'Failed to fetch brands', 500);
  }
};

/**
 * POST /api/calculator/brands/submit
 * Authenticated — submit a custom OEM brand for panel, battery, or inverter.
 * Inserts into the appropriate brands table if not already present.
 */
exports.submitBrand = async (req, res) => {
  try {
    const { brand, equipment_type } = req.body;
    if (!brand || !String(brand).trim()) return sendError(res, 'brand is required', 400);
    if (!['panel', 'battery', 'inverter'].includes(equipment_type)) {
      return sendError(res, 'equipment_type must be panel, battery, or inverter', 400);
    }

    const cleanBrand = String(brand).trim().slice(0, 255);
    const tableMap = { panel: 'panel_brands', battery: 'battery_brands', inverter: 'inverter_brands' };
    const table = tableMap[equipment_type];

    // Check for a case-insensitive duplicate before inserting
    const { data: existing } = await supabase
      .from(table)
      .select('id, brand')
      .ilike('brand', cleanBrand)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return sendSuccess(res, { brand: existing.brand, existed: true }, 'Brand already exists');
    }

    const insertPayload = {
      brand: cleanBrand,
      is_custom: true,
      is_popular_in_nigeria: false,
      submitted_by: req.user?.id || null,
    };

    const { data: newRow, error } = await supabase
      .from(table)
      .insert(insertPayload)
      .select('brand')
      .single();

    if (error) throw error;

    return sendSuccess(res, { brand: newRow.brand, existed: false }, 'Brand submitted successfully', 201);
  } catch (error) {
    logger.error('Failed to submit custom brand', { message: error.message });
    return sendError(res, 'Failed to submit brand', 500);
  }
};

/**
 * GET /api/calculator/states
 */
exports.getStates = async (req, res) => {
  try {
    const { data: states } = await supabase.from('nigeria_climate_zones').select('state, climate_zone').order('state');
    return sendSuccess(res, states || []);
  } catch (_error) {
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
    const liveBands = await getTariffBands();
    const effectiveTariff = toNum(tariff_rate_ngn_per_kwh, liveBands[band] || liveBands.A);
    const fuel = Math.max(0, toNum(generator_fuel_price_ngn_per_liter, 1000));
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
  } catch (_error) {
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

    const chemKey = resolveChemistry(String(chemistry).toLowerCase());
    const chemData = BATTERY_CHEMISTRIES[chemKey];

    const cyclesPerDay = Math.max(0.1, toNum(estimated_cycles_per_day, 1));
    const totalCycles = ageDays * cyclesPerDay;
    const dod = Math.max(5, Math.min(100, toNum(avg_depth_of_discharge_pct, 65)));
    const cycleLife = cycleLifeAtDoD(chemKey, dod);

    // Temperature penalty: uses chemistry-specific sensitivity when available
    const tempSensitivity = chemData ? chemData.temp_sensitivity : 1.4;
    const ambientTemp = toNum(ambient_temperature_c, 30);
    // Arrhenius-style penalty: doubles per 10°C above 25°C (for sensitivity=2.0)
    const tempPenaltyFactor = Math.pow(tempSensitivity, Math.max(0, (ambientTemp - 25) / 10));
    const cumulativeDamage = Math.min(1, (totalCycles / cycleLife) * tempPenaltyFactor);

    const nominalSoh = Math.max(0.35, 1 - cumulativeDamage);
    const rated = Math.max(0.5, toNum(rated_capacity_kwh, 10));
    const measured = toNum(measured_capacity_kwh, 0);
    const measuredSoh = measured > 0 ? Math.max(0, Math.min(1.1, measured / rated)) : null;
    const finalSoh = measuredSoh !== null ? Math.min(nominalSoh, measuredSoh) : nominalSoh;

    const warrantyWindowOpen = ageYears <= Math.max(1, toNum(warranty_years, 5));
    const recDod = chemData ? chemData.recommended_dod_pct : 80;
    const likelyUserAbuse = dod > recDod * 1.1 && cyclesPerDay > 1.2;
    const warrantyRisk = !warrantyWindowOpen
      ? 'out_of_warranty'
      : likelyUserAbuse
        ? 'high_user_abuse_risk'
        : finalSoh < 0.7
          ? 'possible_manufacturing_or_usage_issue'
          : 'normal_usage_profile';

    return sendSuccess(res, {
      chemistry,
      chemistry_resolved: chemKey,
      chemistry_label: chemData?.label || chemistry,
      age_days: ageDays,
      age_years: parseFloat(ageYears.toFixed(2)),
      cycle_model: {
        avg_depth_of_discharge_pct: dod,
        recommended_dod_pct: recDod,
        estimated_cycles_per_day: cyclesPerDay,
        total_cycles: Math.round(totalCycles),
        estimated_cycle_life_at_dod: Math.round(cycleLife),
        cumulative_damage_pct: parseFloat((cumulativeDamage * 100).toFixed(2)),
        round_trip_efficiency_pct: chemData ? Math.round(chemData.round_trip_eff * 100) : null,
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
  } catch (_error) {
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
  } catch (_error) {
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
    const liveBands = await getTariffBands();
    const effectiveTariff = toNum(payload.tariff_rate_ngn_per_kwh, liveBands[band] || liveBands.A);
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
  } catch (_error) {
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
  } catch (_error) {
    return sendError(res, 'Failed to export cable certificate PDF', 500);
  }
};

/**
 * GET /api/calculator/technologies
 * Returns all panel technologies and battery chemistries for frontend pickers.
 * Includes engineering metadata useful for hints in the UI.
 */
exports.getTechnologies = (req, res) => {
  const panelTechs = Object.entries(PANEL_TECHNOLOGIES).map(([key, t]) => ({
    key,
    label:            t.label,
    group:            t.group,
    silver_mg_per_wp: t.silver_mg_per_wp,
    deg_rate_pct_yr:  t.deg_rate_pct_yr,
    temp_coeff_pct_c: t.temp_coeff_pct_c,
    bifacial:         t.bifacial,
    notes:            t.notes,
  }));

  const batteryChems = Object.entries(BATTERY_CHEMISTRIES).map(([key, c]) => ({
    key,
    label:               c.label,
    group:               c.group,
    recommended_dod_pct: c.recommended_dod_pct,
    round_trip_eff_pct:  Math.round(c.round_trip_eff * 100),
    cycle_life_ref:      c.cycle_life_ref,
    reference_dod_pct:   c.reference_dod_pct,
    annual_soh_loss_pct: c.annual_soh_loss_pct,
    notes:               c.notes,
  }));

  return sendSuccess(res, { panel_technologies: panelTechs, battery_chemistries: batteryChems });
};
