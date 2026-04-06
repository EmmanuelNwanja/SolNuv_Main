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
const { PANEL_TECHNOLOGIES, DEFAULT_PANEL_TECHNOLOGY, BATTERY_CHEMISTRIES, resolveChemistry } = require('../constants/technologyConstants');

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

// Condition multiplier: represents how close the panel is to its theoretical
// degradation curve. 'Excellent' = performing at theoretical best for its age.
// A panel cannot exceed its physics-based degradation just because it looks good.
const CONDITION_MODIFIER = { excellent: 1.00, good: 0.95, fair: 0.80, poor: 0.45, damaged: 0.00 };

// ─── SOILING EFFICIENCY by Nigerian climate zone ──────────────────────────────
// Dust and harmattan deposits reduce operational output. Unlike permanent degradation,
// soiling is REVERSIBLE by cleaning and does NOT affect panel SoH or resale value
// (buyers test panels post-cleaning). These factors reflect real-world output reduction.
//
// Baseline assumes monthly cleaning — the industry standard for maintained Nigerian sites.
// Sources: NREL sub-Saharan soiling study, IEA PVPS Task 13, GOGLA Nigeria field data
const ZONE_SOILING_BASE = {
  coastal_humid: 0.96,  // 4% avg annual loss — rain provides frequent natural self-cleaning
  se_humid:      0.95,  // 5% — good rainfall with minor dry-season deposit buildup
  mixed:         0.91,  // 9% — moderate harmattan incursion, irregular rainfall support
  sahel_dry:     0.87,  // 13% — heavy harmattan (Nov–Feb); far less natural rain cleaning
  default:       0.91,
};

// Cleaning frequency modifier: added to zone base to get final soiling efficiency.
// Positive = panel cleaned more often than baseline; negative = cleaned less often.
const CLEANING_FREQ_MODIFIER = {
  daily:     +0.030, // Near-zero soiling — staffed utility/commercial sites
  weekly:    +0.015, // Well-maintained; minimal dust accumulation between cleanings
  monthly:   +0.000, // Nigerian baseline — used throughout all other calculations
  quarterly: -0.060, // Harmattan accumulates significantly between quarterly cleanings
  rarely:    -0.140, // 3–4 months of harmattan deposits → up to 25% output loss in Sahel
};

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

function getSilverGramsPerPanel(installationDate, wattsPerPanel, panelTechnology = null) {
  const w = parseFloat(wattsPerPanel);
  // If a known technology is specified, use its mg/Wp value converted to grams per panel.
  // This is more accurate than era-based estimates when the technology is known.
  const tech = panelTechnology && PANEL_TECHNOLOGIES[panelTechnology];
  if (tech) {
    // mg/Wp × watts = mg total; ÷1000 = grams
    // No bifacial silver doubling: both sides share the same Wp capacity
    return parseFloat(((tech.silver_mg_per_wp * w) / 1000).toFixed(5));
  }
  // Era-based fallback for backward compatibility
  const mfgYear = Math.max(2014, new Date(installationDate || Date.now()).getFullYear() - 1);
  const key = mfgYear <= 2014 ? 'pre2015' : mfgYear >= 2025 ? 'post2024' : mfgYear;
  let g = SILVER_GRAMS_BY_ERA[key] || 0.12;
  // Half-cut / bifacial panels >500W have ~double the cell count
  if (w > 500) g *= 1.85;
  return g;
}

