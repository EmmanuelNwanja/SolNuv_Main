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
    deg_rate_pct_yr:  0.70,  // ≤0.70%/yr per standard BSF warranty (IEC 61215)
    first_year_loss:  0.030, // 3.0%: higher LID in p-type BSF, compounded by LETID in hot climate
    temp_coeff_pct_c: -0.45, // P-type poly BSF: -0.43 to -0.47%/°C (Clean Energy Reviews)
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'Older technology still common in African fields. Deg rate per IEC 61215 / standard BSF warranty specs. First-year LID 3% elevated due to p-type BSF + LETID in high-heat environments.',
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
    deg_rate_pct_yr:  0.40,  // ≤0.40%/yr: JA Solar Deep Blue 4.0, Jinko Tiger Neo, LONGi Hi-MO 6 all specify this
    first_year_loss:  0.010, // 1.0%: JA Solar & Jinko n-type warranty — first-year ≤1.0% (user-facing spec)
    temp_coeff_pct_c: -0.30, // N-type TOPCon: -0.29 to -0.32%/°C (Clean Energy Reviews confirmed range)
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'Deg rate and first-year loss sourced from JA Solar Deep Blue 4.0, Jinko Tiger Neo warranty specs. Temp coeff confirmed by Clean Energy Reviews independent review.',
  },

  // ── n-type TOPCon Bifacial ───────────────────────────────────────────────
  topcon_bi: {
    label:            'n-type TOPCon Bifacial',
    group:            'n-type',
    silver_mg_per_wp: 0.40,
    deg_rate_pct_yr:  0.40,  // ≤0.40%/yr: JA Solar Deep Blue 4.0 Pro, Jinko Tiger Neo N bifacial spec
    first_year_loss:  0.010, // 1.0%: JA Solar n-type warranty — first-year ≤1.0%
    temp_coeff_pct_c: -0.30, // N-type TOPCon: -0.29 to -0.32%/°C
    bifacial:         true,
    bifacial_gain_min: 0.10,
    bifacial_gain_max: 0.25,
    notes: 'Most popular new installation choice 2024+. Deg rates per JA Solar Deep Blue 4.0 Pro / Jinko Tiger Neo N warranty. Rear-side gain 10–25% on reflective surfaces.',
  },

  // ── HPBC Mono (LONGi Hi-MO 6 style rear-contact) ────────────────────────
  hpbc_mono: {
    label:            'HPBC Mono (Rear Contact)',
    group:            'n-type',
    silver_mg_per_wp: 0.30,
    deg_rate_pct_yr:  0.40,  // ≤0.40%/yr: LONGi Hi-MO X6 (HPBC) official warranty spec
    first_year_loss:  0.010, // 1.0%: n-type HPBC has no LID advantage over TOPCon in year-1 warranty
    temp_coeff_pct_c: -0.29, // LONGi Hi-MO X6 datasheet: -0.29%/°C
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'LONGi HPBC rear-contact. Deg rate and first-year loss from LONGi Hi-MO X6 official warranty. Temp coeff from LONGi datasheet.',
  },

  // ── HPBC Bifacial ────────────────────────────────────────────────────────
  hpbc_bi: {
    label:            'HPBC Bifacial (Rear Contact)',
    group:            'n-type',
    silver_mg_per_wp: 0.30,
    deg_rate_pct_yr:  0.40,  // ≤0.40%/yr: LONGi Hi-MO X6 bifacial warranty spec
    first_year_loss:  0.010, // 1.0%: n-type substrate — same first-year spec as HPBC mono
    temp_coeff_pct_c: -0.29, // LONGi Hi-MO X6 datasheet: -0.29%/°C
    bifacial:         true,
    bifacial_gain_min: 0.08,
    bifacial_gain_max: 0.22,
    notes: 'LONGi HPBC bifacial. Deg rate and first-year loss from LONGi Hi-MO X6 bifacial warranty. Rear-side gain 8–22% on reflective surfaces.',
  },

  // ── HJT (Heterojunction) ─────────────────────────────────────────────────
  hjt: {
    label:            'HJT (Heterojunction)',
    group:            'n-type',
    silver_mg_per_wp: 0.50,
    deg_rate_pct_yr:  0.25,  // ≤0.25%/yr: REC Alpha Pro, Huasun Himalaya, Risen Titan S warranty specs
    first_year_loss:  0.005, // 0.5%: HJT uses amorphous Si passivation — no p-type LID mechanism.
                             // First-year and subsequent years are nearly identical by physics.
                             // REC Alpha Pro specifies identical rate from year 1 onward.
    temp_coeff_pct_c: -0.24, // REC Alpha Pro and Huasun datasheets: -0.24%/°C (premium HJT)
    bifacial:         true,
    bifacial_gain_min: 0.10,
    bifacial_gain_max: 0.25,
    notes: 'Best temperature coefficient — ideal for hot climates. HJT has NO LID because there is no p-type crystalline Si; first-year loss is negligible (0.5%). Deg rate per REC Alpha Pro / Huasun Himalaya warranty. Uses low-temp paste requiring more silver than PERC/TOPCon.',
  },

  // ── IBC (Interdigitated Back Contact) ────────────────────────────────────
  ibc: {
    label:            'IBC (All-Back Contact)',
    group:            'n-type',
    silver_mg_per_wp: 0.28,
    deg_rate_pct_yr:  0.25,  // ≤0.25%/yr: Maxeon 3/5/6 warranty spec
    first_year_loss:  0.003, // 0.3%: IBC is high-purity n-type with no p-type LID by design.
                             // Maxeon warranty does not bifurcate first-year from subsequent years.
    temp_coeff_pct_c: -0.27, // Maxeon 7 datasheet: -0.27%/°C; range -0.26 to -0.30 (Clean Energy Reviews)
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'Premium all-back-contact design. Deg rate per Maxeon 3/5/6/7 warranty. Negligible LID by design — high-purity n-type substrate with no p-type boron-oxygen defect mechanism.',
  },

  // ── Thin Film CdTe ───────────────────────────────────────────────────────
  thin_film_cdte: {
    label:            'Thin Film CdTe (First Solar)',
    group:            'thin-film',
    silver_mg_per_wp: 0,
    deg_rate_pct_yr:  0.40,  // ≤0.40%/yr: First Solar Series 6/7 warranty spec
    first_year_loss:  0.020, // 2.0%: CdTe undergoes an initial thermal stabilisation period.
                             // First Solar warranty explicitly lists a higher first-year loss
                             // before the module reaches stable operating state.
    temp_coeff_pct_c: -0.27, // First Solar Series 6: -0.27%/°C per datasheet
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'No silver. Deg rate per First Solar Series 6/7 warranty. First-year loss reflects CdTe thermal stabilisation — after which degradation stabilises to the annual rate.',
  },

  // ── Thin Film CIGS ───────────────────────────────────────────────────────
  thin_film_cigs: {
    label:            'Thin Film CIGS',
    group:            'thin-film',
    silver_mg_per_wp: 0,
    deg_rate_pct_yr:  0.45,  // ≤0.45%/yr: conservative CIGS field data (IEA PVPS Task 13)
    first_year_loss:  0.015, // 1.5%: CIGS has voltage-induced metastability (VIM) in early operation
    temp_coeff_pct_c: -0.33, // Typical CIGS: -0.30 to -0.36%/°C
    bifacial:         false,
    bifacial_gain_min: 0,
    bifacial_gain_max: 0,
    notes: 'No silver. Deg rate from IEA PVPS Task 13 field data. First-year loss reflects CIGS voltage-induced metastability (VIM) — modules stabilise after initial field conditioning.',
  },
};

