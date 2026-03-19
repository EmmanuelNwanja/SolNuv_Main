/**
 * SolNuv Valuation Service — Rebuilt for Accuracy
 *
 * THREE value streams calculated per equipment:
 *
 * 1. SILVER RECOVERY (dismantling route)
 *    Silver is in paste contacts on each solar cell — content is per-CELL,
 *    not per-watt. A 600W panel ≠ 2× silver of a 300W panel. They may have
 *    the same cell count, just more efficient cells.
 *    Era matters: 2014 panels had ~0.22g/panel; 2024 panels have ~0.08g/panel.
 *    Installer typically receives only 15–25% of spot value (refiner keeps the rest).
 *
 * 2. PANEL SECOND-LIFE / REFURBISHMENT (intact panel route)
 *    A Lagos panel after 8 years at 0.85%/yr degradation → ~85% SOH → ~340W from a 400W panel.
 *    That 340W panel can be tested, cleaned, repackaged, and sold at its measured output.
 *    New panels cost ~$0.28/W landed in Nigeria → ₦453/W at ₦1620/$.
 *    Second-life sells at ~32% of new = ₦145/W → ~₦49,000 for a 340W tested panel.
 *    Installer receives ~45% of that = ~₦22,000 per panel.
 *    Compare to silver: same panel yields ~0.12g Ag = ₦298 to the installer.
 *    SECOND-LIFE IS ~74× MORE VALUABLE than silver for a healthy 8-year panel.
 *
 * 3. BATTERY VALUATION (recycling + second-life)
 *    Lead-acid: recoverable lead ≈13.8 kg/kWh rated capacity; Nigerian scrapyards pay well.
 *    Lithium LiFePO4: lithium carbonate ~$13/kg; strong second-life market if SOH >70%.
 *    Lithium NMC/NCA: cobalt + nickel + lithium recovery compounds the value significantly.
 */

const supabase = require('../config/database');

// ─── SILVER: per-panel by manufacture era (grams, NOT mg/Wp) ──────────────
// Source: NREL PV Reliability Workshop, Fraunhofer ISE, IEA PVPS Task 12
const SILVER_GRAMS_BY_ERA = {
  pre2015: 0.22, 2015: 0.18, 2016: 0.17, 2017: 0.16,
  2018: 0.14, 2019: 0.13, 2020: 0.12, 2021: 0.11,
  2022: 0.10, 2023: 0.09, 2024: 0.08, post2024: 0.08,
};
const SILVER_RECOVERY_YIELD   = 0.88;  // 88% of silver extracted in formal recycling
const INSTALLER_SILVER_SHARE  = 0.20;  // installer receives 20% of spot value

// ─── PANEL DEGRADATION by Nigerian climate zone (%/yr) ───────────────────
const ANNUAL_DEGRADATION = {
  coastal_humid: 0.0085, sahel_dry: 0.0080,
  se_humid:      0.0075, mixed:     0.0065, default: 0.0075,
};

// ─── PANEL SECOND-LIFE pricing ────────────────────────────────────────────
const NEW_PANEL_USD_PER_W          = 0.28;   // landed cost Nigeria
const SECOND_LIFE_PRICE_RATIO      = 0.32;   // 32% of new-equivalent
const INSTALLER_PANEL_SHARE        = 0.45;   // installer gets 45% of resale
const MIN_PANEL_SOH_FOR_SECONDLIFE = 0.70;

// ─── BATTERY chemistry constants ──────────────────────────────────────────
const LEAD_KG_PER_KWH              = 13.8;   // recoverable lead per rated kWh
const LEAD_PRICE_USD_PER_KG        = 2.10;
const LEAD_INSTALLER_SHARE         = 0.55;

const LITHIUM_KG_PER_KWH = {
  'lithium-iron-phosphate': 0.065, lithium: 0.075, nmc: 0.075, nca: 0.080,
};
const LI_CARBONATE_PRICE_USD_PER_KG = 13.0;
const LI_CONVERSION_FACTOR          = 5.32;  // kg Li → kg Li₂CO₃
const LITHIUM_INSTALLER_SHARE       = 0.30;