function calcPanelSOH(wattsPerPanel, installationDate, climateZone = 'mixed', condition = 'good', panelTechnology = null, cleaningFrequency = 'monthly') {
  const yrs = yearsOldFrom(installationDate);
  const tech = panelTechnology && PANEL_TECHNOLOGIES[panelTechnology];

  // Degradation rate: technology-specific takes precedence over climate-zone default.
  // When technology is known, the tech rate already reflects real-world performance;
  // climate zone applies a relative multiplier (harsher climate = +10–20% on tech rate).
  const baseRate = tech ? (tech.deg_rate_pct_yr / 100) : (ANNUAL_DEGRADATION[climateZone] || ANNUAL_DEGRADATION.default);
  const climateMult = tech ? getClimateMult(climateZone) : 1.0;
  const rate = baseRate * climateMult;

  // First-year LID: use technology-specific value if known, else 2% default
  const lid = tech ? tech.first_year_loss : 0.02;

  const rawSoh = Math.max(0.50, (1 - lid) - (rate * Math.max(0, yrs - 1)));
  const soh    = Math.min(1.0, rawSoh * (CONDITION_MODIFIER[condition] ?? 1.00));

  // Temperature derating at typical West African operating temperature (65°C cell temp from 40°C ambient)
  const tempCoeff = tech ? tech.temp_coeff_pct_c : -0.40;
  const deltaT = 40; // 65°C cell - 25°C STC
  const tempDeratingFactor = parseFloat((1 + (tempCoeff / 100) * deltaT).toFixed(4));

  // ── Soiling factor ──────────────────────────────────────────────────────────
  // Real-world output is further reduced by dust and harmattan deposits.
  // Soiling is REVERSIBLE (cleaning restores output) so it does NOT affect:
  //   - Panel SoH (physical aging is a separate, irreversible process)
  //   - Second-life resale price (buyers test and value panels post-cleaning)
  // It DOES critically affect operational kWh generation and accurate system sizing.
  const baseSoiling = ZONE_SOILING_BASE[climateZone] ?? ZONE_SOILING_BASE.default;
  const freqAdj     = CLEANING_FREQ_MODIFIER[cleaningFrequency] ?? 0;
  const soilingFactor   = parseFloat(Math.max(0.50, Math.min(0.99, baseSoiling + freqAdj)).toFixed(3));
  const soilingLossPct  = Math.round((1 - soilingFactor) * 100);
  const soilingNote     = `${climateZone.replace(/_/g, ' ')} climate with ${cleaningFrequency} cleaning: ~${soilingLossPct}% annual output loss from dust/harmattan. Increasing cleaning frequency fully recovers this loss.`;

  return {
    soh:              parseFloat(soh.toFixed(4)),
    remaining_watts:  Math.round(parseFloat(wattsPerPanel) * soh),
    years_old:        parseFloat(yrs.toFixed(1)),
    degradation_rate: `${(rate * 100).toFixed(2)}%/yr`,
    panel_technology: panelTechnology || null,
    temp_derating_factor:          tempDeratingFactor,
    effective_output_watts:        Math.round(parseFloat(wattsPerPanel) * soh * tempDeratingFactor),
    soiling_factor:                soilingFactor,
    soiling_adjusted_output_watts: Math.round(parseFloat(wattsPerPanel) * soh * tempDeratingFactor * soilingFactor),
    soiling_loss_pct:              soilingLossPct,
    soiling_note:                  soilingNote,
  };
}

// Climate zone multiplier for technology-based degradation rates.
// Technology deg_rate_pct_yr values are IEC/datasheet rates under standard conditions.
// West African climate (heat, humidity, dust, voltage surges) accelerates degradation
// significantly: the original system used 0.65–0.85%/yr vs global averages of 0.3–0.5%.
// These multipliers bridge the gap between datasheet and real-world West African conditions.
function getClimateMult(climateZone) {
  const multipliers = {
    coastal_humid: 2.0,   // Salt mist, humidity, PID, high ambient temps (Lagos, Rivers)
    sahel_dry:     1.85,  // Extreme heat cycling, sand abrasion (Kano, Sokoto, Borno)
    se_humid:      1.70,  // Persistent humidity, moisture ingress (Enugu, Anambra)
    mixed:         1.50,  // Moderate but still African climate (FCT, Oyo, Kaduna)
  };
  return multipliers[climateZone] || 1.50;
}

// Age-based market discount for second-life panels.
// Even a "healthy" old panel sells for much less because buyers factor in:
// - shorter remaining useful life in harsh climate
// - higher probability of imminent failure (encapsulant yellowing, junction-box corrosion)
// - no remaining warranty
// Linear decay: ~8% per year of age, floor at 15% to reflect scrap-with-working-output value.
function ageMarketDiscount(yearsOld) {
  return Math.max(0.15, 1.0 - 0.08 * yearsOld);
}

