/**
 * SolNuv Solar Resource Service
 *
 * Fetches hourly TMY (Typical Meteorological Year) irradiance, temperature and
 * wind arrays for a given lat/lon. Supports multi-source blending so we are
 * never beholden to a single provider:
 *
 *   WEATHER_SOURCES=nasa_power,pvgis    (comma-separated, evaluated in order)
 *
 * Each source provides monthly climatology. When multiple sources return data,
 * we take a simple arithmetic mean of the monthly values before synthesising
 * the 8760-hour arrays. If a source fails, it is silently skipped and the
 * remaining sources are used. If *all* sources fail, we fall back to a
 * latitude-based climatology so simulations still complete.
 *
 * The `meta` block on the return value records exactly which sources
 * contributed (with weights and fetch timestamps) so it can be written into
 * `simulation_results.run_provenance` for audit.
 */

const supabase = require('../config/database');
const logger = require('../utils/logger');
const {
  createResilientHttpClient,
  requestWithRetry,
  isTransientNetworkError,
  extractNetworkErrorMeta,
} = require('../utils/httpClient');

const NASA_POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/climatology/point';
const PVGIS_MR_BASE = 'https://re.jrc.ec.europa.eu/api/v5_2/MRcalc';

const HOURS_PER_YEAR = 8760;
const CACHE_MAX_AGE_DAYS = 90;
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const solarHttp = createResilientHttpClient({ timeout: 30_000 });

function roundToGrid(val) {
  return Math.round(val * 2) / 2;
}

function configuredSources() {
  const raw = (process.env.WEATHER_SOURCES || 'nasa_power').toLowerCase();
  const sources = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return sources.length ? sources : ['nasa_power'];
}

/**
 * Fetch hourly solar resource data for a location, blending configured
 * weather providers.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {{ hourlyGhi: number[], hourlyTemp: number[], hourlyWind: number[], annualGhiKwhM2: number, meta: object }}
 */
async function getHourlySolarResource(lat, lon) {
  const latR = roundToGrid(lat);
  const lonR = roundToGrid(lon);
  const sources = configuredSources();
  const cacheKey = sources.length > 1 ? `blend:${sources.join('+')}` : sources[0];

  const cached = await getCachedResource(latR, lonR, cacheKey);
  if (cached) {
    return {
      hourlyGhi: cached.hourlyGhi,
      hourlyTemp: cached.hourlyTemp,
      hourlyWind: cached.hourlyWind,
      annualGhiKwhM2: cached.annualGhiKwhM2,
      meta: {
        source: cacheKey,
        sources: cached.sources || [{ name: cacheKey, weight: 1, fetched_at: cached.fetchedAt }],
        cache_hit: true,
        used_fallback: false,
        fetched_at: cached.fetchedAt || null,
        lat_rounded: latR,
        lon_rounded: lonR,
      },
    };
  }

  const fetchedAt = new Date().toISOString();

  const contributions = [] as Array<{
    name: string;
    monthlyGhi: number[];
    monthlyTemp: number[];
    monthlyWind: number[];
    fetchedAt: string;
  }>;

  for (const src of sources) {
    try {
      const contrib = await fetchMonthlyFromSource(src, lat, lon);
      if (contrib) contributions.push(contrib);
    } catch (err: any) {
      logger.warn(`Weather source ${src} failed`, {
        message: err?.message,
        ...(extractNetworkErrorMeta(err) || {}),
      });
    }
  }

  let usedFallback = false;
  let blended: {
    monthlyGhi: number[];
    monthlyTemp: number[];
    monthlyWind: number[];
  };
  let sourcesMeta: Array<{ name: string; weight: number; fetched_at: string }>;

  if (contributions.length === 0) {
    usedFallback = true;
    const fb = generateFallbackMonthlyClimatology(lat);
    blended = {
      monthlyGhi: fb.monthlyGhi,
      monthlyTemp: fb.monthlyTemp,
      monthlyWind: fb.monthlyWind,
    };
    sourcesMeta = [{ name: 'fallback_climatology', weight: 1, fetched_at: fetchedAt }];
  } else {
    blended = blendMonthly(contributions);
    const weight = 1 / contributions.length;
    sourcesMeta = contributions.map((c) => ({
      name: c.name,
      weight: Number(weight.toFixed(4)),
      fetched_at: c.fetchedAt,
    }));
  }

  const hourlyGhi = buildHourlyFromMonthlyGhi(blended.monthlyGhi, lat);
  const hourlyTemp = buildHourlyFromMonthlyTemp(blended.monthlyTemp, lat);
  const hourlyWind = buildHourlyFromMonthly(blended.monthlyWind, 2);
  const annualGhiKwhM2 = blended.monthlyGhi.reduce(
    (sum, daily, i) => sum + daily * DAYS_PER_MONTH[i],
    0,
  );

  try {
    await supabase.from('solar_resource_cache').upsert(
      {
        lat_rounded: latR,
        lon_rounded: lonR,
        data_source: cacheKey,
        hourly_ghi_wm2: hourlyGhi,
        hourly_temp_c: hourlyTemp,
        hourly_wind_ms: hourlyWind,
        annual_ghi_kwh_m2: annualGhiKwhM2,
        fetched_at: fetchedAt,
        sources: sourcesMeta,
      } as any,
      { onConflict: 'lat_rounded,lon_rounded,data_source' },
    );
  } catch (err: any) {
    logger.warn('Failed to cache solar resource', { message: err.message });
  }

  return {
    hourlyGhi,
    hourlyTemp,
    hourlyWind,
    annualGhiKwhM2,
    meta: {
      source: cacheKey,
      sources: sourcesMeta,
      cache_hit: false,
      used_fallback: usedFallback,
      fetched_at: fetchedAt,
      lat_rounded: latR,
      lon_rounded: lonR,
    },
  };
}