const NEW_BATTERY_USD_PER_KWH = {
  'lithium-iron-phosphate': 280, lithium: 310, 'lead-acid': 90, default: 250,
};
const BATTERY_SECONDLIFE_PRICE_RATIO      = 0.28;
const BATTERY_SECONDLIFE_INSTALLER_SHARE  = 0.50;
const MIN_BATTERY_SOH_FOR_SECONDLIFE      = 0.70;

const BATTERY_ANNUAL_SOH_LOSS = {
  'lead-acid': 0.15, 'lithium-iron-phosphate': 0.025,
  lithium: 0.035,     nmc: 0.035, nca: 0.040, default: 0.035,
};

const CONDITION_MODIFIER = { excellent: 1.10, good: 1.00, fair: 0.82, poor: 0.45, damaged: 0.00 };

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function getSilverPrice() {
  try {
    const { data } = await supabase
      .from('silver_prices').select('*')
      .order('created_at', { ascending: false }).limit(1).single();
    if (data) return data;
  } catch (_) {}
  const usd = parseFloat(process.env.SILVER_PRICE_USD_PER_GRAM || '0.96');
  const ngn = parseFloat(process.env.USD_TO_NGN_RATE || '1620');
  return { price_per_gram_usd: usd, usd_to_ngn_rate: ngn, price_per_gram_ngn: usd * ngn };
}

function yearsOldFrom(installationDate) {
  return Math.max(0, (Date.now() - new Date(installationDate || Date.now())) / (365.25 * 24 * 3600 * 1000));
}

function getSilverGramsPerPanel(installationDate, wattsPerPanel) {
  const mfgYear = Math.max(2014, new Date(installationDate || Date.now()).getFullYear() - 1);
  const key = mfgYear <= 2014 ? 'pre2015' : mfgYear >= 2025 ? 'post2024' : mfgYear;
  let g = SILVER_GRAMS_BY_ERA[key] || 0.12;
  // Half-cut / bifacial panels >500W have ~double the cell count
  if (parseFloat(wattsPerPanel) > 500) g *= 1.85;
  return g;
}

function calcPanelSOH(wattsPerPanel, installationDate, climateZone = 'mixed', condition = 'good') {
  const yrs = yearsOldFrom(installationDate);
  const rate = ANNUAL_DEGRADATION[climateZone] || ANNUAL_DEGRADATION.default;
  const lid  = 0.02; // Light Induced Degradation in year 1
  const rawSoh = Math.max(0.50, (1 - lid) - (rate * Math.max(0, yrs - 1)));
  const soh    = Math.min(1.0, rawSoh * (CONDITION_MODIFIER[condition] ?? 1.00));
  return {
    soh:              parseFloat(soh.toFixed(4)),
    remaining_watts:  Math.round(parseFloat(wattsPerPanel) * soh),
    years_old:        parseFloat(yrs.toFixed(1)),
    degradation_rate: `${(rate * 100).toFixed(2)}%/yr`,
  };
}

