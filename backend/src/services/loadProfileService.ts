/**
 * SolNuv Load Profile Service
 * Parses CSV/Excel uploads, generates synthetic profiles, and calculates statistics.
 */

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const HOURS_PER_YEAR = 8760;

// ─── LOAD SHAPE TEMPLATES ────────────────────────────────────────────────────
// Normalized hourly shapes (0-23) per business type. Values are relative load
// as fraction of peak. Weekday and weekend shapes per type.

const LOAD_SHAPES = {
  office: {
    weekday: [0.15, 0.12, 0.12, 0.12, 0.12, 0.15, 0.25, 0.55, 0.80, 0.95, 1.00, 0.98,
              0.85, 0.95, 1.00, 0.95, 0.85, 0.65, 0.40, 0.25, 0.20, 0.18, 0.15, 0.15],
    weekend: [0.12, 0.10, 0.10, 0.10, 0.10, 0.10, 0.12, 0.15, 0.18, 0.20, 0.20, 0.20,
              0.18, 0.18, 0.18, 0.15, 0.15, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
  },
  factory: {
    weekday: [0.40, 0.40, 0.40, 0.40, 0.40, 0.45, 0.70, 0.90, 0.95, 1.00, 1.00, 0.95,
              0.85, 0.95, 1.00, 1.00, 0.95, 0.90, 0.80, 0.65, 0.50, 0.45, 0.42, 0.40],
    weekend: [0.30, 0.28, 0.28, 0.28, 0.28, 0.28, 0.30, 0.35, 0.40, 0.45, 0.45, 0.45,
              0.40, 0.40, 0.40, 0.35, 0.35, 0.32, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30],
  },
  retail: {
    weekday: [0.10, 0.08, 0.08, 0.08, 0.08, 0.10, 0.15, 0.30, 0.65, 0.85, 0.95, 1.00,
              0.95, 0.95, 1.00, 1.00, 0.95, 0.90, 0.85, 0.75, 0.55, 0.30, 0.15, 0.10],
    weekend: [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.10, 0.20, 0.55, 0.80, 0.95, 1.00,
              0.95, 0.95, 0.95, 0.95, 0.90, 0.85, 0.75, 0.60, 0.40, 0.20, 0.10, 0.08],
  },
  warehouse: {
    weekday: [0.20, 0.18, 0.18, 0.18, 0.18, 0.20, 0.35, 0.65, 0.85, 0.95, 1.00, 0.95,
              0.85, 0.90, 0.95, 0.90, 0.80, 0.60, 0.35, 0.25, 0.22, 0.20, 0.20, 0.20],
    weekend: [0.15, 0.12, 0.12, 0.12, 0.12, 0.12, 0.15, 0.18, 0.20, 0.22, 0.22, 0.22,
              0.20, 0.20, 0.20, 0.18, 0.18, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
  },
  residential: {
    weekday: [0.20, 0.15, 0.12, 0.12, 0.12, 0.20, 0.50, 0.70, 0.55, 0.35, 0.30, 0.30,
              0.35, 0.30, 0.30, 0.35, 0.45, 0.65, 0.85, 1.00, 0.95, 0.80, 0.55, 0.30],
    weekend: [0.25, 0.20, 0.15, 0.12, 0.12, 0.15, 0.30, 0.55, 0.70, 0.75, 0.70, 0.65,
              0.60, 0.55, 0.55, 0.60, 0.65, 0.75, 0.90, 1.00, 0.95, 0.80, 0.55, 0.35],
  },
  hospital: {
    weekday: [0.65, 0.60, 0.58, 0.58, 0.60, 0.65, 0.75, 0.88, 0.95, 1.00, 1.00, 0.98,
              0.95, 0.95, 1.00, 0.98, 0.95, 0.90, 0.85, 0.80, 0.75, 0.72, 0.68, 0.65],
    weekend: [0.62, 0.58, 0.55, 0.55, 0.58, 0.62, 0.70, 0.82, 0.90, 0.95, 0.95, 0.92,
              0.90, 0.90, 0.92, 0.90, 0.88, 0.85, 0.80, 0.75, 0.72, 0.68, 0.65, 0.62],
  },
  school: {
    weekday: [0.08, 0.08, 0.08, 0.08, 0.08, 0.10, 0.20, 0.55, 0.80, 0.95, 1.00, 0.95,
              0.75, 0.90, 1.00, 0.85, 0.50, 0.25, 0.12, 0.10, 0.08, 0.08, 0.08, 0.08],
    weekend: [0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.08, 0.10, 0.12, 0.12, 0.12, 0.12,
              0.10, 0.10, 0.10, 0.08, 0.08, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06],
  },
};

// Seasonal multiplier per month for African climates (cooling load increase in hot months)
const SEASONAL_MULTIPLIER = {
  NG: [0.95, 1.00, 1.10, 1.15, 1.10, 1.00, 0.95, 0.90, 0.90, 0.95, 0.95, 0.95],
  ZA: [1.05, 1.00, 0.95, 0.90, 0.95, 1.05, 1.10, 1.05, 0.95, 0.90, 0.95, 1.00],
  default: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
};

/**
 * Parse a CSV string of hourly load data into an array of kW values.
 * Supports: single-column kW, or timestamp+kW with header detection.
 * @param {string} csvText
 * @returns {{ hourlyKw: number[], interval: number, errors: string[] }}
 */
function parseCSV(csvText) {
  const errors = [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 24) {
    return { hourlyKw: [], interval: 60, errors: ['CSV must contain at least 24 rows of data'] };
  }

  // Detect header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = /[a-z]/.test(firstLine) && !/^\d/.test(firstLine.trim());
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Detect delimiter
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';

  const values = [];
  for (let i = 0; i < dataLines.length; i++) {
    const parts = dataLines[i].split(delimiter);
    // Take last numeric column as kW value
    let kwValue = null;
    for (let j = parts.length - 1; j >= 0; j--) {
      const num = parseFloat(parts[j].trim().replace(/[^\d.-]/g, ''));
      if (!isNaN(num)) {
        kwValue = Math.max(0, num);
        break;
      }
    }
    if (kwValue !== null) {
      values.push(kwValue);
    } else if (dataLines[i].trim()) {
      errors.push(`Row ${i + 1}: Could not parse numeric value`);
    }
  }

  // Detect interval: 8760 = hourly, 17520 = half-hourly, 35040 = 15-min
  let interval = 60;
  let hourlyKw = values;
  if (values.length >= 17000 && values.length <= 18000) {
    interval = 30;
    // Aggregate to hourly: average each pair
    hourlyKw = [];
    for (let i = 0; i < values.length - 1; i += 2) {
      hourlyKw.push((values[i] + values[i + 1]) / 2);
    }
  } else if (values.length >= 34000) {
    interval = 15;
    hourlyKw = [];
    for (let i = 0; i < values.length - 3; i += 4) {
      hourlyKw.push((values[i] + values[i + 1] + values[i + 2] + values[i + 3]) / 4);
    }
  }

  // Pad or trim to 8760
  if (hourlyKw.length > HOURS_PER_YEAR) {
    hourlyKw = hourlyKw.slice(0, HOURS_PER_YEAR);
  } else if (hourlyKw.length < HOURS_PER_YEAR && hourlyKw.length > 0) {
    // Repeat pattern to fill year
    const pattern = [...hourlyKw];
    while (hourlyKw.length < HOURS_PER_YEAR) {
      hourlyKw.push(pattern[hourlyKw.length % pattern.length]);
    }
    errors.push(`Data padded from ${pattern.length} to ${HOURS_PER_YEAR} hours by repeating pattern`);
  }

  return { hourlyKw, interval, errors };
}

/**
 * Parse an Excel buffer into hourly kW values.
 * Expects the first sheet, first numeric column as kW data.
 * @param {Buffer} buffer
 * @returns {Promise<{ hourlyKw: number[], interval: number, errors: string[] }>}
 */
async function parseExcel(buffer) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { hourlyKw: [], interval: 60, errors: ['No worksheet found in Excel file'] };

  const values = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Skip header
    if (rowNumber === 1) {
      const firstCell = String(row.getCell(1).value || '').toLowerCase();
      if (/[a-z]/.test(firstCell) && !/^\d/.test(firstCell)) return;
    }

    // Find last numeric cell
    for (let col = row.cellCount; col >= 1; col--) {
      const val = row.getCell(col).value;
      const num = typeof val === 'number' ? val : parseFloat(String(val || '').replace(/[^\d.-]/g, ''));
      if (!isNaN(num)) {
        values.push(Math.max(0, num));
        break;
      }
    }
  });

  // Same interval detection and padding as CSV
  return normalizeToHourly(values);
}

