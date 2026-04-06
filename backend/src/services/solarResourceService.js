/**
 * SolNuv Solar Resource Service
 * Fetches and caches solar irradiance data from NASA POWER API.
 * Provides TMY (Typical Meteorological Year) hourly GHI, temperature, and wind data.
 */

const axios = require('axios');
const supabase = require('../config/database');
const logger = require('../utils/logger');

const NASA_POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/climatology/point';
const NASA_POWER_HOURLY = 'https://power.larc.nasa.gov/api/temporal/hourly/point';

const HOURS_PER_YEAR = 8760;
const CACHE_MAX_AGE_DAYS = 90;

/**
 * Round lat/lon to nearest 0.5° for caching (NASA POWER grid resolution).
 */
function roundToGrid(val) {
  return Math.round(val * 2) / 2;
}

/**
 * Fetch hourly solar resource data for a location.
 * Uses cache first, then NASA POWER API.
 * @param {number} lat
 * @param {number} lon
 * @returns {{ hourlyGhi: number[], hourlyTemp: number[], hourlyWind: number[], annualGhiKwhM2: number }}
 */
async function getHourlySolarResource(lat, lon) {
  const latR = roundToGrid(lat);
  const lonR = roundToGrid(lon);

  // Check cache
  const cached = await getCachedResource(latR, lonR);
  if (cached) return cached;

  // Fetch from NASA POWER
  const data = await fetchNASAPowerData(lat, lon);

  // Cache the result
  try {
    await supabase.from('solar_resource_cache').upsert({
      lat_rounded: latR,
      lon_rounded: lonR,
      data_source: 'nasa_power',
      hourly_ghi_wm2: data.hourlyGhi,
      hourly_temp_c: data.hourlyTemp,
      hourly_wind_ms: data.hourlyWind,
      annual_ghi_kwh_m2: data.annualGhiKwhM2,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'lat_rounded,lon_rounded,data_source' });
  } catch (err) {
    logger.warn('Failed to cache solar resource', { message: err.message });
  }

  return data;
}