// ─── MAIN: PANEL VALUATION ────────────────────────────────────────────────────
async function calculatePanelValue(wattsPerPanel, quantity, installationDate, climateZone = 'mixed', condition = 'good') {
  const sp  = await getSilverPrice();
  const qty = parseInt(quantity);
  const w   = parseFloat(wattsPerPanel);

  // 1 ── SILVER ROUTE ─────────────────────────────────────────────────────
  const silverPerPanel   = getSilverGramsPerPanel(installationDate, w);
  const totalSilver      = silverPerPanel * qty;
  const spotNgn          = totalSilver * sp.price_per_gram_ngn;
  const installerSilver  = Math.round(spotNgn * INSTALLER_SILVER_SHARE);

  // 2 ── SECOND-LIFE ROUTE ────────────────────────────────────────────────
  const health = calcPanelSOH(w, installationDate, climateZone, condition);
  const { soh, remaining_watts: rW } = health;
  const viable = soh >= MIN_PANEL_SOH_FOR_SECONDLIFE;

  const newEquivNgn    = rW * NEW_PANEL_USD_PER_W * sp.usd_to_ngn_rate;
  const secondLifeNgn  = newEquivNgn * SECOND_LIFE_PRICE_RATIO;
  const installerRefurb = viable ? Math.round(secondLifeNgn * INSTALLER_PANEL_SHARE * qty) : 0;

  // 3 ── RECOMMENDATION ─────────────────────────────────────────────────
  const multiple = installerSilver > 0
    ? parseFloat((installerRefurb / installerSilver).toFixed(1))
    : 0;

  const recommendation = !viable
    ? { route: 'silver_recycling', reason: `SOH ${Math.round(soh * 100)}% is below 70% threshold. Dismantle for silver recovery.` }
    : { route: 'second_life',      reason: `At ${Math.round(soh * 100)}% SOH each panel tests at ~${rW}W. Refurbish and sell at that rated output — ${multiple}× more valuable than dismantling for silver.` };

  return {
    original_watts: w, quantity: qty, installation_date: installationDate,
    climate_zone: climateZone, condition,

    panel_health: { ...health, is_viable_for_second_life: viable },

    silver_recycling: {
      silver_grams_per_panel:   parseFloat(silverPerPanel.toFixed(4)),
      total_silver_grams:       parseFloat(totalSilver.toFixed(4)),
      extracted_grams:          parseFloat((totalSilver * SILVER_RECOVERY_YIELD).toFixed(4)),
      spot_value_ngn:           Math.round(spotNgn),
      installer_receives_ngn:   installerSilver,
      installer_receives_min:   Math.round(installerSilver * 0.75),
      installer_receives_max:   Math.round(installerSilver * 1.30),
      note: 'Installer receives ~20% of silver spot value; refiner keeps the rest as processing cost.',
    },

    second_life_refurbishment: {
      tested_output_watts:            rW,
      soh_pct:                        Math.round(soh * 100),
      new_equiv_cost_ngn_per_panel:   Math.round(newEquivNgn),
      second_life_price_ngn_per_panel: Math.round(secondLifeNgn),
      installer_receives_ngn:         installerRefurb,
      installer_receives_min:         Math.round(installerRefurb * 0.75),
      installer_receives_max:         Math.round(installerRefurb * 1.25),
      is_viable: viable,
      note: viable
        ? `Each panel operates at ~${rW}W. Test, clean, repackage and sell at that measured rating.`
        : `Health too low for reliable resale. Silver recovery is the right route.`,
    },

    comparison: {
      silver_route_total_ngn:    installerSilver,
      refurb_route_total_ngn:    installerRefurb,
      refurb_vs_silver_multiple: multiple,
      recommendation,
    },

    silver_price_ngn_per_gram: parseFloat(sp.price_per_gram_ngn.toFixed(2)),
    silver_price_usd_per_gram: sp.price_per_gram_usd,
    usd_to_ngn_rate:           sp.usd_to_ngn_rate,
  };
}