// Default for unknown / unspecified technology
const DEFAULT_PANEL_TECHNOLOGY = 'mono_perc';

// ─── INSTALLATION TYPES ──────────────────────────────────────────────────────
// Defines ground albedo and NOCT adjustments per installation configuration.
// albedo      — ground reflectance (0–1) affecting POA ground component
// noct        — Nominal Operating Cell Temperature (°C) varies by airflow/mount
// label       — human-readable name for UI
// description — brief explanation for tooltip
const INSTALLATION_TYPES = {
  rooftop_flat: {
    label: 'Rooftop (Flat)',
    description: 'Panels flush-mounted on flat concrete or metal roof',
    albedo: 0.25,  // Concrete/light roof surface
    noct: 47,      // Restricted airflow under panels
  },
  rooftop_tilted: {
    label: 'Rooftop (Tilted Rack)',
    description: 'Panels on tilted racks above the roof surface',
    albedo: 0.25,
    noct: 45,      // Better airflow than flush-mount
  },
  ground_fixed: {
    label: 'Ground Mount (Fixed)',
    description: 'Fixed-tilt ground-mounted racking system',
    albedo: 0.20,  // Natural ground / grass
    noct: 44,      // Good airflow, open field
  },
  ground_tracker: {
    label: 'Ground Mount (Single-Axis Tracker)',
    description: 'Single-axis tracker following the sun east-west',
    albedo: 0.20,
    noct: 44,
  },
  carport: {
    label: 'Carport / Canopy',
    description: 'Elevated canopy structure over parking or walkway',
    albedo: 0.30,  // Concrete/asphalt parking surface
    noct: 43,      // Excellent airflow, elevated
  },
  bipv: {
    label: 'BIPV (Building-Integrated)',
    description: 'Panels integrated into building facade or roof material',
    albedo: 0.15,  // Low — building facade
    noct: 50,      // Poor airflow, insulated behind
  },
  floating: {
    label: 'Floating Solar',
    description: 'Panels on floating platforms over water bodies',
    albedo: 0.06,  // Water surface
    noct: 40,      // Water cooling effect
  },
};

