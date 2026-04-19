/**
 * SolNuv PV Simulation Service
 * PVWatts-equivalent hourly solar PV generation model with Erbs beam/diffuse
 * decomposition, IEC 61215 cell temperature, and inverter clipping.
 * Calculates AC output for each hour of a TMY year based on location,
 * system configuration, and panel technology characteristics.
 */

const { PANEL_TECHNOLOGIES, DEFAULT_PANEL_TECHNOLOGY, INSTALLATION_TYPES } = require('../constants/technologyConstants');

const HOURS_PER_YEAR = 8760;
const DEG2RAD = Math.PI / 180;
const STC_IRRADIANCE = 1000; // W/m²
const SOLAR_CONSTANT = 1361; // W/m² — extraterrestrial irradiance

/**
 * ASHRAE IAM (Incidence Angle Modifier) model — PVsyst/SAM industry standard.
 * Reduces module output at high angles of incidence due to increased glass reflection.
 * Reference: ASHRAE model with b0 coefficient (typical glass: 0.05).
 * @param {number} cosIncidence — cos(angle of incidence)
 * @returns {number} IAM factor (0 to 1)
 */
function calculateIAM(cosIncidence) {
  if (cosIncidence <= 0.05) return 0;
  const b0 = 0.05; // ASHRAE coefficient for standard glass
  return Math.max(0, 1 - b0 * (1 / cosIncidence - 1));
}

/**
 * Soiling loss model for African installations — adapted from PVsyst methodology.
 * Models dust accumulation between cleaning events, with Harmattan/Sahel-specific factors.
 * Reference: Kimber et al. (2006) soiling rate model + Africa-specific adjustments.
 * @param {string} cleaningFrequency — 'daily'|'weekly'|'monthly'|'quarterly'|'rarely'
 * @param {number} month — 0-indexed month (0=Jan, 11=Dec)
 * @param {string} installationType — installation type key
 * @returns {number} Soiling derate factor (0 to 1, higher is better)
 */
function calculateSoilingLoss(cleaningFrequency = 'monthly', month = 0, installationType = 'rooftop_tilted') {
  // Base soiling rate: %/day between cleanings
  const SOILING_RATES = {
    daily: 0, weekly: 0.002, monthly: 0.003, quarterly: 0.004, rarely: 0.005,
  };
  // Days between cleanings
  const CLEANING_INTERVALS = {
    daily: 1, weekly: 7, monthly: 30, quarterly: 90, rarely: 365,
  };
  // Harmattan season penalty (Nov-Feb) — heavy dust in West Africa
  const HARMATTAN_FACTOR = [1.8, 1.6, 1.2, 1.0, 1.0, 0.9, 0.8, 0.8, 0.9, 1.0, 1.3, 1.7];
  // Ground-mount and carport have less dust pooling than rooftop
  const installFactor = (installationType === 'ground_fixed' || installationType === 'ground_tracker') ? 0.85
    : installationType === 'floating' ? 0.6 : 1.0;

  const rate = SOILING_RATES[cleaningFrequency] || 0.003;
  const interval = CLEANING_INTERVALS[cleaningFrequency] || 30;
  const seasonFactor = HARMATTAN_FACTOR[month] || 1.0;
  // Average soiling during the interval: halfway through the accumulation period
  const avgSoiling = rate * (interval / 2) * seasonFactor * installFactor;
  return Math.max(0.85, 1 - avgSoiling); // Floor at 85% (catastrophic soiling)
}

/**
 * Spectral correction factor for different cell technologies — adapted from SAM.
 * Different cell types respond differently to varying Air Mass (AM) conditions.
 * Reference: Lee & Panchula, SAM spectral correction model.
 * @param {number} airmass — atmospheric air mass
 * @param {string} technology — panel technology key
 * @returns {number} spectral correction factor (typically 0.95-1.05)
 */
function spectralCorrection(airmass, technology) {
  const tech = PANEL_TECHNOLOGIES[technology] || PANEL_TECHNOLOGIES[DEFAULT_PANEL_TECHNOLOGY];
  const group = tech.group || 'p-type';
  // Polynomial correction coefficients per technology group (from SAM/Sandia database)
  // AM=1.5 is reference condition (factor=1.0)
  const am = Math.max(1, Math.min(airmass, 10));
  if (group === 'thin-film') {
    // CdTe/CIGS benefit from high AM (red-rich spectrum)
    return 0.918 + 0.1175 * am - 0.0154 * am * am;
  }
  // Crystalline silicon — slight penalty at high AM
  return 1.015 - 0.02 * (am - 1.5);
}

