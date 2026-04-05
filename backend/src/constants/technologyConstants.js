/**
 * SolNuv Technology Constants
 *
 * Panel technologies and battery chemistries with engineering data
 * calibrated for West African (high-heat, high-irradiance) conditions.
 *
 * All degradation rates are annual %/yr under typical Nigerian climate.
 * Temperature coefficients are for Pmax (%/°C).
 * Silver content is mg per watt-peak (mg/Wp).
 */

// ─── PANEL TECHNOLOGIES ──────────────────────────────────────────────────────
// Key parameters per technology that override the era-based silver defaults
// and the climate-zone-based degradation defaults when a technology is known.
//
// silver_mg_per_wp   — mg of silver per rated Wp (for silver recovery calculation)
// deg_rate_pct_yr    — annual power degradation after year 1 (%/yr)
// first_year_loss    — light-induced degradation year 1 (fraction, not %)
// temp_coeff_pct_c   — Pmax temperature coefficient (%/°C, always negative)
// bifacial           — true if panel can harvest rear-side irradiance
// bifacial_gain_min  — minimum rear-side gain fraction (e.g. 0.05 = 5%)
// bifacial_gain_max  — maximum rear-side gain fraction
// label              — human-readable name for UI display
// group              — technology family for grouping in picker
const PANEL_TECHNOLOGIES = {
  // ── Polycrystalline BSF (legacy) ─────────────────────────────────────────
  poly_bsf: {
    label:            'Polycrystalline BSF (Legacy)',
    group:            'p-type',
    silver_mg_per_wp: 0.55,
    deg_rate_pct_yr:  0.70,
    first_year_loss:  0.025,
    temp_coeff_pct_c: -0.45,
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'Older technology still common in African fields. Higher degradation and temperature sensitivity.',
  },

  // ── Monocrystalline PERC (monofacial) ────────────────────────────────────
  mono_perc: {
    label:            'Mono PERC (Monofacial)',
    group:            'p-type',
    silver_mg_per_wp: 0.38,
    deg_rate_pct_yr:  0.45,
    first_year_loss:  0.020,
    temp_coeff_pct_c: -0.35,
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'Current mainstream p-type. Good balance of cost, performance, and reliability.',
  },

  // ── Monocrystalline PERC Bifacial ────────────────────────────────────────
  mono_perc_bi: {
    label:            'Mono PERC Bifacial',
    group:            'p-type',
    silver_mg_per_wp: 0.42,
    deg_rate_pct_yr:  0.40,
    first_year_loss:  0.018,
    temp_coeff_pct_c: -0.35,
    bifacial:         true,
    bifacial_gain_min: 0.05,
    bifacial_gain_max: 0.20,
    notes: 'Rear-side gain 5–20% depending on ground albedo (sand/gravel best in Nigeria).',
  },

  // ── n-type TOPCon Mono ───────────────────────────────────────────────────
  topcon_mono: {
    label:            'n-type TOPCon (Monofacial)',
    group:            'n-type',
    silver_mg_per_wp: 0.40,
    deg_rate_pct_yr:  0.35,
    first_year_loss:  0.015,
    temp_coeff_pct_c: -0.30,
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'Lower degradation than p-type. Better performance in heat due to improved temp coefficient.',
  },

  // ── n-type TOPCon Bifacial ───────────────────────────────────────────────
  topcon_bi: {
    label:            'n-type TOPCon Bifacial',
    group:            'n-type',
    silver_mg_per_wp: 0.40,
    deg_rate_pct_yr:  0.35,
    first_year_loss:  0.015,
    temp_coeff_pct_c: -0.30,
    bifacial:         true,
    bifacial_gain_min: 0.10,
    bifacial_gain_max: 0.25,
    notes: 'Most popular new installation choice 2024+. Rear-side gain 10–25% on reflective surfaces.',
  },

  // ── HPBC Mono (LONGi Hi-MO 6 style rear-contact) ────────────────────────
  hpbc_mono: {
    label:            'HPBC Mono (Rear Contact)',
    group:            'n-type',
    silver_mg_per_wp: 0.30,
    deg_rate_pct_yr:  0.35,
    first_year_loss:  0.015,
    temp_coeff_pct_c: -0.29,
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'LONGi HPBC rear-contact. No front busbar shading. Lower silver on front contacts.',
  },

  // ── HPBC Bifacial ────────────────────────────────────────────────────────
  hpbc_bi: {
    label:            'HPBC Bifacial (Rear Contact)',
    group:            'n-type',
    silver_mg_per_wp: 0.30,
    deg_rate_pct_yr:  0.32,
    first_year_loss:  0.013,
    temp_coeff_pct_c: -0.29,
    bifacial:         true,
    bifacial_gain_min: 0.08,
    bifacial_gain_max: 0.22,
    notes: 'Best in class rear-contact bifacial. Combined gain from bifaciality and low temp coefficient.',
  },

  // ── HJT (Heterojunction) ─────────────────────────────────────────────────
  hjt: {
    label:            'HJT (Heterojunction)',
    group:            'n-type',
    silver_mg_per_wp: 0.20,
    deg_rate_pct_yr:  0.25,
    first_year_loss:  0.010,
    temp_coeff_pct_c: -0.24,
    bifacial:         true,
    bifacial_gain_min: 0.10,
    bifacial_gain_max: 0.25,
    notes: 'Best temperature coefficient of all technologies — ideal for hot climates. ~8% more real output vs Poly BSF at 40°C. Lowest degradation.',
  },

  // ── IBC (Interdigitated Back Contact) ────────────────────────────────────
  ibc: {
    label:            'IBC (All-Back Contact)',
    group:            'n-type',
    silver_mg_per_wp: 0.20,
    deg_rate_pct_yr:  0.25,
    first_year_loss:  0.008,
    temp_coeff_pct_c: -0.27,
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'Premium all-back-contact design. Highest efficiency, no front-side shading losses. SunPower / Maxeon cells.',
  },

  // ── Thin Film CdTe ───────────────────────────────────────────────────────
  thin_film_cdte: {
    label:            'Thin Film CdTe (First Solar)',
    group:            'thin-film',
    silver_mg_per_wp: 0,
    deg_rate_pct_yr:  0.40,
    first_year_loss:  0.008,
    temp_coeff_pct_c: -0.27,
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'No silver. CdTe semiconductor. Good performance in diffuse light conditions. First Solar dominant.',
  },

  // ── Thin Film CIGS ───────────────────────────────────────────────────────
  thin_film_cigs: {
    label:            'Thin Film CIGS',
    group:            'thin-film',
    silver_mg_per_wp: 0,
    deg_rate_pct_yr:  0.45,
    first_year_loss:  0.012,
    temp_coeff_pct_c: -0.33,
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'No silver. Copper-Indium-Gallium-Selenide. Flexible substrate options available.',
  },
};

