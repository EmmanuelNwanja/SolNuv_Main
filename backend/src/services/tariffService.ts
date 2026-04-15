/**
 * SolNuv Tariff Service
 * Multi-country TOU tariff calculation engine.
 * Supports Eskom Megaflex/Miniflex, Nigerian MYTO DisCo bands, and custom tariffs.
 */

/**
 * Determine which season a month belongs to.
 * @param {Array} seasons - [{key, label, months: [1..12]}]
 * @param {number} month - 1-based month (1=Jan, 12=Dec)
 * @returns {string} season key
 */
function getSeasonForMonth(seasons, month) {
  for (const season of seasons) {
    if (season.months && season.months.includes(month)) {
      return season.key;
    }
  }
  return seasons[0]?.key || 'default';
}

/**
 * Get the TOU period for a given hour, day-of-week, and season.
 * @param {Array} rates - tariff_rates rows for this tariff
 * @param {string} seasonKey
 * @param {number} hour - 0-23
 * @param {number} dayOfWeek - 0=Sunday, 6=Saturday
 * @returns {{ period_name: string, rate_per_kwh: number }}
 */
function getTOUPeriod(rates, seasonKey, hour, dayOfWeek) {
  const seasonRates = rates.filter(r => r.season_key === seasonKey);
  let flatFallback = null;

  for (const rate of seasonRates) {
    let hoursArray;
    if (dayOfWeek === 0) {
      hoursArray = rate.sunday_hours || [];
    } else if (dayOfWeek === 6) {
      hoursArray = rate.saturday_hours || [];
    } else {
      hoursArray = rate.weekday_hours || [];
    }

    // Empty hours array means this rate applies to all hours (flat / all-day rate)
    if (hoursArray.length === 0) {
      flatFallback = { period_name: rate.period_name, rate_per_kwh: Number(rate.rate_per_kwh) };
      continue;
    }

    for (const range of hoursArray) {
      if (Array.isArray(range) && range.length === 2) {
        const [start, end] = range;
        if (hour >= start && hour < end) {
          return { period_name: rate.period_name, rate_per_kwh: Number(rate.rate_per_kwh) };
        }
      }
    }
  }

  // Use flat/all-day rate if no TOU period matched
  if (flatFallback) return flatFallback;

  // Last-resort default to off-peak
  const offPeak = seasonRates.find(r => r.period_name === 'off_peak');
  return {
    period_name: 'off_peak',
    rate_per_kwh: offPeak ? Number(offPeak.rate_per_kwh) : 0,
  };
}

/**
 * Build an 8760-hour mapping of TOU period + rate for a full year.
 * @param {object} tariffStructure - { seasons, ... }
 * @param {Array} rates - tariff_rates rows
 * @returns {Array<{ hour, month, dayOfWeek, seasonKey, period_name, rate_per_kwh }>}
 */
function buildHourlyTOUMap(tariffStructure, rates) {
  const seasons = tariffStructure.seasons || [];
  const hourlyMap = [];

  // Use a non-leap reference year (365 days = 8760 hours)
  // Start on Monday (2024-01-01 was a Monday)
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let hourIndex = 0;
  let dayOfYear = 0;

  for (let month = 1; month <= 12; month++) {
    const seasonKey = getSeasonForMonth(seasons, month);
    const daysInMonth = DAYS_PER_MONTH[month - 1];

    for (let day = 0; day < daysInMonth; day++) {
      const dayOfWeek = (dayOfYear + 1) % 7; // 0=Sun, 1=Mon, ... (Jan 1 = Mon = 1)
      for (let hour = 0; hour < 24; hour++) {
        const { period_name, rate_per_kwh } = getTOUPeriod(rates, seasonKey, hour, dayOfWeek);
        hourlyMap.push({
          hour: hourIndex,
          month,
          dayOfWeek,
          hourOfDay: hour,
          seasonKey,
          period_name,
          rate_per_kwh,
        });
        hourIndex++;
      }
      dayOfYear++;
    }
  }

  return hourlyMap;
}

/**
 * Calculate monthly electricity bill from hourly load profile and tariff.
 * @param {Array<number>} hourlyKw - 8760 hourly load values in kW
 * @param {object} tariffStructure - { seasons, ... }
 * @param {Array} rates - tariff_rates rows
 * @param {Array} ancillaryCharges - tariff_ancillary_charges rows
 * @param {object} opts - { intervalMinutes: 60, peakDemandKva }
 * @returns {{ monthly: Array<object>, annual: object, touBreakdown: object }}
 */