async function getCachedResource(latR: number, lonR: number, source: string) {
  try {
    const { data, error } = await supabase
      .from('solar_resource_cache')
      .select('*')
      .eq('lat_rounded', latR)
      .eq('lon_rounded', lonR)
      .eq('data_source', source)
      .single();
    if (error || !data) return null;
    const ageMs = Date.now() - new Date(data.fetched_at).getTime();
    if (ageMs > CACHE_MAX_AGE_DAYS * 24 * 3600 * 1000) return null;
    if (!data.annual_ghi_kwh_m2 || Number(data.annual_ghi_kwh_m2) <= 0) return null;
    return {
      hourlyGhi: data.hourly_ghi_wm2,
      hourlyTemp: data.hourly_temp_c,
      hourlyWind: data.hourly_wind_ms || new Array(HOURS_PER_YEAR).fill(2),
      annualGhiKwhM2: Number(data.annual_ghi_kwh_m2) || 0,
      fetchedAt: data.fetched_at || null,
      sources: (data as any).sources || null,
    };
  } catch {
    return null;
  }
}

// ─── Source implementations ────────────────────────────────────────────────

async function fetchMonthlyFromSource(source: string, lat: number, lon: number) {
  switch (source) {
    case 'nasa_power':
      return await fetchMonthlyNASAPower(lat, lon);
    case 'pvgis':
      return await fetchMonthlyPVGIS(lat, lon);
    default:
      logger.warn(`Unknown weather source '${source}' — skipping`);
      return null;
  }
}