// ─── BATTERY VALUATION ───────────────────────────────────────────────────────
async function calculateBatteryValue(brand, capacityKwh, quantity, installationDate, condition = 'good') {
  const { data: brandData } = await supabase.from('battery_brands').select('*').ilike('brand', brand).single().catch(() => ({ data: null }));
  const sp  = await getSilverPrice();
  const qty = parseInt(quantity);
  const kwh = parseFloat(capacityKwh);
  const totalKwh = kwh * qty;

  const chemistry  = (brandData?.chemistry || 'lithium-iron-phosphate').toLowerCase();
  const isLeadAcid = chemistry.includes('lead');

  // SOH calculation
  const yrs        = yearsOldFrom(installationDate);
  const annualLoss = BATTERY_ANNUAL_SOH_LOSS[chemistry] || BATTERY_ANNUAL_SOH_LOSS.default;
  const rawSoh     = Math.max(0.10, 1 - annualLoss * yrs);
  const soh        = Math.min(1.0, rawSoh * (CONDITION_MODIFIER[condition] ?? 1.00));
  const viable     = soh >= MIN_BATTERY_SOH_FOR_SECONDLIFE;

  // ── RECYCLING VALUE ───────────────────────────────────────────────────
  let recyclingNgn = 0;
  let materials    = {};

  if (isLeadAcid) {
    const leadKg       = LEAD_KG_PER_KWH * totalKwh * 0.88;
    const leadValueNgn = leadKg * LEAD_PRICE_USD_PER_KG * sp.usd_to_ngn_rate;
    recyclingNgn       = Math.round(leadValueNgn * LEAD_INSTALLER_SHARE);
    materials          = { lead_kg: parseFloat(leadKg.toFixed(2)), lead_price_usd_per_kg: LEAD_PRICE_USD_PER_KG };
  } else {
    const liKgPerKwh   = LITHIUM_KG_PER_KWH[chemistry] || LITHIUM_KG_PER_KWH.lithium;
    const liKg         = liKgPerKwh * totalKwh;
    const li2CO3Kg     = liKg * LI_CONVERSION_FACTOR;
    const liValueNgn   = li2CO3Kg * LI_CARBONATE_PRICE_USD_PER_KG * sp.usd_to_ngn_rate;
    recyclingNgn       = Math.round(liValueNgn * LITHIUM_INSTALLER_SHARE);
    let cobaltBonus    = 0;
    if (chemistry.includes('nmc') || chemistry.includes('nca')) {
      cobaltBonus  = Math.round(totalKwh * 0.15 * 33 * sp.usd_to_ngn_rate * 0.30);
      recyclingNgn += cobaltBonus;
    }
    materials = {
      lithium_kg: parseFloat(liKg.toFixed(3)),
      li_carbonate_kg: parseFloat(li2CO3Kg.toFixed(3)),
      cobalt_bonus_ngn: cobaltBonus,
    };
  }

  // ── SECOND-LIFE VALUE ─────────────────────────────────────────────────
  const newCostNgn     = (NEW_BATTERY_USD_PER_KWH[chemistry] || NEW_BATTERY_USD_PER_KWH.default) * totalKwh * sp.usd_to_ngn_rate;
  const secondLifeNgn  = viable ? Math.round(newCostNgn * soh * BATTERY_SECONDLIFE_PRICE_RATIO * BATTERY_SECONDLIFE_INSTALLER_SHARE) : 0;

  // ── RECOMMENDATION ────────────────────────────────────────────────────
  const multiple = recyclingNgn > 0 ? parseFloat((secondLifeNgn / recyclingNgn).toFixed(1)) : 0;
  let route, reason;
  if (soh >= 0.80) {
    route  = 'second_life';
    reason = `At ${Math.round(soh * 100)}% SOH these batteries are prime second-life candidates. Refurb value is ${multiple}× the scrap value.`;
  } else if (viable) {
    route  = 'second_life';
    reason = `At ${Math.round(soh * 100)}% SOH, batteries can serve light-duty second-life applications. Test individual cells — replaceable cells may restore the pack.`;
  } else if (isLeadAcid) {
    route  = 'lead_recycling';
    reason = `SOH ${Math.round(soh * 100)}% — below second-life threshold. Lead is fully recyclable and Nigerian formal recyclers pay ₦${Math.round(LEAD_PRICE_USD_PER_KG * sp.usd_to_ngn_rate).toLocaleString('en-NG')}/kg.`;
  } else {
    route  = 'lithium_recycling';
    reason = `SOH ${Math.round(soh * 100)}% — recycle for lithium carbonate${chemistry.includes('nmc') ? ', cobalt and nickel' : ''} recovery.`;
  }

  return {
    brand, chemistry, capacity_kwh_per_unit: kwh, quantity: qty,
    total_capacity_kwh: totalKwh, condition,

    battery_health: {
      soh_pct:               Math.round(soh * 100),
      years_old:             parseFloat(yrs.toFixed(1)),
      effective_capacity_kwh: parseFloat((totalKwh * soh).toFixed(2)),
      is_viable_second_life: viable,
    },

    material_recycling: {
      installer_receives_ngn: recyclingNgn,
      materials,
      note: isLeadAcid
        ? 'Lead-acid: one of the most recycled products globally. Both scrapyards and formal recyclers pay for clean lead.'
        : 'Lithium carbonate demand is rising as battery manufacturing scales. Value will increase over time.',
    },

    second_life: {
      installer_receives_ngn:  secondLifeNgn,
      soh_pct:                 Math.round(soh * 100),
      effective_capacity_kwh:  parseFloat((totalKwh * soh).toFixed(2)),
      is_viable:               viable,
      note: viable
        ? `Each unit delivers ${(kwh * soh).toFixed(2)}kWh usable capacity — deployable in solar backup, rural electrification, or telecom tower storage.`
        : `SOH too low for reliable second-life use. Recycle for materials.`,
    },

    comparison: {
      recycling_route_ngn:   recyclingNgn,
      second_life_route_ngn: secondLifeNgn,
      second_life_vs_recycling_multiple: multiple,
      recommendation: { route, reason },
    },

    usd_to_ngn_rate: sp.usd_to_ngn_rate,
  };
}