function calculateAnnualBill(hourlyKw, tariffStructure, rates, ancillaryCharges = [], opts: Record<string, any> = {}) {
  const intervalHours = (opts.intervalMinutes || 60) / 60;
  const touMap = buildHourlyTOUMap(tariffStructure, rates);

  // Monthly breakdown
  const monthly = [];
  for (let m = 1; m <= 12; m++) {
    monthly.push({
      month: m,
      peak_kwh: 0, standard_kwh: 0, off_peak_kwh: 0, total_kwh: 0,
      peak_cost: 0, standard_cost: 0, off_peak_cost: 0, energy_cost: 0,
      peak_demand_kw: 0,
      ancillary_cost: 0,
      total_cost: 0,
    });
  }

  // TOU totals
  const touBreakdown = {
    peak: { kwh: 0, cost: 0 },
    standard: { kwh: 0, cost: 0 },
    off_peak: { kwh: 0, cost: 0 },
  };

  // Process each hour
  for (let h = 0; h < Math.min(hourlyKw.length, 8760); h++) {
    const kw = Number(hourlyKw[h]) || 0;
    const kwh = kw * intervalHours;
    const info = touMap[h];
    if (!info) continue;

    const m = monthly[info.month - 1];
    const cost = kwh * info.rate_per_kwh;

    m.total_kwh += kwh;

    const bucket = info.period_name === 'peak' ? 'peak'
      : info.period_name === 'standard' ? 'standard'
      : 'off_peak';

    m[`${bucket}_kwh`] += kwh;
    m[`${bucket}_cost`] += cost;
    m.energy_cost += cost;

    // Track peak demand
    if (kw > m.peak_demand_kw) m.peak_demand_kw = kw;

    // TOU totals
    touBreakdown[bucket].kwh += kwh;
    touBreakdown[bucket].cost += cost;
  }

  // Apply ancillary charges per month
  for (const m of monthly) {
    let ancillaryCost = 0;
    for (const charge of ancillaryCharges) {
      const rate = Number(charge.rate) || 0;
      switch (charge.charge_type) {
        case 'daily':
          ancillaryCost += rate * getDaysInMonth(m.month);
          break;
        case 'peak_demand':
          ancillaryCost += rate * m.peak_demand_kw;
          break;
        case 'network_capacity':
        case 'gen_capacity':
        case 'netw_demand':
          ancillaryCost += rate * (opts.peakDemandKva || m.peak_demand_kw);
          break;
        case 'legacy':
        case 'ancillary':
          ancillaryCost += rate * m.total_kwh;
          break;
        default:
          ancillaryCost += rate;
      }
    }
    m.ancillary_cost = Math.round(ancillaryCost * 100) / 100;
    m.total_cost = Math.round((m.energy_cost + m.ancillary_cost) * 100) / 100;

    // Round energy values
    m.peak_kwh = Math.round(m.peak_kwh * 100) / 100;
    m.standard_kwh = Math.round(m.standard_kwh * 100) / 100;
    m.off_peak_kwh = Math.round(m.off_peak_kwh * 100) / 100;
    m.total_kwh = Math.round(m.total_kwh * 100) / 100;
    m.peak_cost = Math.round(m.peak_cost * 100) / 100;
    m.standard_cost = Math.round(m.standard_cost * 100) / 100;
    m.off_peak_cost = Math.round(m.off_peak_cost * 100) / 100;
    m.energy_cost = Math.round(m.energy_cost * 100) / 100;
    m.peak_demand_kw = Math.round(m.peak_demand_kw * 100) / 100;
  }

  // Annual totals
  const annual = {
    total_kwh: monthly.reduce((s, m) => s + m.total_kwh, 0),
    peak_kwh: monthly.reduce((s, m) => s + m.peak_kwh, 0),
    standard_kwh: monthly.reduce((s, m) => s + m.standard_kwh, 0),
    off_peak_kwh: monthly.reduce((s, m) => s + m.off_peak_kwh, 0),
    energy_cost: monthly.reduce((s, m) => s + m.energy_cost, 0),
    ancillary_cost: monthly.reduce((s, m) => s + m.ancillary_cost, 0),
    total_cost: monthly.reduce((s, m) => s + m.total_cost, 0),
    peak_demand_kw: Math.max(...monthly.map(m => m.peak_demand_kw)),
  };

  // Round TOU breakdown
  for (const key of ['peak', 'standard', 'off_peak']) {
    touBreakdown[key].kwh = Math.round(touBreakdown[key].kwh * 100) / 100;
    touBreakdown[key].cost = Math.round(touBreakdown[key].cost * 100) / 100;
  }

  return { monthly, annual, touBreakdown };
}

function getDaysInMonth(month) {
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 30;
}

/**
 * Get TOU schedule as a simple hour→period mapping for visualization.
 * @returns {{ weekday: string[], saturday: string[], sunday: string[] }} per season
 */
function getTOUScheduleForDisplay(tariffStructure, rates) {
  const seasons = tariffStructure.seasons || [];
  const result = {};

  for (const season of seasons) {
    const schedule = { weekday: [], saturday: [], sunday: [] };
    for (let h = 0; h < 24; h++) {
      schedule.weekday.push(getTOUPeriod(rates, season.key, h, 1).period_name);
      schedule.saturday.push(getTOUPeriod(rates, season.key, h, 6).period_name);
      schedule.sunday.push(getTOUPeriod(rates, season.key, h, 0).period_name);
    }
    result[season.key] = schedule;
  }

  return result;
}

module.exports = {
  getSeasonForMonth,
  getTOUPeriod,
  buildHourlyTOUMap,
  calculateAnnualBill,
  getTOUScheduleForDisplay,
};