function normalizeToHourly(values) {
  const errors = [];
  let interval = 60;
  let hourlyKw = values;

  if (values.length >= 17000 && values.length <= 18000) {
    interval = 30;
    hourlyKw = [];
    for (let i = 0; i < values.length - 1; i += 2) {
      hourlyKw.push((values[i] + values[i + 1]) / 2);
    }
  } else if (values.length >= 34000) {
    interval = 15;
    hourlyKw = [];
    for (let i = 0; i < values.length - 3; i += 4) {
      hourlyKw.push((values[i] + values[i + 1] + values[i + 2] + values[i + 3]) / 4);
    }
  }

  if (hourlyKw.length > HOURS_PER_YEAR) {
    hourlyKw = hourlyKw.slice(0, HOURS_PER_YEAR);
  } else if (hourlyKw.length < HOURS_PER_YEAR && hourlyKw.length > 0) {
    const pattern = [...hourlyKw];
    while (hourlyKw.length < HOURS_PER_YEAR) {
      hourlyKw.push(pattern[hourlyKw.length % pattern.length]);
    }
    errors.push(`Data padded from ${pattern.length} to ${HOURS_PER_YEAR} hours by repeating pattern`);
  }

  return { hourlyKw, interval, errors };
}

/**
 * Distribute 12 monthly kWh totals into an 8760-hour profile using load shape templates.
 * @param {number[]} monthlyKwh - 12 monthly consumption totals (kWh)
 * @param {number} peakKw - observed or estimated peak demand (kW)
 * @param {string} businessType - key in LOAD_SHAPES
 * @returns {number[]} 8760 hourly kW values
 */
