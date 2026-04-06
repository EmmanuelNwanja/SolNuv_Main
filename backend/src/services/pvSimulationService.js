/**
 * SolNuv PV Simulation Service
 * PVWatts-equivalent hourly solar PV generation model.
 * Calculates AC output for each hour of a TMY year based on location,
 * system configuration, and panel technology characteristics.
 */

const { PANEL_TECHNOLOGIES, DEFAULT_PANEL_TECHNOLOGY } = require('../constants/technologyConstants');

const HOURS_PER_YEAR = 8760;

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
 * @param {number[]} config.hourlyGhi - 8760 GHI values (W/m²)
 * @param {number[]} config.hourlyTemp - 8760 ambient temperature values (°C)
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
    hourlyGhi,
    hourlyTemp,
    degradationYear = 1,
  } = config;

  const tech = PANEL_TECHNOLOGIES[technology] || PANEL_TECHNOLOGIES[DEFAULT_PANEL_TECHNOLOGY];
  const tempCoeff = tech.temp_coeff_pct_c / 100; // Convert %/°C to fraction/°C
  const systemLosses = systemLossesPct / 100;
  const inverterEff = inverterEffPct / 100;

  // NOCT for cell temperature calculation
  const NOCT = 45; // °C, typical
  const STC_IRRADIANCE = 1000; // W/m²

  const latRad = (lat * Math.PI) / 180;
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const azimuthRad = (azimuthDeg * Math.PI) / 180;

  const hourlyAcKw = new Array(HOURS_PER_YEAR);
  let dayOfYear = 0;
  let hourIndex = 0;
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  for (let month = 0; month < 12; month++) {
    for (let day = 0; day < DAYS_PER_MONTH[month]; day++) {
      dayOfYear++;
      const doy = dayOfYear;

      // Solar declination (Spencer approximation)
      const declRad = 0.4093 * Math.sin((2 * Math.PI * (284 + doy)) / 365);

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
        const hourAngleRad = ((solarHour - 12) * 15 * Math.PI) / 180;

        // Solar altitude angle
        const sinAlt = Math.sin(latRad) * Math.sin(declRad) +
          Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
        const solarAltRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

        if (solarAltRad <= 0) {
          hourlyAcKw[idx] = 0;
          continue;
        }

        // Solar azimuth angle
        const cosAz = (Math.sin(declRad) - Math.sin(latRad) * sinAlt) /
          (Math.cos(latRad) * Math.cos(solarAltRad));
        const solarAzRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
        const solarAzFinal = solarHour >= 12 ? (2 * Math.PI - solarAzRad) : solarAzRad;

        // Angle of incidence on tilted surface
        const cosIncidence = sinAlt * Math.cos(tiltRad) +
          Math.cos(solarAltRad) * Math.sin(tiltRad) *
          Math.cos(solarAzFinal - azimuthRad);

        // Plane of Array irradiance using isotropic sky model
        // POA = beam × cos(incidence)/sin(altitude) + diffuse × (1+cos(tilt))/2 + ground_reflected
        const beamComponent = ghi > 0 && sinAlt > 0.05
          ? ghi * 0.75 * Math.max(0, cosIncidence) / sinAlt
          : 0;
        const diffuseComponent = ghi * 0.25 * (1 + Math.cos(tiltRad)) / 2;
        const groundReflected = ghi * 0.2 * (1 - Math.cos(tiltRad)) / 2; // albedo 0.2

        let poaIrradiance = beamComponent + diffuseComponent + groundReflected;
        poaIrradiance = Math.max(0, Math.min(poaIrradiance, 1400)); // Physical limit

        // Cell temperature (Sandia model simplified)
        const cellTemp = ambTemp + (NOCT - 20) / 800 * poaIrradiance;

        // Temperature derating
        const tempDerate = 1 + tempCoeff * (cellTemp - 25);

        // DC power output
        const dcPower = capacityKwp * (poaIrradiance / STC_IRRADIANCE) * tempDerate * (1 - systemLosses);

        // AC power output
        const acPower = Math.max(0, dcPower * inverterEff);

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

  return {
    hourlyAcKw,
    annualKwh: Math.round(annualKwh * 10) / 10,
    monthlyKwh,
    performanceRatio: Math.round(performanceRatio),
    degradationFactor: Math.round(degradationFactor * 10000) / 10000,
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