const DEFAULT_INSTALLATION_TYPE = 'rooftop_tilted';

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

  // ── Sodium-Ion ───────────────────────────────────────────────────────────
  sodium_ion: {
    label:               'Sodium-Ion',
    group:               'sodium',
    annual_soh_loss_pct: 0.030,
    cycle_life_ref:      3000,
    reference_dod_pct:   80,
    cycle_exponent:      1.10,
    recommended_dod_pct: 80,
    round_trip_eff:      0.92,
    temp_sensitivity:    1.2,
    notes: 'Emerging chemistry. No lithium or cobalt. Excellent cold-weather performance. Lower energy density but very cheap.',
  },

  // ── Vanadium Redox Flow Battery (VRFB) ───────────────────────────────────
  flow_vrfb: {
    label:               'Flow Battery — Vanadium Redox (VRFB)',
    group:               'flow',
    annual_soh_loss_pct: 0.005,
    cycle_life_ref:      20000,
    reference_dod_pct:   100,
    cycle_exponent:      1.02,
    recommended_dod_pct: 100,
    round_trip_eff:      0.75,
    temp_sensitivity:    1.1,
    notes: 'Near-unlimited cycle life. Energy and power decoupled. Best for long-duration storage. High upfront cost.',
  },
};

// Legacy chemistry key aliases (for backward compatibility with existing DB values)
const CHEMISTRY_ALIASES = {
  'lithium-iron-phosphate': 'lfp',
  'lithium':                'nmc',
  'lead-acid':              'lead_acid_agm',
  'lead_acid':              'lead_acid_agm',
  'sodium-ion':             'sodium_ion',
  'sodium':                 'sodium_ion',
  'flow':                   'flow_vrfb',
  'vanadium':               'flow_vrfb',
  'nickel-cadmium':         'nicd',
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
  INSTALLATION_TYPES,
  DEFAULT_INSTALLATION_TYPE,
  BATTERY_CHEMISTRIES,
  DEFAULT_BATTERY_CHEMISTRY,
  CHEMISTRY_ALIASES,
  resolveChemistry,
  cyclesAtDoD,
};