function distributeMonthlyToHourly(monthlyKwh, peakKw, businessType = 'office') {
  const shape = LOAD_SHAPES[businessType] || LOAD_SHAPES.office;
  const hourlyKw = [];
  let dayOfYear = 0;

  for (let month = 0; month < 12; month++) {
    const daysInMonth = DAYS_PER_MONTH[month];
    const monthKwh = Number(monthlyKwh[month]) || 0;

    // Calculate the shape-weighted total hours for this month to derive scaling
    let shapeSum = 0;
    for (let day = 0; day < daysInMonth; day++) {
      const dayOfWeek = (dayOfYear + 1) % 7; // Jan 1 = Monday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayShape = isWeekend ? shape.weekend : shape.weekday;
      shapeSum += dayShape.reduce((s, v) => s + v, 0);
      dayOfYear++;
    }

    // Scale factor: monthKwh / shapeSum gives kW per unit of shape
    const scaleFactor = shapeSum > 0 ? monthKwh / shapeSum : 0;

    // Reset day counter for this month to generate actual values
    dayOfYear -= daysInMonth;
    for (let day = 0; day < daysInMonth; day++) {
      const dayOfWeek = (dayOfYear + 1) % 7;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayShape = isWeekend ? shape.weekend : shape.weekday;

      for (let h = 0; h < 24; h++) {
        hourlyKw.push(dayShape[h] * scaleFactor);
      }
      dayOfYear++;
    }
  }

  // Scale to match peak demand if provided
  if (peakKw > 0) {
    const currentPeak = Math.max(...hourlyKw);
    if (currentPeak > 0) {
      const peakScale = peakKw / currentPeak;
      for (let i = 0; i < hourlyKw.length; i++) {
        hourlyKw[i] *= peakScale;
      }
    }
  }

  return hourlyKw.slice(0, HOURS_PER_YEAR);
}