async function fetchMonthlyNASAPower(lat: number, lon: number) {
  const response = await requestWithRetry(
    () =>
      solarHttp.get(NASA_POWER_BASE, {
        params: {
          parameters: 'ALLSKY_SFC_SW_DWN,T2M,WS2M',
          community: 'RE',
          longitude: lon,
          latitude: lat,
          format: 'JSON',
        },
      }),
    { retries: 2, shouldRetry: isTransientNetworkError },
  );
  const params = response.data?.properties?.parameter;
  if (!params) throw new Error('No data returned from NASA POWER');
  return {
    name: 'nasa_power',
    monthlyGhi: extractMonthlyValues(params.ALLSKY_SFC_SW_DWN),
    monthlyTemp: extractMonthlyValues(params.T2M),
    monthlyWind: extractMonthlyValues(params.WS2M),
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * PVGIS monthly radiation endpoint. Returns the long-term monthly average
 * daily GHI (kWh/m²/day) and air temperature for 2005–2020.
 * https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en
 */
async function fetchMonthlyPVGIS(lat: number, lon: number) {
  const response = await requestWithRetry(
    () =>
      solarHttp.get(PVGIS_MR_BASE, {
        params: {
          lat,
          lon,
          horirrad: 1,
          outputformat: 'json',
          selectrad: 0,
        },
      }),
    { retries: 2, shouldRetry: isTransientNetworkError },
  );
  const outputs = response.data?.outputs?.monthly;
  if (!Array.isArray(outputs) || outputs.length === 0) {
    throw new Error('PVGIS returned no monthly data');
  }

  const monthlyGhi = new Array(12).fill(0);
  const monthlyTemp = new Array(12).fill(null) as Array<number | null>;
  const counts = new Array(12).fill(0);
  for (const row of outputs) {
    const monthIdx = Number(row.month) - 1;
    if (monthIdx < 0 || monthIdx > 11) continue;
    // H(h)_m is the mean sum of global irradiation per month (kWh/m²/month);
    // convert to daily average (kWh/m²/day) to match NASA POWER shape.
    const monthlyKwh = Number(row['H(h)_m'] ?? row['H(i)_m'] ?? 0);
    const days = DAYS_PER_MONTH[monthIdx];
    monthlyGhi[monthIdx] += monthlyKwh / days;
    counts[monthIdx] += 1;
    if (row['T2m'] != null) {
      const prev = monthlyTemp[monthIdx];
      monthlyTemp[monthIdx] = prev == null ? Number(row['T2m']) : (prev + Number(row['T2m'])) / 2;
    }
  }
  for (let i = 0; i < 12; i++) {
    if (counts[i] > 1) monthlyGhi[i] /= counts[i];
  }

  return {
    name: 'pvgis',
    monthlyGhi,
    monthlyTemp: monthlyTemp.map((v) => (v == null ? 25 : v)) as number[],
    // PVGIS MR endpoint does not provide wind; defer to other sources or a safe default.
    monthlyWind: new Array(12).fill(2),
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Blending ──────────────────────────────────────────────────────────────

function blendMonthly(
  contribs: Array<{
    monthlyGhi: number[];
    monthlyTemp: number[];
    monthlyWind: number[];
  }>,
) {
  const monthlyGhi = new Array(12).fill(0);
  const monthlyTemp = new Array(12).fill(0);
  const monthlyWind = new Array(12).fill(0);
  const ghiN = new Array(12).fill(0);
  const tempN = new Array(12).fill(0);
  const windN = new Array(12).fill(0);
  for (const c of contribs) {
    for (let m = 0; m < 12; m++) {
      if (c.monthlyGhi[m] > 0) {
        monthlyGhi[m] += c.monthlyGhi[m];
        ghiN[m] += 1;
      }
      if (Number.isFinite(c.monthlyTemp[m])) {
        monthlyTemp[m] += c.monthlyTemp[m];
        tempN[m] += 1;
      }
      if (Number.isFinite(c.monthlyWind[m]) && c.monthlyWind[m] > 0) {
        monthlyWind[m] += c.monthlyWind[m];
        windN[m] += 1;
      }
    }
  }
  for (let m = 0; m < 12; m++) {
    monthlyGhi[m] = ghiN[m] > 0 ? monthlyGhi[m] / ghiN[m] : 0;
    monthlyTemp[m] = tempN[m] > 0 ? monthlyTemp[m] / tempN[m] : 25;
    monthlyWind[m] = windN[m] > 0 ? monthlyWind[m] / windN[m] : 2;
  }
  return { monthlyGhi, monthlyTemp, monthlyWind };
}

// ─── Monthly → hourly synthesis (unchanged) ────────────────────────────────

function extractMonthlyValues(paramObj) {
  if (!paramObj) return new Array(12).fill(0);
  const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const months = [];
  for (let m = 0; m < 12; m++) {
    const val = Number(paramObj[MONTH_KEYS[m]] || paramObj[m + 1] || paramObj[String(m + 1)] || 0);
    months.push(val > 0 ? val : 0);
  }
  return months;
}

function buildHourlyFromMonthlyGhi(monthlyDailyGhi, lat) {
  const hourly = [];
  const latRad = (lat * Math.PI) / 180;
  let seed = Math.round(Math.abs(lat) * 1000 + 137);
  function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  for (let month = 0; month < 12; month++) {
    const days = DAYS_PER_MONTH[month];
    const dailyGhiKwh = monthlyDailyGhi[month] || 0;
    const midDoy = DAYS_PER_MONTH.slice(0, month).reduce((s, d) => s + d, 0) + Math.floor(days / 2);
    const declRad = 0.4093 * Math.sin((2 * Math.PI * (284 + midDoy)) / 365);
    const cosWs = -Math.tan(latRad) * Math.tan(declRad);
    const wsRad = Math.acos(Math.max(-1, Math.min(1, cosWs)));
    const daylightHours = (2 * wsRad * 180) / (Math.PI * 15);
    const solarNoon = 12;
    const sunrise = solarNoon - daylightHours / 2;
    const sunset = solarNoon + daylightHours / 2;
    const absLat = Math.abs(lat);
    const ktVariability = absLat < 15 ? 0.12 : absLat < 23 ? 0.15 : 0.1;

    for (let d = 0; d < days; d++) {
      const u1 = Math.max(0.001, rand());
      const u2 = rand();
      const gaussApprox = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const dailyScale = Math.max(0.4, Math.min(1.6, 1 + ktVariability * gaussApprox));
      const dayGhiKwh = dailyGhiKwh * dailyScale;

      const integratedSine: number[] = [];
      let sineSum = 0;
      for (let h = 0; h < 24; h++) {
        const solarHour = h + 0.5;
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
        const ghiWm2 = sineSum > 0 ? (dayGhiKwh * 1000 * integratedSine[h]) / sineSum : 0;
        hourly.push(Math.max(0, ghiWm2));
      }
    }
  }
  return hourly.slice(0, HOURS_PER_YEAR);
}

function buildHourlyFromMonthlyTemp(monthlyTemp, lat = 6.5) {
  const hourly = [];
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
        const diurnalOffset = amplitude * Math.sin(((h - 5) * Math.PI) / 12);
        hourly.push(avgTemp + diurnalOffset);
      }
    }
  }
  return hourly.slice(0, HOURS_PER_YEAR);
}

function buildHourlyFromMonthly(monthlyValues, defaultVal = 0) {
  const hourly = [];
  for (let month = 0; month < 12; month++) {
    const val = monthlyValues[month] || defaultVal;
    const hours = DAYS_PER_MONTH[month] * 24;
    for (let h = 0; h < hours; h++) hourly.push(val);
  }
  return hourly.slice(0, HOURS_PER_YEAR);
}

/**
 * Last-resort climatology when all live sources fail. Uses
 * latitude-based typical GHI / temperature ranges.
 */
function generateFallbackMonthlyClimatology(lat: number) {
  const absLat = Math.abs(lat);
  const baseDailyGhi = absLat < 15 ? 5.5 : absLat < 25 ? 5.0 : 4.5;
  const monthlyGhi: number[] = [];
  for (let m = 0; m < 12; m++) {
    const seasonalVar =
      absLat < 15
        ? 0.85 + 0.3 * Math.sin(((m - 2) * Math.PI) / 6)
        : 0.75 + 0.5 * Math.sin(((m - (lat > 0 ? 2 : 8)) * Math.PI) / 6);
    monthlyGhi.push(baseDailyGhi * seasonalVar);
  }
  const monthlyTemp: number[] = [];
  for (let m = 0; m < 12; m++) {
    const baseTemp = absLat < 15 ? 28 : absLat < 25 ? 25 : 22;
    const variation = absLat < 15 ? 3 : 6;
    monthlyTemp.push(baseTemp + variation * Math.sin(((m - (lat > 0 ? 1 : 7)) * Math.PI) / 6));
  }
  const monthlyWind = new Array(12).fill(2.5);
  return { monthlyGhi, monthlyTemp, monthlyWind };
}

function estimateOptimalTilt(lat) {
  return Math.round(Math.abs(lat));
}

function estimateOptimalAzimuth(lat) {
  return lat >= 0 ? 180 : 0;
}

module.exports = {
  getHourlySolarResource,
  estimateOptimalTilt,
  estimateOptimalAzimuth,
  roundToGrid,
};
