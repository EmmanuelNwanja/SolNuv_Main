/**
 * SolNuv Calculator Controller
 * Public demo calculators (no auth required)
 */

const { sendSuccess, sendError } = require('../utils/responseHelper');
const { calculatePanelSilver, calculateBatteryValue, getSilverPrice } = require('../services/silverService');
const { calculateDecommissionDate } = require('../services/degradationService');
const supabase = require('../config/database');

/**
 * POST /api/calculator/silver
 * Public silver recovery calculator (demo)
 */
exports.calculateSilver = async (req, res) => {
  try {
    const { size_watts = 400, quantity = 1, brand = 'Other' } = req.body;

    if (!size_watts || size_watts <= 0) return sendError(res, 'Panel wattage must be greater than 0', 400);
    if (!quantity || quantity <= 0) return sendError(res, 'Quantity must be greater than 0', 400);
    if (quantity > 100000) return sendError(res, 'Maximum 100,000 panels per calculation', 400);

    const result = await calculatePanelSilver(parseFloat(size_watts), parseInt(quantity), brand);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 'Calculation failed', 500);
  }
};

/**
 * POST /api/calculator/battery
 * Public battery material value calculator
 */
exports.calculateBattery = async (req, res) => {
  try {
    const { brand = 'Other Lead-Acid', capacity_kwh = 2.4, quantity = 1 } = req.body;
    const result = await calculateBatteryValue(brand, parseFloat(capacity_kwh), parseInt(quantity));
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 'Calculation failed', 500);
  }
};

/**
 * POST /api/calculator/degradation
 * Public degradation predictor
 */
exports.calculateDegradation = async (req, res) => {
  try {
    const { state, installation_date, brand } = req.body;

    if (!state) return sendError(res, 'State is required', 400);
    if (!installation_date) return sendError(res, 'Installation date is required', 400);

    const result = await calculateDecommissionDate(state, installation_date, brand);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, 'Calculation failed', 500);
  }
};

/**
 * GET /api/calculator/silver-price
 * Current silver spot price
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
 * List panel and battery brands
 */
exports.getBrands = async (req, res) => {
  try {
    const { data: panelBrands } = await supabase
      .from('panel_brands')
      .select('brand, silver_content_mg_per_wp, is_popular_in_nigeria')
      .order('is_popular_in_nigeria', { ascending: false });

    const { data: batteryBrands } = await supabase
      .from('battery_brands')
      .select('brand, chemistry, is_popular_in_nigeria')
      .order('is_popular_in_nigeria', { ascending: false });

    return sendSuccess(res, {
      panels: panelBrands || [],
      batteries: batteryBrands || [],
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch brands', 500);
  }
};

/**
 * GET /api/calculator/states
 * List Nigerian states with climate info
 */
exports.getStates = async (req, res) => {
  try {
    const { data: states } = await supabase
      .from('nigeria_climate_zones')
      .select('state, climate_zone')
      .order('state');

    return sendSuccess(res, states || []);
  } catch (error) {
    return sendError(res, 'Failed to fetch states', 500);
  }
};
