'use strict';

/**
 * Deterministic 8760-hour weather stubs for golden simulation tests.
 *
 * We hard-code a simple bell-shape diurnal + monthly modulation so the
 * inputs never depend on NASA POWER, the cache, or any seeded RNG.
 * Any change to the engine that shifts expected values will fail the test.
 */

const HOURS_PER_YEAR = 8760;
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function buildDeterministicWeather({ peakGhi = 950, monthlyScale = null, tempMean = 27, tempSwing = 7 } = {}) {
  const hourlyGhi = new Array(HOURS_PER_YEAR);
  const hourlyTemp = new Array(HOURS_PER_YEAR);
  const hourlyWind = new Array(HOURS_PER_YEAR).fill(2);

  const scale = monthlyScale || [0.92, 0.98, 1.05, 1.08, 1.06, 0.95, 0.90, 0.92, 0.98, 1.04, 1.00, 0.92];

  let idx = 0;
  for (let month = 0; month < 12; month++) {
    const mScale = scale[month];
    for (let day = 0; day < DAYS_PER_MONTH[month]; day++) {
      for (let hour = 0; hour < 24; hour++) {
        // Bell shape centred on noon, zero outside 6am–6pm
        let ghi = 0;
        if (hour >= 6 && hour <= 18) {
          const frac = (hour - 6) / 12;
          ghi = peakGhi * mScale * Math.sin(frac * Math.PI);
        }
        hourlyGhi[idx] = Math.max(0, ghi);
        // Ambient temp: coldest ~5am, warmest ~14:00
        hourlyTemp[idx] = tempMean + tempSwing * Math.sin(((hour - 5) * Math.PI) / 12);
        idx++;
      }
    }
  }
  return { hourlyGhi, hourlyTemp, hourlyWind };
}

/** Build a constant hourly load profile in kW. */
function buildFlatLoad(averageKw) {
  return new Array(HOURS_PER_YEAR).fill(averageKw);
}

module.exports = {
  HOURS_PER_YEAR,
  buildDeterministicWeather,
  buildFlatLoad,
};