// ─── LEGACY ALIAS (used by dashboard + existing callers) ─────────────────────
async function calculatePanelSilver(wattsPerPanel, quantity, brand = 'Other', installationDate = null) {
  const r = await calculatePanelValue(wattsPerPanel, quantity, installationDate, 'mixed', 'good');
  return {
    ...r.silver_recycling,
    total_panels: r.quantity,
    total_watts: r.original_watts * r.quantity,
    silver_price_ngn_per_gram: r.silver_price_ngn_per_gram,
    silver_price_usd_per_gram: r.silver_price_usd_per_gram,
    usd_to_ngn_rate: r.usd_to_ngn_rate,
    second_life: r.second_life_refurbishment,
    recommendation: r.comparison.recommendation,
    // Keep legacy field name
    recovery_value_expected_ngn: r.silver_recycling.installer_receives_ngn,
  };
}

async function calculatePortfolioSilver(userId, companyId) {
  const query = supabase
    .from('equipment')
    .select('equipment_type, brand, size_watts, quantity, projects!inner(user_id, company_id, status, installation_date, state)')
    .eq('equipment_type', 'panel')
    .in('projects.status', ['active', 'decommissioned']);

  if (companyId) query.eq('projects.company_id', companyId);
  else           query.eq('projects.user_id', userId);

  const { data: equipment } = await query;
  if (!equipment?.length) return { total_silver_grams: 0, expected_recovery_value_ngn: 0, total_second_life_value_ngn: 0, panels: [] };

  const sp = await getSilverPrice();
  let totalSilver = 0, totalSilverNgn = 0, totalSecondLifeNgn = 0;
  const panels = [];

  for (const eq of equipment) {
    const installDate = eq.projects?.installation_date;
    const sg  = getSilverGramsPerPanel(installDate, eq.size_watts || 400) * eq.quantity;
    totalSilver    += sg;
    totalSilverNgn += sg * sp.price_per_gram_ngn * INSTALLER_SILVER_SHARE;

    const health = calcPanelSOH(eq.size_watts || 400, installDate, 'mixed', 'good');
    if (health.soh >= MIN_PANEL_SOH_FOR_SECONDLIFE) {
      totalSecondLifeNgn += health.remaining_watts * NEW_PANEL_USD_PER_W * sp.usd_to_ngn_rate
        * SECOND_LIFE_PRICE_RATIO * INSTALLER_PANEL_SHARE * eq.quantity;
    }
    panels.push({ brand: eq.brand, quantity: eq.quantity, silver_grams: parseFloat(sg.toFixed(4)) });
  }

  return {
    total_panels:                equipment.reduce((s, e) => s + e.quantity, 0),
    total_silver_grams:          parseFloat(totalSilver.toFixed(4)),
    expected_recovery_grams:     parseFloat((totalSilver * SILVER_RECOVERY_YIELD).toFixed(4)),
    expected_recovery_value_ngn: Math.round(totalSilverNgn),
    total_second_life_value_ngn: Math.round(totalSecondLifeNgn),
    silver_price_ngn_per_gram:   parseFloat(sp.price_per_gram_ngn.toFixed(2)),
    panels,
  };
}

module.exports = {
  calculatePanelValue,
  calculatePanelSilver,
  calculateBatteryValue,
  calculatePortfolioSilver,
  calcPanelSOH,
  getSilverPrice,
};