// Default for unknown / unspecified technology
const DEFAULT_PANEL_TECHNOLOGY = 'mono_perc';

// ─── BATTERY CHEMISTRIES ─────────────────────────────────────────────────────
// annual_soh_loss_pct  — fraction of SoH lost per year under normal conditions
// cycle_life_ref       — reference cycle count at reference_dod_pct DoD
// reference_dod_pct    — the DoD at which cycle_life_ref applies
// cycle_exponent       — Peukert-style exponent for DoD→cycle life scaling
//                        cycles_at_dod ≈ cycle_life_ref × (reference_dod_pct / dod_pct)^cycle_exponent
// recommended_dod_pct  — recommended maximum depth of discharge (%)
// round_trip_eff       — round-trip efficiency (fraction)
// temp_sensitivity     — relative degradation acceleration per 10°C above 25°C
//                        1.0 = no acceleration; 2.0 = doubles per 10°C (Arrhenius)
// label                — human-readable name
// group                — chemistry family
const BATTERY_CHEMISTRIES = {
  // ── Lead Acid — Flooded ──────────────────────────────────────────────────
  lead_acid_flooded: {
    label:               'Lead Acid — Flooded (VRLA-FLA)',
    group:               'lead-acid',
    annual_soh_loss_pct: 0.18,
    cycle_life_ref:      350,
    reference_dod_pct:   50,
    cycle_exponent:      1.20,
    recommended_dod_pct: 50,
    round_trip_eff:      0.75,
    temp_sensitivity:    1.8,
    notes: 'Common in African off-grid systems. Requires water top-up. High temperature accelerates degradation.',
  },

  // ── Lead Acid — AGM ──────────────────────────────────────────────────────
  lead_acid_agm: {
    label:               'Lead Acid — AGM (Sealed)',
    group:               'lead-acid',
    annual_soh_loss_pct: 0.14,
    cycle_life_ref:      650,
    reference_dod_pct:   50,
    cycle_exponent:      1.20,
    recommended_dod_pct: 50,
    round_trip_eff:      0.82,
    temp_sensitivity:    1.7,
    notes: 'Sealed, maintenance-free. Common in UPS and telecom backup. Better than flooded in vibration.',
  },

  // ── Lead Acid — Gel ──────────────────────────────────────────────────────
  lead_acid_gel: {
    label:               'Lead Acid — Gel (Sealed)',
    group:               'lead-acid',
    annual_soh_loss_pct: 0.11,
    cycle_life_ref:      800,
    reference_dod_pct:   50,
    cycle_exponent:      1.18,
    recommended_dod_pct: 50,
    round_trip_eff:      0.83,
    temp_sensitivity:    1.6,
    notes: 'Better heat tolerance than AGM. Slower charge acceptance. Good for hot climates with long float.',
  },

  // ── LiFePO4 (Lithium Iron Phosphate) ─────────────────────────────────────
  lfp: {
    label:               'LiFePO4 — Lithium Iron Phosphate',
    group:               'lithium',
    annual_soh_loss_pct: 0.025,
    cycle_life_ref:      4000,
    reference_dod_pct:   80,
    cycle_exponent:      1.12,
    recommended_dod_pct: 80,
    round_trip_eff:      0.97,
    temp_sensitivity:    1.2,
    notes: 'Dominant lithium chemistry for solar storage in Africa. Excellent safety, long cycle life, best heat tolerance of lithium types.',
  },

  // ── NMC (Lithium Nickel Manganese Cobalt) ────────────────────────────────
  nmc: {
    label:               'NMC — Nickel Manganese Cobalt',
    group:               'lithium',
    annual_soh_loss_pct: 0.035,
    cycle_life_ref:      1500,
    reference_dod_pct:   80,
    cycle_exponent:      1.10,
    recommended_dod_pct: 80,
    round_trip_eff:      0.96,
    temp_sensitivity:    1.4,
    notes: 'Higher energy density than LFP. Used in EVs and portable electronics. More temperature-sensitive.',
  },

  // ── NCA (Lithium Nickel Cobalt Aluminium) ────────────────────────────────
  nca: {
    label:               'NCA — Nickel Cobalt Aluminium (Tesla)',
    group:               'lithium',
    annual_soh_loss_pct: 0.040,
    cycle_life_ref:      1200,
    reference_dod_pct:   80,
    cycle_exponent:      1.10,
    recommended_dod_pct: 80,
    round_trip_eff:      0.96,
    temp_sensitivity:    1.5,
    notes: 'Tesla Powerwall uses NCA. High energy density, higher degradation. Cobalt content adds recycling value.',
  },

  // ── LTO (Lithium Titanate) ───────────────────────────────────────────────
  lto: {
    label:               'LTO — Lithium Titanate',
    group:               'lithium',
    annual_soh_loss_pct: 0.010,
    cycle_life_ref:      15000,
    reference_dod_pct:   90,
    cycle_exponent:      1.05,
    recommended_dod_pct: 90,
    round_trip_eff:      0.96,
    temp_sensitivity:    1.1,
    notes: 'Extreme cycle life. Excellent in temperature extremes. Lower energy density. Used in industrial / telecom.',
  },

  // ── NiCd (Nickel Cadmium) ────────────────────────────────────────────────
  nicd: {
    label:               'NiCd — Nickel Cadmium (Legacy)',
    group:               'ni-cd',
    annual_soh_loss_pct: 0.045,
    cycle_life_ref:      2000,
    reference_dod_pct:   70,
    cycle_exponent:      1.15,
    recommended_dod_pct: 70,
    round_trip_eff:      0.72,
    temp_sensitivity:    1.3,
    notes: 'Legacy technology. Memory effect degrades capacity if not fully discharged. Still deployed in legacy telecom.',
  },
};