/**
 * Erbs correlation: decompose GHI into diffuse fraction based on clearness index kt.
 * Reference: Erbs, Klein & Duffie (1982), Solar Energy 28(4).
 * @param {number} kt - Clearness index (GHI / extraterrestrial horizontal irradiance)
 * @returns {number} kd - Diffuse fraction (DHI / GHI)
 */
function erbsDiffuseFraction(kt) {
  if (kt <= 0) return 1.0;
  if (kt <= 0.22) return 1.0 - 0.09 * kt;
  if (kt <= 0.80) return 0.9511 - 0.1604 * kt + 4.388 * kt * kt - 16.638 * kt * kt * kt + 12.336 * kt * kt * kt * kt;
  return 0.165;
}

/**
 * Simulate annual PV generation at hourly resolution.
 *
 * @param {object} config
 * @param {number} config.capacityKwp - DC nameplate capacity (kWp)
 * @param {number} config.tiltDeg - Panel tilt angle (degrees)
 * @param {number} config.azimuthDeg - Panel azimuth (0=N, 90=E, 180=S, 270=W)
 * @param {number} config.lat - Site latitude (decimal degrees)
 * @param {string} config.technology - Key in PANEL_TECHNOLOGIES
 * @param {number} config.systemLossesPct - Total system losses (%, default 14)
 * @param {number} config.inverterEffPct - Inverter efficiency (%, default 96)
 * @param {number} config.dcAcRatio - DC/AC ratio for inverter clipping (default 1.2)
 * @param {number[]} config.hourlyGhi - 8760 GHI values (W/m²)
 * @param {number[]} config.hourlyTemp - 8760 ambient temperature values (°C)
 * @param {string} [config.installationType] - Installation type key for albedo/NOCT (default 'rooftop_flat')
 * @param {number} [config.degradationYear] - Year number for degradation (1-based, default 1)
 * @returns {{ hourlyAcKw: number[], annualKwh: number, monthlyKwh: number[], performanceRatio: number }}
 */