async function getCachedResource(latR, lonR) {
  try {
    const { data, error } = await supabase
      .from('solar_resource_cache')
      .select('*')
      .eq('lat_rounded', latR)
      .eq('lon_rounded', lonR)
      .eq('data_source', 'nasa_power')
      .single();

    if (error || !data) return null;

    // Check age
    const ageMs = Date.now() - new Date(data.fetched_at).getTime();
    if (ageMs > CACHE_MAX_AGE_DAYS * 24 * 3600 * 1000) return null;

    return {
      hourlyGhi: data.hourly_ghi_wm2,
      hourlyTemp: data.hourly_temp_c,
      hourlyWind: data.hourly_wind_ms || new Array(HOURS_PER_YEAR).fill(2),
      annualGhiKwhM2: Number(data.annual_ghi_kwh_m2) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch data from NASA POWER API and construct 8760-hour TMY arrays.
 * Uses climatology monthly averages + diurnal profiles to build synthetic hourly data.
 */
async function fetchNASAPowerData(lat, lon) {
  try {
    // Fetch monthly climatology (long-term averages)
    const response = await axios.get(NASA_POWER_BASE, {
      params: {
        parameters: 'ALLSKY_SFC_SW_DWN,T2M,WS2M,ALLSKY_SFC_SW_DWN_HR',
        community: 'RE',
        longitude: lon,
        latitude: lat,
        format: 'JSON',
      },
      timeout: 30000,
    });

    const params = response.data?.properties?.parameter;
    if (!params) throw new Error('No data returned from NASA POWER');

    // Monthly GHI in kWh/m²/day → build 8760-hour profile
    const monthlyGhi = extractMonthlyValues(params.ALLSKY_SFC_SW_DWN);
    const monthlyTemp = extractMonthlyValues(params.T2M);
    const monthlyWind = extractMonthlyValues(params.WS2M);

    const hourlyGhi = buildHourlyFromMonthlyGhi(monthlyGhi, lat);
    const hourlyTemp = buildHourlyFromMonthlyTemp(monthlyTemp, lat);
    const hourlyWind = buildHourlyFromMonthly(monthlyWind, 2);

    const annualGhiKwhM2 = monthlyGhi.reduce((sum, daily, i) => {
      return sum + daily * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i];
    }, 0);

    return { hourlyGhi, hourlyTemp, hourlyWind, annualGhiKwhM2 };
  } catch (err) {
    logger.error('NASA POWER fetch failed, using fallback', { lat, lon, message: err.message });
    return generateFallbackSolarData(lat);
  }
}

function extractMonthlyValues(paramObj) {
  if (!paramObj) return new Array(12).fill(0);
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push(Number(paramObj[m] || paramObj[String(m)] || 0));
  }
  return months;
}

/**
 * Build 8760 hourly GHI values (W/m²) from monthly daily averages (kWh/m²/day).
 * Uses solar position model for diurnal shape plus day-to-day clearness index
 * variability using a seeded pseudo-random generator for reproducibility.
 */
function buildHourlyFromMonthlyGhi(monthlyDailyGhi, lat) {
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const hourly = [];
  const latRad = (lat * Math.PI) / 180;

  // Simple seeded PRNG for reproducible day-to-day variability (mulberry32)
  let seed = Math.round(Math.abs(lat) * 1000 + 137);
  function rand() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  for (let month = 0; month < 12; month++) {
    const days = DAYS_PER_MONTH[month];
    const dailyGhiKwh = monthlyDailyGhi[month] || 0;

    // Representative day of year for this month
    const midDoy = DAYS_PER_MONTH.slice(0, month).reduce((s, d) => s + d, 0) + Math.floor(days / 2);

    // Solar declination (Spencer, 1971)
    const declRad = 0.4093 * Math.sin((2 * Math.PI * (284 + midDoy)) / 365);

    // Sunrise hour angle
    const cosWs = -Math.tan(latRad) * Math.tan(declRad);
    const wsRad = Math.acos(Math.max(-1, Math.min(1, cosWs)));
    const daylightHours = (2 * wsRad * 180) / (Math.PI * 15);

    // Sunrise and sunset hours (solar time)
    const solarNoon = 12;
    const sunrise = solarNoon - daylightHours / 2;
    const sunset = solarNoon + daylightHours / 2;

    // Day-to-day clearness index variability: σ depends on monthly mean kt
    // Higher mean kt (clear skies) → lower variability; lower kt → higher variability
    const absLat = Math.abs(lat);
    const ktVariability = absLat < 15 ? 0.12 : absLat < 23 ? 0.15 : 0.10;

    for (let d = 0; d < days; d++) {
      // Generate daily clearness scaling (Gaussian-ish from uniform, Box-Muller lite)
      const u1 = Math.max(0.001, rand());
      const u2 = rand();
      const gaussApprox = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      // Scale daily GHI by clearness perturbation, clamped to [0.4, 1.6] of monthly mean
      const dailyScale = Math.max(0.4, Math.min(1.6, 1 + ktVariability * gaussApprox));
      const dayGhiKwh = dailyGhiKwh * dailyScale;

      // Distribute daily GHI across daylight hours using sinusoidal shape
      const integratedSine = [];
      let sineSum = 0;
      for (let h = 0; h < 24; h++) {
        const solarHour = h + 0.5; // mid-hour
        if (solarHour >= sunrise && solarHour <= sunset) {
          const frac = (solarHour - sunrise) / (sunset - sunrise);
          const sineVal = Math.sin(frac * Math.PI);
          integratedSine.push(sineVal);
          sineSum += sineVal;
        } else {
          integratedSine.push(0);
        }
      }

      for (let h = 0; h < 24; h++) {
        const ghiWm2 = sineSum > 0
          ? (dayGhiKwh * 1000 * integratedSine[h]) / sineSum
          : 0;
        hourly.push(Math.max(0, ghiWm2));
      }
    }
  }

  return hourly.slice(0, HOURS_PER_YEAR);
}

/**
 * Build 8760 hourly temperature from monthly averages.
 * Applies latitude-dependent diurnal amplitude: arid/inland regions swing more,
 * coastal/tropical regions swing less.
 * @param {number[]} monthlyTemp - 12 monthly average temperatures
 * @param {number} [lat] - Latitude for diurnal amplitude estimation
 */
function buildHourlyFromMonthlyTemp(monthlyTemp, lat = 6.5) {
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const hourly = [];

  // Diurnal temperature amplitude by latitude band (°C):
  // Coastal tropics (|lat| < 8°): ±4°C  — high humidity damps swing
  // Inland tropics (8-15°): ±7°C        — moderate continentality
  // Sahel/semi-arid (15-23°): ±10°C     — dry air, large day/night delta
  // Subtropics (23+°): ±8°C             — moderate swing
  const absLat = Math.abs(lat);
  let amplitude;
  if (absLat < 8) amplitude = 4;
  else if (absLat < 15) amplitude = 7;
  else if (absLat < 23) amplitude = 10;
  else amplitude = 8;

  for (let month = 0; month < 12; month++) {
    const days = DAYS_PER_MONTH[month];
    const avgTemp = monthlyTemp[month] || 25;

    for (let d = 0; d < days; d++) {
      for (let h = 0; h < 24; h++) {
        // Diurnal cycle: coldest at ~5am, warmest at ~14:00 (2pm)
        const diurnalOffset = amplitude * Math.sin(((h - 5) * Math.PI) / 12);
        hourly.push(avgTemp + diurnalOffset);
      }
    }
  }

  return hourly.slice(0, HOURS_PER_YEAR);
}

/**
 * Build 8760 hourly values from monthly averages (constant per month).
 */
function buildHourlyFromMonthly(monthlyValues, defaultVal = 0) {
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const hourly = [];
  for (let month = 0; month < 12; month++) {
    const val = monthlyValues[month] || defaultVal;
    const hours = DAYS_PER_MONTH[month] * 24;
    for (let h = 0; h < hours; h++) {
      hourly.push(val);
    }
  }
  return hourly.slice(0, HOURS_PER_YEAR);
}

/**
 * Fallback solar data when NASA POWER is unavailable.
 * Uses typical African irradiance ranges based on latitude.
 */
function generateFallbackSolarData(lat) {
  const absLat = Math.abs(lat);
  // Rough daily GHI: tropical ~5.5 kWh/m²/day, temperate ~4.5
  const baseDailyGhi = absLat < 15 ? 5.5 : absLat < 25 ? 5.0 : 4.5;

  const monthlyGhi = [];
  for (let m = 0; m < 12; m++) {
    // Seasonal variation: ±15% for tropics, ±25% for subtropics
    const seasonalVar = absLat < 15 ? 0.85 + 0.30 * Math.sin((m - 2) * Math.PI / 6)
      : 0.75 + 0.50 * Math.sin((m - (lat > 0 ? 2 : 8)) * Math.PI / 6);
    monthlyGhi.push(baseDailyGhi * seasonalVar);
  }

  const monthlyTemp = [];
  for (let m = 0; m < 12; m++) {
    const baseTemp = absLat < 15 ? 28 : absLat < 25 ? 25 : 22;
    const variation = absLat < 15 ? 3 : 6;
    monthlyTemp.push(baseTemp + variation * Math.sin((m - (lat > 0 ? 1 : 7)) * Math.PI / 6));
  }

  const hourlyGhi = buildHourlyFromMonthlyGhi(monthlyGhi, lat);
  const hourlyTemp = buildHourlyFromMonthlyTemp(monthlyTemp, lat);
  const hourlyWind = new Array(HOURS_PER_YEAR).fill(2.5);
  const annualGhiKwhM2 = monthlyGhi.reduce((sum, daily, i) =>
    sum + daily * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i], 0);

  return { hourlyGhi, hourlyTemp, hourlyWind, annualGhiKwhM2 };
}

/**
 * Estimate optimal tilt angle for a location.
 * Rule of thumb: tilt ≈ latitude for annual optimization.
 */
function estimateOptimalTilt(lat) {
  return Math.round(Math.abs(lat));
}

/**
 * Estimate optimal azimuth for a location.
 * Northern hemisphere: face south (180°), Southern: face north (0°).
 */
function estimateOptimalAzimuth(lat) {
  return lat >= 0 ? 180 : 0;
}

module.exports = {
  getHourlySolarResource,
  estimateOptimalTilt,
  estimateOptimalAzimuth,
  roundToGrid,
};