/**
 * Generate a synthetic load profile based on business type and parameters.
 * @param {object} params
 * @returns {number[]} 8760 hourly kW values
 */
function generateSyntheticProfile({
  businessType = 'office',
  annualKwh = 100000,
  peakKw = 0,
  country = 'NG',
}) {
  const shape = LOAD_SHAPES[businessType] || LOAD_SHAPES.office;
  const seasonal = SEASONAL_MULTIPLIER[country] || SEASONAL_MULTIPLIER.default;

  // First pass: generate raw shape
  const hourlyKw = [];
  let dayOfYear = 0;

  for (let month = 0; month < 12; month++) {
    const daysInMonth = DAYS_PER_MONTH[month];
    const seasonalMult = seasonal[month];

    for (let day = 0; day < daysInMonth; day++) {
      const dayOfWeek = (dayOfYear + 1) % 7;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayShape = isWeekend ? shape.weekend : shape.weekday;

      for (let h = 0; h < 24; h++) {
        // Add ±8% random variation for realism
        const noise = 1 + (pseudoRandom(dayOfYear * 24 + h) - 0.5) * 0.16;
        hourlyKw.push(dayShape[h] * seasonalMult * noise);
      }
      dayOfYear++;
    }
  }

  // Scale to match annual kWh (primary constraint)
  const rawTotal = hourlyKw.reduce((s, v) => s + v, 0); // kW × 1hr = kWh
  if (rawTotal > 0) {
    const scale = annualKwh / rawTotal;
    for (let i = 0; i < hourlyKw.length; i++) {
      hourlyKw[i] *= scale;
    }
  }

  // If peakKw is specified, shape the profile to match BOTH annual kWh and target peak.
  // Uses exponent shaping: normalized^alpha adjusts peakiness while preserving shape.
  // If peak > natural: makes profile spikier (alpha > 1).
  // If peak < natural: flattens profile and clips (alpha < 1 + clip).
  if (peakKw > 0) {
    const currentPeak = Math.max(...hourlyKw);
    const tolerance = 0.02; // 2% tolerance

    if (Math.abs(currentPeak - peakKw) / Math.max(currentPeak, peakKw) > tolerance) {
      // Normalize profile to 0..1 range (max = 1.0)
      const normalized = hourlyKw.map(v => v / currentPeak);
      const MIN_ALPHA = 0.05;
      const MAX_ALPHA = 20.0;

      // Guardrail: if requested peak is physically infeasible for the annual energy,
      // clamp to the maximum peak achievable by this shape family instead of exploding
      // annual energy far above user input.
      const minShapeSum = normalized.reduce((s, v) => s + Math.pow(v, MAX_ALPHA), 0);
      const maxFeasiblePeak = minShapeSum > 0 ? annualKwh / minShapeSum : peakKw;
      const effectivePeakKw = peakKw > maxFeasiblePeak ? maxFeasiblePeak : peakKw;

      // Binary search for exponent alpha.
      // shaped[h] = normalized[h]^alpha, then scaled so max = peakKw.
      // Annual total = peakKw * sum(normalized^alpha).
      // We need peakKw * sum(normalized^alpha) = annualKwh.
      // Target sum = annualKwh / peakKw.
      const targetSum = annualKwh / effectivePeakKw;

      let lo = MIN_ALPHA, hi = MAX_ALPHA;
      let alpha = 1.0;

      for (let iter = 0; iter < 60; iter++) {
        alpha = (lo + hi) / 2;
        let shapedSum = 0;
        for (let i = 0; i < normalized.length; i++) {
          shapedSum += Math.pow(normalized[i], alpha);
        }
        if (shapedSum > targetSum) {
          lo = alpha; // need more peaky (higher alpha reduces sum)
        } else {
          hi = alpha; // need flatter (lower alpha increases sum)
        }
        if (Math.abs(shapedSum - targetSum) / targetSum < 0.0001) break;
      }

      // Apply shaping and scale so peak = peakKw
      for (let i = 0; i < hourlyKw.length; i++) {
        hourlyKw[i] = Math.pow(normalized[i], alpha) * effectivePeakKw;
      }

      // If target peak < natural peak, clip any residual > peakKw and redistribute
      const newPeak = Math.max(...hourlyKw);
      if (newPeak > effectivePeakKw * 1.01) {
        let clipped = 0;
        for (let i = 0; i < hourlyKw.length; i++) {
          if (hourlyKw[i] > effectivePeakKw) {
            clipped += hourlyKw[i] - effectivePeakKw;
            hourlyKw[i] = effectivePeakKw;
          }
        }
        if (clipped > 0) {
          const belowSum = hourlyKw.filter(v => v < effectivePeakKw).reduce((s, v) => s + v, 0);
          if (belowSum > 0) {
            const factor = 1 + clipped / belowSum;
            for (let i = 0; i < hourlyKw.length; i++) {
              if (hourlyKw[i] < effectivePeakKw) hourlyKw[i] = Math.min(hourlyKw[i] * factor, effectivePeakKw);
            }
          }
        }
      }
    }
  }

  return hourlyKw.slice(0, HOURS_PER_YEAR);
}