function simulatePVGeneration(config) {
  const {
    capacityKwp,
    tiltDeg = 20,
    azimuthDeg = 180,
    lat = 6.5,
    technology = DEFAULT_PANEL_TECHNOLOGY,
    systemLossesPct = 14,
    inverterEffPct = 96,
    dcAcRatio = 1.2,
    hourlyGhi,
    hourlyTemp,
    installationType = 'rooftop_flat',
    degradationYear = 1,
  } = config;

  const tech = PANEL_TECHNOLOGIES[technology] || PANEL_TECHNOLOGIES[DEFAULT_PANEL_TECHNOLOGY];
  const install = INSTALLATION_TYPES[installationType] || INSTALLATION_TYPES.rooftop_flat;
  const tempCoeff = tech.temp_coeff_pct_c / 100; // Convert %/°C to fraction/°C
  const systemLosses = systemLossesPct / 100;
  const inverterEff = inverterEffPct / 100;

  // Installation-dependent NOCT: glass-glass bifacial runs hotter, ground-mount has more airflow
  const NOCT = install.noct || 45;
  // Installation-dependent ground albedo
  const albedo = install.albedo || 0.20;
  // Module reference efficiency and tau-alpha product for IEC cell temp
  const etaRef = 0.20;
  const tauAlpha = 0.9;

  // Inverter AC capacity (for clipping)
  const inverterAcCapKw = capacityKwp / dcAcRatio;

  const latRad = lat * DEG2RAD;
  const tiltRad = tiltDeg * DEG2RAD;
  const azimuthRad = azimuthDeg * DEG2RAD;

  const hourlyAcKw = new Array(HOURS_PER_YEAR);
  let dayOfYear = 0;
  let hourIndex = 0;
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Loss-waterfall accumulators. All are STC-equivalent energies in kWh — the
  // incident-POA term is the reference that every downstream loss is reported
  // as a percentage of.
  let ePoaRaw = 0;            // array-face POA incident (pre-IAM)
  let ePoaEff = 0;            // POA after IAM
  let eAfterSpectral = 0;     // × spectral factor
  let eAfterThermal = 0;      // × temperature derate
  let eAfterSoiling = 0;      // × soiling adjustment
  let eDcPreBifacial = 0;     // × (1 − system_losses)
  let eBifacial = 0;          // additive rear-side contribution
  let eAcPreClip = 0;         // DC → AC before inverter clip
  let eAcPostClip = 0;        // actual inverter output

  for (let month = 0; month < 12; month++) {
    for (let day = 0; day < DAYS_PER_MONTH[month]; day++) {
      dayOfYear++;
      const doy = dayOfYear;

      // Solar declination (Spencer, 1971)
      const declRad = 0.4093 * Math.sin((2 * Math.PI * (284 + doy)) / 365);

      // Eccentricity correction factor for earth-sun distance
      const B = (2 * Math.PI * (doy - 1)) / 365;
      const Eo = 1.00011 + 0.034221 * Math.cos(B) + 0.001280 * Math.sin(B)
        + 0.000719 * Math.cos(2 * B) + 0.000077 * Math.sin(2 * B);
      // Extraterrestrial horizontal irradiance at this time of year
      const I0 = SOLAR_CONSTANT * Eo;

      for (let hour = 0; hour < 24; hour++) {
        const idx = hourIndex++;
        const ghi = (hourlyGhi[idx] || 0);
        const ambTemp = hourlyTemp ? (hourlyTemp[idx] || 25) : 25;

        if (ghi <= 0) {
          hourlyAcKw[idx] = 0;
          continue;
        }

        // Solar hour angle
        const solarHour = hour + 0.5; // mid-hour
        const hourAngleRad = ((solarHour - 12) * 15) * DEG2RAD;

        // Solar altitude angle
        const sinAlt = Math.sin(latRad) * Math.sin(declRad) +
          Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
        const solarAltRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

        if (solarAltRad <= 0.01) { // ~0.6° minimum altitude to avoid extreme airmass
          hourlyAcKw[idx] = 0;
          continue;
        }

        // Solar azimuth angle
        const cosAz = (Math.sin(declRad) - Math.sin(latRad) * sinAlt) /
          (Math.cos(latRad) * Math.cos(solarAltRad));
        const solarAzRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
        const solarAzFinal = solarHour >= 12 ? (2 * Math.PI - solarAzRad) : solarAzRad;

        // ── Erbs GHI → Beam/Diffuse Decomposition ──
        // Extraterrestrial horizontal irradiance for this instant
        const I0h = I0 * sinAlt;
        // Clearness index
        const kt = I0h > 0 ? Math.min(ghi / I0h, 1.0) : 0;
        // Diffuse fraction via Erbs correlation
        const kd = erbsDiffuseFraction(kt);
        const DHI = ghi * kd;
        const BHI = ghi - DHI; // Beam horizontal irradiance

        // Angle of incidence on tilted surface
        const cosIncidence = sinAlt * Math.cos(tiltRad) +
          Math.cos(solarAltRad) * Math.sin(tiltRad) *
          Math.cos(solarAzFinal - azimuthRad);

        // ── Plane of Array Irradiance (isotropic sky model) ──
        // Beam component on tilted surface
        const beamTilted = BHI > 0 && sinAlt > 0.05
          ? BHI * Math.max(0, cosIncidence) / sinAlt
          : 0;
        // Isotropic diffuse component
        const diffuseTilted = DHI * (1 + Math.cos(tiltRad)) / 2;
        // Ground-reflected component (location/installation-dependent albedo)
        const groundReflected = ghi * albedo * (1 - Math.cos(tiltRad)) / 2;

        let poaIrradiance = beamTilted + diffuseTilted + groundReflected;
        poaIrradiance = Math.max(0, poaIrradiance);

        // ── IAM (Incidence Angle Modifier) — PVsyst/SAM standard ──
        // Reduce beam component by IAM factor for glass reflection at steep angles
        const iamFactor = calculateIAM(cosIncidence);
        const beamTiltedIAM = beamTilted * iamFactor;
        const poaEffective = beamTiltedIAM + diffuseTilted + groundReflected;

        // ── Spectral correction — SAM methodology ──
        // Air mass calculation (Kasten & Young, 1989)
        const solarAltDeg = solarAltRad / DEG2RAD;
        const airmass = solarAltDeg > 0
          ? 1 / (Math.sin(solarAltRad) + 0.50572 * Math.pow(solarAltDeg + 6.07995, -1.6364))
          : 10;
        const spectralFactor = spectralCorrection(airmass, technology);

        // ── IEC 61215 Cell Temperature Model ──
        // T_cell = T_amb + (NOCT - 20) × (POA / 800) × (1 - η_ref / τα)
        const cellTemp = ambTemp + (NOCT - 20) * (poaEffective / 800) * (1 - etaRef / tauAlpha);

        // Temperature derating
        const tempDerate = 1 + tempCoeff * (cellTemp - 25);

        // ── Soiling loss — PVsyst Africa-adapted ──
        // Note: system_losses_pct already includes a baseline soiling assumption.
        // This adds seasonal Harmattan variation only (net ±1-3%).
        const soilingDerate = calculateSoilingLoss(
          config.cleaningFrequency || 'monthly', month, installationType,
        );
        // Normalize to average soiling = 1.0 so system_losses_pct isn't double-counted
        const avgSoiling = 0.97; // typical average for monthly cleaning
        const soilingAdjustment = soilingDerate / avgSoiling;
        const soilingFinal = Math.max(0.92, Math.min(1.03, soilingAdjustment));

        // Nominal-irradiance-equivalent power (STC reference, no derates). Used
        // as the denominator for the loss waterfall below.
        const pStcRaw = capacityKwp * (poaIrradiance / STC_IRRADIANCE);
        const pStcEff = capacityKwp * (poaEffective / STC_IRRADIANCE);
        ePoaRaw += pStcRaw;
        ePoaEff += pStcEff;
        const pAfterSpectral = pStcEff * spectralFactor;
        eAfterSpectral += pAfterSpectral;
        const pAfterThermal = pAfterSpectral * tempDerate;
        eAfterThermal += pAfterThermal;
        const pAfterSoiling = pAfterThermal * soilingFinal;
        eAfterSoiling += pAfterSoiling;

        // DC power output with all derates applied
        const dcPower = pAfterSoiling * (1 - systemLosses);
        eDcPreBifacial += dcPower;

        // ── Bifacial gain — PVsyst/SAM rear-side model ──
        // Bifacial modules harvest rear-side irradiance from ground reflection.
        // Gain depends on albedo, module height, and tilt.
        let bifacialBoost = 0;
        if (tech.bifacial && poaEffective > 0) {
          // Simplified rear irradiance: GHI × albedo × view factor
          const rearViewFactor = (1 - Math.cos(tiltRad)) / 2; // tilted panel sees more ground
          const rearIrradiance = ghi * albedo * rearViewFactor;
          const midGain = ((tech.bifacial_gain_min || 0) + (tech.bifacial_gain_max || 0)) / 2;
          // Rear-side contributes proportionally to its irradiance share
          bifacialBoost = capacityKwp * (rearIrradiance / STC_IRRADIANCE) * midGain
            * tempDerate * (1 - systemLosses);
          eBifacial += bifacialBoost;
        }

        const dcTotal = dcPower + bifacialBoost;
        const acPreClip = dcTotal * inverterEff;
        eAcPreClip += acPreClip;

        // AC power output with inverter clipping
        const acPower = Math.max(0, Math.min(acPreClip, inverterAcCapKw));
        eAcPostClip += acPower;

        hourlyAcKw[idx] = acPower;
      }
    }
  }

  // Apply degradation for the specified year
  let degradationFactor = 1;
  if (degradationYear >= 1) {
    const firstYearLoss = tech.first_year_loss || 0;
    const annualDeg = tech.deg_rate_pct_yr / 100 || 0;

    if (degradationYear === 1) {
      degradationFactor = 1 - firstYearLoss;
    } else {
      degradationFactor = (1 - firstYearLoss) * Math.pow(1 - annualDeg, degradationYear - 1);
    }
  }

  for (let i = 0; i < HOURS_PER_YEAR; i++) {
    hourlyAcKw[i] *= degradationFactor;
  }

  // Calculate metrics
  const annualKwh = hourlyAcKw.reduce((s, v) => s + v, 0);
  const performanceRatio = capacityKwp > 0 ? annualKwh / capacityKwp : 0;

  // Monthly totals
  const monthlyKwh = [];
  let idx = 0;
  for (let m = 0; m < 12; m++) {
    const hoursInMonth = DAYS_PER_MONTH[m] * 24;
    let monthTotal = 0;
    for (let h = 0; h < hoursInMonth; h++, idx++) {
      monthTotal += hourlyAcKw[idx] || 0;
    }
    monthlyKwh.push(Math.round(monthTotal * 10) / 10);
  }

  // ── Loss waterfall (percentages of incident POA STC-equivalent energy) ──
  // Each entry is the fraction of incident-POA "theoretical" energy gained or
  // lost at that stage. Positive = gain, negative = loss, expressed as % so
  // the results UI can render a clean waterfall chart.
  const eDegradationLoss = eAcPostClip * (1 - degradationFactor);
  const pct = (val) => (ePoaRaw > 0 ? (val / ePoaRaw) * 100 : 0);

  const loss_waterfall = {
    reference: 'incident_poa_stc_kwh',
    incident_poa_kwh: Math.round(ePoaRaw * 10) / 10,
    steps: {
      iam_loss_pct: -Math.abs(pct(ePoaRaw - ePoaEff)),
      spectral_delta_pct: pct(eAfterSpectral - ePoaEff),
      thermal_loss_pct: pct(eAfterThermal - eAfterSpectral),
      soiling_adjustment_pct: pct(eAfterSoiling - eAfterThermal),
      system_losses_pct: pct(eDcPreBifacial - eAfterSoiling),
      bifacial_gain_pct: pct(eBifacial),
      inverter_efficiency_loss_pct: pct(eAcPreClip - (eDcPreBifacial + eBifacial)),
      inverter_clipping_loss_pct: pct(eAcPostClip - eAcPreClip),
      degradation_loss_pct: pct(-eDegradationLoss),
    },
    final_yield_pct: pct(eAcPostClip - eDegradationLoss),
  };

  // Round all step percentages to 2 decimals for payload stability.
  for (const key of Object.keys(loss_waterfall.steps)) {
    loss_waterfall.steps[key] = Math.round(loss_waterfall.steps[key] * 100) / 100;
  }
  loss_waterfall.final_yield_pct = Math.round(loss_waterfall.final_yield_pct * 100) / 100;

  return {
    hourlyAcKw,
    annualKwh: Math.round(annualKwh * 10) / 10,
    monthlyKwh,
    performanceRatio: Math.round(performanceRatio),
    degradationFactor: Math.round(degradationFactor * 10000) / 10000,
    loss_waterfall,
  };
}