// Legacy chemistry key aliases (for backward compatibility with existing DB values)
const CHEMISTRY_ALIASES = {
  'lithium-iron-phosphate': 'lfp',
  'lithium':                'nmc',
  'lead-acid':              'lead_acid_agm',
  'lead_acid':              'lead_acid_agm',
};

const DEFAULT_BATTERY_CHEMISTRY = 'lfp';

/**
 * Resolve a chemistry key (including legacy aliases) to a canonical BATTERY_CHEMISTRIES key.
 * Returns DEFAULT_BATTERY_CHEMISTRY if no match.
 */
function resolveChemistry(key) {
  if (!key) return DEFAULT_BATTERY_CHEMISTRY;
  const k = key.toLowerCase().trim();
  if (BATTERY_CHEMISTRIES[k]) return k;
  if (CHEMISTRY_ALIASES[k]) return CHEMISTRY_ALIASES[k];
  return DEFAULT_BATTERY_CHEMISTRY;
}

/**
 * Calculate expected cycle life at a given DoD percentage using the
 * reference cycle life and Peukert-style exponent.
 *
 * @param {string} chemistryKey - canonical key in BATTERY_CHEMISTRIES
 * @param {number} dodPct - depth of discharge in % (0–100)
 * @returns {number} expected cycle count
 */
function cyclesAtDoD(chemistryKey, dodPct) {
  const chem = BATTERY_CHEMISTRIES[resolveChemistry(chemistryKey)];
  if (!chem) return 1000;
  const dod = Math.max(1, Math.min(100, dodPct));
  return Math.round(chem.cycle_life_ref * Math.pow(chem.reference_dod_pct / dod, chem.cycle_exponent));
}

module.exports = {
  PANEL_TECHNOLOGIES,
  DEFAULT_PANEL_TECHNOLOGY,
  BATTERY_CHEMISTRIES,
  DEFAULT_BATTERY_CHEMISTRY,
  CHEMISTRY_ALIASES,
  resolveChemistry,
  cyclesAtDoD,
};