/**
 * Deterministic pseudo-random number (0-1) for reproducible noise.
 */
function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Calculate summary statistics from an hourly kW profile.
 * @param {number[]} hourlyKw
 * @returns {object}
 */
function calculateProfileStats(hourlyKw) {
  if (!hourlyKw || hourlyKw.length === 0) {
    return { annualKwh: 0, peakKw: 0, averageKw: 0, loadFactor: 0, monthlyKwh: new Array(12).fill(0) };
  }

  const annualKwh = hourlyKw.reduce((s, v) => s + (Number(v) || 0), 0);
  const peakKw = Math.max(...hourlyKw.map(v => Number(v) || 0));
  const averageKw = annualKwh / hourlyKw.length;
  const loadFactor = peakKw > 0 ? averageKw / peakKw : 0;

  // Monthly breakdown
  const monthlyKwh = [];
  let idx = 0;
  for (let m = 0; m < 12; m++) {
    const hoursInMonth = DAYS_PER_MONTH[m] * 24;
    let monthTotal = 0;
    for (let h = 0; h < hoursInMonth && idx < hourlyKw.length; h++, idx++) {
      monthTotal += Number(hourlyKw[idx]) || 0;
    }
    monthlyKwh.push(Math.round(monthTotal * 100) / 100);
  }

  return {
    annualKwh: Math.round(annualKwh * 100) / 100,
    peakKw: Math.round(peakKw * 100) / 100,
    averageKw: Math.round(averageKw * 100) / 100,
    avgDailyKwh: Math.round((annualKwh / 365) * 100) / 100,
    loadFactor: Math.round(loadFactor * 10000) / 10000,
    monthlyKwh,
  };
}

module.exports = {
  LOAD_SHAPES,
  SEASONAL_MULTIPLIER,
  parseCSV,
  parseExcel,
  distributeMonthlyToHourly,
  generateSyntheticProfile,
  calculateProfileStats,
};