/**
 * Distribute Helioscope monthly generation totals to 8760 hours
 * using local irradiance profile as shape template.
 * @param {number[]} monthlyGenKwh - 12 monthly generation totals from Helioscope
 * @param {number[]} hourlyGhi - 8760 GHI profile for shape reference
 * @returns {number[]} 8760 hourly generation in kW
 */
function distributeHelioscapeToHourly(monthlyGenKwh, hourlyGhi) {
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const hourlyKw = new Array(HOURS_PER_YEAR).fill(0);
  let idx = 0;

  for (let month = 0; month < 12; month++) {
    const hoursInMonth = DAYS_PER_MONTH[month] * 24;
    const targetKwh = Number(monthlyGenKwh[month]) || 0;

    // Sum GHI for this month's hours as shape reference
    let ghiSum = 0;
    for (let h = 0; h < hoursInMonth; h++) {
      ghiSum += hourlyGhi[idx + h] || 0;
    }

    // Distribute monthly total proportional to GHI shape
    for (let h = 0; h < hoursInMonth; h++) {
      const ghiVal = hourlyGhi[idx + h] || 0;
      hourlyKw[idx + h] = ghiSum > 0 ? (targetKwh * ghiVal / ghiSum) : 0;
      idx++;
    }
  }

  // idx should be at start of next month iteration, but we increment inside the loop
  return hourlyKw;
}

/**
 * Calculate degraded generation for a specific year.
 * @param {number} year1Kwh - Year-1 generation
 * @param {number} year - Target year (1-based)
 * @param {string} technology - Panel technology key
 * @returns {number} Degraded generation kWh
 */
function getDegradedGeneration(year1Kwh, year, technology) {
  const tech = PANEL_TECHNOLOGIES[technology] || PANEL_TECHNOLOGIES[DEFAULT_PANEL_TECHNOLOGY];
  const annualDeg = tech.deg_rate_pct_yr / 100;
  if (year <= 1) return year1Kwh;
  return year1Kwh * Math.pow(1 - annualDeg, year - 1);
}

module.exports = {
  simulatePVGeneration,
  distributeHelioscapeToHourly,
  getDegradedGeneration,
};