// Technology generation factor for second-hand market desirability.
// Current-gen tech (TOPCon, HJT, HPBC) commands higher resale prices
// because buyers value efficiency, lower degradation, and future-proofing.
// Legacy tech has lower demand even when functionally identical.
function techGenerationFactor(panelTechnology) {
  const factors = {
    poly_bsf:       0.55, // Legacy, very low demand — buyers strongly prefer newer tech
    mono_perc:      0.75, // Mainstream but aging, p-type being phased out
    mono_perc_bi:   0.80, // Slightly better demand due to bifacial
    topcon_mono:    0.92, // Current generation — good demand
    topcon_bi:      0.95, // Current gen bifacial — strong demand
    hpbc_mono:      0.92, // Premium current
    hpbc_bi:        0.95, // Premium current
    hjt:            0.95, // Premium — best temp performance for Africa
    ibc:            0.90, // Premium niche, smaller market
    thin_film_cdte: 0.60, // Niche, limited second-hand demand
    thin_film_cigs: 0.55, // Niche, very limited demand
  };
  return factors[panelTechnology] || 0.75;
}

// ─── MAIN: PANEL VALUATION ────────────────────────────────────────────────────
async function calculatePanelValue(wattsPerPanel, quantity, installationDate, climateZone = 'mixed', condition = 'good', panelTechnology = null, cleaningFrequency = 'monthly') {
  const sp  = await getSilverPrice();
  const qty = parseInt(quantity);
  const w   = parseFloat(wattsPerPanel);

  // 1 ── SILVER ROUTE ─────────────────────────────────────────────────────
  const silverPerPanel   = getSilverGramsPerPanel(installationDate, w, panelTechnology);
  const totalSilver      = silverPerPanel * qty;
  const spotNgn          = totalSilver * sp.price_per_gram_ngn;
  const installerSilver  = Math.round(spotNgn * INSTALLER_SILVER_SHARE);

  // 2 ── SECOND-LIFE ROUTE ────────────────────────────────────────────────
  const health = calcPanelSOH(w, installationDate, climateZone, condition, panelTechnology, cleaningFrequency);
  const { soh, remaining_watts: rW } = health;
  const viable = soh >= MIN_PANEL_SOH_FOR_SECONDLIFE;

  // Market-realistic second-life pricing:
  // Base: new-equivalent cost × second-life ratio (32%)
  // Then discount for age (shorter remaining life, no warranty, failure risk)
  // and technology generation (buyers prefer current-gen tech).
  const ageFactor  = ageMarketDiscount(health.years_old);
  const techFactor = panelTechnology ? techGenerationFactor(panelTechnology) : 0.75;

  const newEquivNgn    = rW * NEW_PANEL_USD_PER_W * sp.usd_to_ngn_rate;
  const secondLifeNgn  = newEquivNgn * SECOND_LIFE_PRICE_RATIO * ageFactor * techFactor;
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
    panel_technology: panelTechnology || null,
    panel_technology_label: (panelTechnology && PANEL_TECHNOLOGIES[panelTechnology]?.label) || null,

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
      age_discount_factor:            parseFloat(ageFactor.toFixed(2)),
      tech_generation_factor:         parseFloat(techFactor.toFixed(2)),
      installer_receives_ngn:         installerRefurb,
      installer_receives_min:         Math.round(installerRefurb * 0.75),
      installer_receives_max:         Math.round(installerRefurb * 1.25),
      is_viable: viable,
      note: viable
        ? `Each panel operates at ~${rW}W (${Math.round(ageFactor * 100)}% age factor, ${Math.round(techFactor * 100)}% tech demand). Test, clean, repackage and sell at measured rating.`
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
  // Use maybeSingle() (correct API for 0-or-1 row) inside try-catch.
  // Avoid chaining .catch() on a PostgREST builder, which is only PromiseLike —
  // not a full Promise — and may not expose .catch() as a callable method.
  let brandData = null;
  try {
    const { data } = await supabase
      .from('battery_brands')
      .select('*')
      .ilike('brand', brand)
      .maybeSingle();
    brandData = data;
  } catch (_) { /* table missing or network error — fall back to defaults */ }
  const sp  = await getSilverPrice();
  const qty = parseInt(quantity);
  const kwh = parseFloat(capacityKwh);
  const totalKwh = kwh * qty;

  const chemistry  = (brandData?.chemistry || 'lithium-iron-phosphate').toLowerCase();
  const isLeadAcid = chemistry.includes('lead');

  // SOH calculation — use expanded BATTERY_CHEMISTRIES constants when available
  const yrs         = yearsOldFrom(installationDate);
  const chemKey     = resolveChemistry(chemistry);
  const chemData    = BATTERY_CHEMISTRIES[chemKey];
  const annualLoss  = chemData ? chemData.annual_soh_loss_pct : (BATTERY_ANNUAL_SOH_LOSS[chemistry] || BATTERY_ANNUAL_SOH_LOSS.default);
  const rawSoh      = Math.max(0.10, 1 - annualLoss * yrs);
  const soh         = Math.min(1.0, rawSoh * (CONDITION_MODIFIER[condition] ?? 1.00));
  const viable      = soh >= MIN_BATTERY_SOH_FOR_SECONDLIFE;

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

async function calculatePortfolioRecycleIncome(userId, companyId) {
  // Query from projects (not equipment) to guarantee installation_date and status
  // are always correctly resolved — then delegate per-project to calculateProjectRecycleIncome
  // so portfolio totals are always 100% consistent with the project-detail page.
  let query = supabase
    .from('projects')
    .select(`
      id, status, installation_date,
      equipment(
        equipment_type, brand, size_watts, capacity_kwh, quantity, condition,
        panel_technology, battery_chemistry, climate_zone,
        estimated_silver_value_ngn
      )
    `)
    .in('status', ['active', 'decommissioned', 'pending_recovery', 'recycled']);

  if (companyId) query = query.eq('company_id', companyId);
  else           query = query.eq('user_id', userId);

  const { data: projects } = await query;
  const empty = { panel_recycle_ngn: 0, battery_recycle_ngn: 0, total_recycle_ngn: 0, silver_ngn: 0, total_with_silver_ngn: 0 };
  if (!projects?.length) return { expected: { ...empty }, actual: { ...empty } };

  const ACTIVE = new Set(['active', 'decommissioned', 'pending_recovery']);

  let expPanel = 0, expBattery = 0, expSilver = 0;
  let actPanel = 0, actBattery = 0, actSilver = 0;

  for (const proj of projects) {
    if (!proj.equipment?.length) continue;
    const income = await calculateProjectRecycleIncome(proj.equipment, proj.installation_date);
    if (ACTIVE.has(proj.status)) {
      expPanel   += income.panel_recycle_ngn;
      expBattery += income.battery_recycle_ngn;
      expSilver  += income.silver_ngn;
    } else if (proj.status === 'recycled') {
      actPanel   += income.panel_recycle_ngn;
      actBattery += income.battery_recycle_ngn;
      actSilver  += income.silver_ngn;
    }
  }

  return {
    expected: {
      panel_recycle_ngn:     expPanel,
      battery_recycle_ngn:   expBattery,
      total_recycle_ngn:     expPanel + expBattery,
      silver_ngn:            expSilver,
      total_with_silver_ngn: expPanel + expBattery + expSilver,
    },
    actual: {
      panel_recycle_ngn:     actPanel,
      battery_recycle_ngn:   actBattery,
      total_recycle_ngn:     actPanel + actBattery,
      silver_ngn:            actSilver,
      total_with_silver_ngn: actPanel + actBattery + actSilver,
    },
  };
}

async function calculatePortfolioSilver(userId, companyId) {
  let query = supabase
    .from('equipment')
    .select('equipment_type, brand, size_watts, quantity, projects!inner(user_id, company_id, status, installation_date, state)')
    .eq('equipment_type', 'panel')
    .in('projects.status', ['active', 'decommissioned']);

  if (companyId) query = query.eq('projects.company_id', companyId);
  else           query = query.eq('projects.user_id', userId);
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

/**
 * Calculate estimated recycle income for a single project's equipment array.
 * Used by the project detail endpoint.
 */
async function calculateProjectRecycleIncome(equipment, installationDate) {
  if (!equipment?.length) {
    return { panel_recycle_ngn: 0, battery_recycle_ngn: 0, total_recycle_ngn: 0, silver_ngn: 0, total_with_silver_ngn: 0 };
  }
  const sp = await getSilverPrice();

  let panelRecycle = 0, batteryRecycle = 0, silverNgn = 0;

  for (const eq of equipment) {
    if (eq.equipment_type === 'panel') {
      const w        = parseFloat(eq.size_watts || 400);
      const qty      = parseInt(eq.quantity || 1);
      const cond     = eq.condition || 'good';
      const panelTech = eq.panel_technology || null;
      const climZone  = eq.climate_zone || 'mixed';

      // Prefer stored DB silver value (computed at project-creation time with real date)
      const dbSilver = parseFloat(eq.estimated_silver_value_ngn || 0);
      if (dbSilver > 0) {
        silverNgn += dbSilver;
      } else {
        const sg = getSilverGramsPerPanel(installationDate, w, panelTech) * qty;
        silverNgn += Math.round(sg * sp.price_per_gram_ngn * INSTALLER_SILVER_SHARE);
      }

      // Panel second-life / material recycle — same age + tech discounts as calculatePanelValue
      const health    = calcPanelSOH(w, installationDate, climZone, cond, panelTech);
      if (health.soh >= MIN_PANEL_SOH_FOR_SECONDLIFE) {
        const ageFactor  = ageMarketDiscount(health.years_old);
        const techFactor = panelTech ? techGenerationFactor(panelTech) : 0.75;
        const newEq  = health.remaining_watts * NEW_PANEL_USD_PER_W * sp.usd_to_ngn_rate;
        panelRecycle += Math.round(newEq * SECOND_LIFE_PRICE_RATIO * ageFactor * techFactor * INSTALLER_PANEL_SHARE * qty);
      } else {
        panelRecycle += dbSilver || Math.round(getSilverGramsPerPanel(installationDate, w, panelTech) * qty * sp.price_per_gram_ngn * INSTALLER_SILVER_SHARE);
      }
    } else if (eq.equipment_type === 'battery') {
      const kwh      = parseFloat(eq.capacity_kwh || 2.4);
      const qty      = parseInt(eq.quantity || 1);
      const cond     = eq.condition || 'good';
      const totalKwh = kwh * qty;

      // Prefer stored battery_chemistry; fall back to brand-name heuristic
      let chemistry;
      if (eq.battery_chemistry) {
        chemistry = eq.battery_chemistry;
      } else {
        const brandLower = (eq.brand || '').toLowerCase();
        chemistry = (brandLower.includes('lead') || brandLower.includes('trojan') || brandLower.includes('luminous'))
          ? 'lead-acid' : 'lithium-iron-phosphate';
      }
      const isLead   = chemistry.includes('lead');
      const chemKey  = resolveChemistry(chemistry);
      const chemData = BATTERY_CHEMISTRIES[chemKey];

      const yrs      = yearsOldFrom(installationDate);
      const annualLoss = chemData ? chemData.annual_soh_loss_pct : (BATTERY_ANNUAL_SOH_LOSS[chemistry] || BATTERY_ANNUAL_SOH_LOSS.default);
      const rawSoh   = Math.max(0.10, 1 - annualLoss * yrs);
      const soh      = Math.min(1.0, rawSoh * (CONDITION_MODIFIER[cond] ?? 1.00));
      const viable   = soh >= MIN_BATTERY_SOH_FOR_SECONDLIFE;

      if (viable) {
        const newCostNgn = (NEW_BATTERY_USD_PER_KWH[chemistry] || NEW_BATTERY_USD_PER_KWH.default) * totalKwh * sp.usd_to_ngn_rate;
        batteryRecycle  += Math.round(newCostNgn * soh * BATTERY_SECONDLIFE_PRICE_RATIO * BATTERY_SECONDLIFE_INSTALLER_SHARE);
      } else if (isLead) {
        batteryRecycle += Math.round(LEAD_KG_PER_KWH * totalKwh * 0.88 * LEAD_PRICE_USD_PER_KG * sp.usd_to_ngn_rate * LEAD_INSTALLER_SHARE);
      } else {
        const liKg    = (LITHIUM_KG_PER_KWH[chemistry] || 0.065) * totalKwh;
        batteryRecycle += Math.round(liKg * LI_CONVERSION_FACTOR * LI_CARBONATE_PRICE_USD_PER_KG * sp.usd_to_ngn_rate * LITHIUM_INSTALLER_SHARE);
      }
    }
  }

  return {
    panel_recycle_ngn:     panelRecycle,
    battery_recycle_ngn:   batteryRecycle,
    total_recycle_ngn:     panelRecycle + batteryRecycle,
    silver_ngn:            silverNgn,
    total_with_silver_ngn: panelRecycle + batteryRecycle + silverNgn,
  };
}

module.exports = {
  calculatePanelValue,
  calculatePanelSilver,
  calculateBatteryValue,
  calculatePortfolioSilver,
  calculatePortfolioRecycleIncome,
  calculateProjectRecycleIncome,
  calcPanelSOH,
  getSilverPrice,
};
