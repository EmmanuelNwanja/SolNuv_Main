/**
 * SolNuv Silver Recovery Calculator
 *
 * Research basis:
 * - Silver ≈ 0.05% of panel mass but ~47% of reclaimable economic value
 * - Average: ~0.1g silver per 300W panel (0.35 mg/Wp)
 * - Recovery rate in formal recycling: 30-40% of total recoverable silver value
 * - Current silver ~$0.96/gram = ~₦1,555/gram (at ₦1,620/$1)
 */

const supabase = require('../config/database');

// Silver content constants
const SILVER_CONTENT_MG_PER_WP = 0.35; // mg of silver per watt-peak (average)
const ECONOMIC_VALUE_RATIO = 0.47; // silver is 47% of total reclaimable economic value
const RECOVERY_RATE_MIN = 0.30;
const RECOVERY_RATE_MAX = 0.40;
const RECOVERY_RATE_EXPECTED = 0.35; // 35% expected recovery

/**
 * Get current silver price from DB
 */
async function getSilverPrice() {
  const { data } = await supabase
    .from('silver_prices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data) return data;

  // Fallback to env
  const priceUsd = parseFloat(process.env.SILVER_PRICE_USD_PER_GRAM || '0.96');
  const usdRate = parseFloat(process.env.USD_TO_NGN_RATE || '1620');
  return {
    price_per_gram_usd: priceUsd,
    usd_to_ngn_rate: usdRate,
    price_per_gram_ngn: priceUsd * usdRate,
  };
}

/**
 * Get panel brand silver content
 */
async function getBrandSilverContent(brand) {
  const { data } = await supabase
    .from('panel_brands')
    .select('silver_content_mg_per_wp')
    .ilike('brand', brand)
    .single();

  return data?.silver_content_mg_per_wp || SILVER_CONTENT_MG_PER_WP;
}

/**
 * Calculate silver recovery for a single panel type
 * @param {number} wattsPerPanel - Panel wattage (e.g., 400)
 * @param {number} quantity - Number of panels
 * @param {string} brand - Panel brand
 * @returns {object} - Silver calculation details
 */
async function calculatePanelSilver(wattsPerPanel, quantity, brand = 'Other') {
  const silverPrice = await getSilverPrice();
  const silverMgPerWp = await getBrandSilverContent(brand);

  // Total watt-peak
  const totalWp = wattsPerPanel * quantity;

  // Total silver in the fleet (grams)
  // mg/Wp × total Wp / 1000 = grams
  const totalSilverGrams = (silverMgPerWp * totalWp) / 1000;

  // Value at spot price (100% theoretical)
  const theoreticalValueNgn = totalSilverGrams * silverPrice.price_per_gram_ngn;
  const theoreticalValueUsd = totalSilverGrams * silverPrice.price_per_gram_usd;

  // Realistic recovery (30-40%)
  const recoveryMin = totalSilverGrams * RECOVERY_RATE_MIN;
  const recoveryMax = totalSilverGrams * RECOVERY_RATE_MAX;
  const recoveryExpected = totalSilverGrams * RECOVERY_RATE_EXPECTED;

  const recoveryValueMinNgn = recoveryMin * silverPrice.price_per_gram_ngn;
  const recoveryValueMaxNgn = recoveryMax * silverPrice.price_per_gram_ngn;
  const recoveryValueExpectedNgn = recoveryExpected * silverPrice.price_per_gram_ngn;

  return {
    total_panels: quantity,
    total_watts: totalWp,
    total_silver_grams: parseFloat(totalSilverGrams.toFixed(4)),
    silver_mg_per_wp: silverMgPerWp,
    theoretical_value_ngn: Math.round(theoreticalValueNgn),
    theoretical_value_usd: parseFloat(theoreticalValueUsd.toFixed(2)),
    recovery_grams_min: parseFloat(recoveryMin.toFixed(4)),
    recovery_grams_max: parseFloat(recoveryMax.toFixed(4)),
    recovery_grams_expected: parseFloat(recoveryExpected.toFixed(4)),
    recovery_value_min_ngn: Math.round(recoveryValueMinNgn),
    recovery_value_max_ngn: Math.round(recoveryValueMaxNgn),
    recovery_value_expected_ngn: Math.round(recoveryValueExpectedNgn),
    silver_price_ngn_per_gram: parseFloat(silverPrice.price_per_gram_ngn.toFixed(2)),
    silver_price_usd_per_gram: silverPrice.price_per_gram_usd,
    usd_to_ngn_rate: silverPrice.usd_to_ngn_rate,
    note: `Silver recovery at ${RECOVERY_RATE_EXPECTED * 100}% formal recycling efficiency (vs 0% in informal sector)`,
  };
}

/**
 * Calculate battery material value
 */
async function calculateBatteryValue(brand, capacityKwh, quantity) {
  const { data: brandData } = await supabase
    .from('battery_brands')
    .select('*')
    .ilike('brand', brand)
    .single();

  const silverPrice = await getSilverPrice();

  // Battery lead value (for lead-acid)
  // Average lead: 65kg/kWh for lead-acid, $2.20/kg lead
  const isLeadAcid = brandData?.chemistry?.includes('lead') || false;

  let estimatedValueNgn = 0;
  let materials = {};

  if (isLeadAcid) {
    const leadKgPerKwh = 8.0; // approx
    const totalLeadKg = leadKgPerKwh * capacityKwh * quantity;
    const leadPriceNgn = 2.20 * silverPrice.usd_to_ngn_rate; // $2.20/kg
    estimatedValueNgn = totalLeadKg * leadPriceNgn * 0.35;
    materials = { lead_kg: parseFloat(totalLeadKg.toFixed(2)) };
  } else {
    // Lithium battery: ~1.2kg lithium per kWh
    const lithiumKgPerKwh = 1.2;
    const totalLithiumKg = lithiumKgPerKwh * capacityKwh * quantity;
    const lithiumPriceNgn = 18.0 * silverPrice.usd_to_ngn_rate; // ~$18/kg
    estimatedValueNgn = totalLithiumKg * lithiumPriceNgn * 0.25;
    materials = { lithium_kg: parseFloat(totalLithiumKg.toFixed(2)) };
  }

  return {
    brand,
    chemistry: brandData?.chemistry || 'unknown',
    total_batteries: quantity,
    total_capacity_kwh: capacityKwh * quantity,
    estimated_recovery_value_ngn: Math.round(estimatedValueNgn),
    materials,
    note: 'Battery values based on raw material extraction at formal recycling rates',
  };
}

/**
 * Calculate silver for a full company/user portfolio
 */
async function calculatePortfolioSilver(userId, companyId) {
  const query = supabase
    .from('equipment')
    .select(`
      equipment_type, brand, size_watts, quantity,
      projects!inner(user_id, company_id, status)
    `)
    .eq('equipment_type', 'panel')
    .in('projects.status', ['active', 'decommissioned']);

  if (companyId) {
    query.eq('projects.company_id', companyId);
  } else {
    query.eq('projects.user_id', userId);
  }

  const { data: equipment } = await query;
  if (!equipment || equipment.length === 0) return { total_silver_grams: 0, total_value_ngn: 0, panels: [] };

  const silverPrice = await getSilverPrice();
  let totalSilverGrams = 0;
  const panels = [];

  for (const eq of equipment) {
    const silverMgPerWp = await getBrandSilverContent(eq.brand);
    const totalWp = (eq.size_watts || 400) * eq.quantity;
    const silverGrams = (silverMgPerWp * totalWp) / 1000;
    totalSilverGrams += silverGrams;
    panels.push({ brand: eq.brand, quantity: eq.quantity, silver_grams: parseFloat(silverGrams.toFixed(4)) });
  }

  const expectedRecoveryGrams = totalSilverGrams * RECOVERY_RATE_EXPECTED;
  const expectedValueNgn = expectedRecoveryGrams * silverPrice.price_per_gram_ngn;

  return {
    total_panels: equipment.reduce((s, e) => s + e.quantity, 0),
    total_silver_grams: parseFloat(totalSilverGrams.toFixed(4)),
    expected_recovery_grams: parseFloat(expectedRecoveryGrams.toFixed(4)),
    expected_recovery_value_ngn: Math.round(expectedValueNgn),
    silver_price_ngn_per_gram: parseFloat(silverPrice.price_per_gram_ngn.toFixed(2)),
    panels,
  };
}

module.exports = {
  calculatePanelSilver,
  calculateBatteryValue,
  calculatePortfolioSilver,
  getSilverPrice,
};
