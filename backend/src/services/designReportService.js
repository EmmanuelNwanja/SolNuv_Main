/**
 * SolNuv Design Report PDF Service
 * Generates professional multi-page solar + BESS consulting reports
 * comparable to GreenWatt-style deliverables using PDFKit.
 */

const PDFDocument = require('pdfkit');
const supabase = require('../config/database');

// ─── Brand defaults ──────────────────────────────────────────
const BRAND = {
  primary: '#0D3B2E',
  secondary: '#F59E0B',
  accent: '#10B981',
  text: '#1E293B',
  muted: '#64748B',
  light: '#F1F5F9',
  white: '#FFFFFF',
};

function hex(c) {
  const h = (c || '').replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ─── Helpers ─────────────────────────────────────────────────

function addHeader(doc, text, opts = {}) {
  doc.moveDown(opts.topPad || 0.8);
  doc.fontSize(opts.size || 16).fillColor(hex(BRAND.primary)).text(text, { underline: false });
  doc.moveTo(doc.x, doc.y + 2).lineTo(doc.x + 480, doc.y + 2).strokeColor(hex(BRAND.accent)).lineWidth(1.5).stroke();
  doc.moveDown(0.4);
  doc.fillColor(hex(BRAND.text)).fontSize(10);
}

function addSubHeader(doc, text) {
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(hex(BRAND.primary)).text(text);
  doc.moveDown(0.2);
  doc.fillColor(hex(BRAND.text)).fontSize(10);
}

function addKV(doc, label, value, unit = '') {
  doc.fontSize(10).fillColor(hex(BRAND.muted)).text(`${label}: `, { continued: true });
  doc.fillColor(hex(BRAND.text)).text(`${value}${unit ? ' ' + unit : ''}`);
}

function addTableRow(doc, cols, widths, opts = {}) {
  const y = doc.y;
  const startX = doc.x;
  const isHeader = opts.header;

  if (isHeader) {
    doc.rect(startX - 2, y - 2, widths.reduce((a, b) => a + b, 0) + 4, 16).fill(hex(BRAND.primary));
    doc.fillColor(hex(BRAND.white));
  } else {
    doc.fillColor(hex(BRAND.text));
  }

  let x = startX;
  cols.forEach((col, i) => {
    doc.fontSize(isHeader ? 9 : 9).text(String(col), x, y, { width: widths[i], align: i === 0 ? 'left' : 'right' });
    x += widths[i];
  });

  doc.y = y + 16;
  doc.fillColor(hex(BRAND.text));
}

function addPageBreak(doc) {
  doc.addPage();
}

function fmt(n, d = 0) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return (Number(n) * 100).toFixed(1) + '%';
}

function fmtCurrency(n, currency = 'ZAR') {
  if (n === null || n === undefined) return '—';
  const symbols = { ZAR: 'R', NGN: '₦', USD: '$', EUR: '€', GBP: '£' };
  const sym = symbols[currency] || currency + ' ';
  return sym + fmt(n, 2);
}

// ─── Main Generator ──────────────────────────────────────────

/**
 * Generate a professional design report PDF.
 * @param {string} simulationResultId - UUID of the simulation_results row
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateDesignReportPdf(simulationResultId) {
  // ── Load all data ──
  const { data: result } = await supabase
    .from('simulation_results')
    .select('*')
    .eq('id', simulationResultId)
    .single();

  if (!result) throw new Error('Simulation result not found');

  const { data: design } = await supabase
    .from('project_designs')
    .select('*')
    .eq('id', result.project_design_id)
    .single();

  const { data: project } = await supabase
    .from('projects')
    .select('*, companies(name, branding_primary_color)')
    .eq('id', design?.project_id)
    .single();

  const { data: tariff } = design?.tariff_structure_id ? await supabase
    .from('tariff_structures')
    .select('*, tariff_rates(*), tariff_ancillary_charges(*)')
    .eq('id', design.tariff_structure_id)
    .single() : { data: null };

  const companyName = project?.companies?.name || 'SolNuv';
  const currency = tariff?.currency || 'ZAR';
  const monthly = result.monthly_summary || [];
  const cashflow = result.yearly_cashflow || [];
  const exec = result.executive_summary_text || '';

  // ── Create PDF ──
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 55, right: 55 },
    info: {
      Title: `Solar Design Report — ${project?.name || 'Project'}`,
      Author: 'SolNuv Platform',
      Subject: 'Solar + BESS Design & Financial Analysis',
    },
    bufferPages: true,
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));

  // ━━━━━━━━━━━━━━━ PAGE 1: COVER ━━━━━━━━━━━━━━━
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(hex(BRAND.primary));

  // Accent stripe
  doc.rect(0, 280, doc.page.width, 6).fill(hex(BRAND.accent));

  doc.fillColor(hex(BRAND.white));
  doc.fontSize(32).text('Solar + BESS', 55, 160, { align: 'left' });
  doc.fontSize(32).text('Design Report', 55, 200, { align: 'left' });

  doc.moveDown(4);
  doc.fontSize(14).text(project?.name || 'Project', 55, 320);
  doc.fontSize(11).fillColor(hex(BRAND.accent)).text(companyName, 55, 345);

  doc.fillColor(hex(BRAND.white)).fontSize(10);
  doc.text(`Location: ${project?.location || 'N/A'}`, 55, 400);
  doc.text(`Coordinates: ${design?.location_lat?.toFixed(4) || '—'}, ${design?.location_lon?.toFixed(4) || '—'}`, 55, 418);
  doc.text(`Report Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 55, 436);

  doc.fontSize(9).fillColor('#7FAAAA');
  doc.text('Generated by SolNuv — Africa\'s Solar Engineering Platform', 55, doc.page.height - 70);
  doc.text('www.solnuv.com', 55, doc.page.height - 56);

  // ━━━━━━━━━━━━━━━ PAGE 2: EXECUTIVE SUMMARY ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Executive Summary', { topPad: 0.2 });

  if (exec) {
    doc.fontSize(10).fillColor(hex(BRAND.text)).text(exec, { lineGap: 4, paragraphGap: 8 });
  }

  doc.moveDown(0.8);
  addSubHeader(doc, 'Key Metrics');

  const metrics = [
    ['PV System Size', fmt(result.pv_capacity_kwp) + ' kWp'],
    ['Annual Generation', fmt(result.annual_generation_kwh) + ' kWh'],
    ['Solar Fraction', fmtPct(result.solar_fraction)],
    ['Self-Consumption Ratio', fmtPct(result.self_consumption_ratio)],
    ['Battery Capacity', design?.bess_capacity_kwh ? fmt(design.bess_capacity_kwh) + ' kWh' : 'None'],
    ['Annual Savings', fmtCurrency(result.annual_savings, currency)],
    ['Simple Payback', result.simple_payback_years ? fmt(result.simple_payback_years, 1) + ' years' : '—'],
    ['NPV (25-yr)', fmtCurrency(result.npv_25yr, currency)],
    ['IRR', result.irr ? (result.irr * 100).toFixed(1) + '%' : '—'],
    ['LCOE', result.lcoe ? fmtCurrency(result.lcoe, currency) + '/kWh' : '—'],
  ];

  metrics.forEach(([k, v]) => addKV(doc, k, v));

  // ━━━━━━━━━━━━━━━ PAGE 3: SOLAR SYSTEM OVERVIEW ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Solar System Overview', { topPad: 0.2 });

  addSubHeader(doc, 'PV Array Configuration');
  addKV(doc, 'Module Technology', design?.panel_technology || 'Monocrystalline PERC');
  addKV(doc, 'System Capacity', fmt(result.pv_capacity_kwp) + ' kWp');
  addKV(doc, 'Array Tilt', (design?.tilt_angle || 0) + '°');
  addKV(doc, 'Array Azimuth', (design?.azimuth_angle || 0) + '°');
  addKV(doc, 'Annual Degradation', ((design?.annual_degradation_pct || 0.5)) + '%');
  addKV(doc, 'System Losses', ((design?.system_losses_pct || 14)) + '%');

  if (design?.bess_capacity_kwh > 0) {
    addSubHeader(doc, 'Battery Energy Storage');
    addKV(doc, 'Rated Capacity', fmt(design.bess_capacity_kwh) + ' kWh');
    addKV(doc, 'Usable Capacity', fmt(design.bess_capacity_kwh * (1 - (design.bess_min_soc || 0.1))) + ' kWh');
    addKV(doc, 'Power Rating', fmt(design.bess_power_kw) + ' kW');
    addKV(doc, 'Chemistry', design.battery_chemistry || 'LFP');
    addKV(doc, 'Dispatch Strategy', (design.bess_dispatch_strategy || 'self_consumption').replace(/_/g, ' '));
    addKV(doc, 'Annual Cycles', result.annual_bess_cycles ? fmt(result.annual_bess_cycles, 0) : '—');
  }

  addSubHeader(doc, 'Solar Resource Data');
  addKV(doc, 'Data Source', 'NASA POWER (Climatology)');
  addKV(doc, 'Peak Sun Hours (avg)', result.annual_generation_kwh && result.pv_capacity_kwp
    ? fmt(result.annual_generation_kwh / result.pv_capacity_kwp / 365, 1) + ' h/day'
    : '—');

  // ━━━━━━━━━━━━━━━ PAGE 4: TARIFF ANALYSIS ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Tariff Analysis', { topPad: 0.2 });

  if (tariff) {
    addKV(doc, 'Tariff Structure', tariff.tariff_name);
    addKV(doc, 'Utility', tariff.utility_name || '—');
    addKV(doc, 'Type', (tariff.tariff_type || 'flat').toUpperCase());
    addKV(doc, 'Currency', tariff.currency);
    doc.moveDown(0.5);

    if (tariff.tariff_rates?.length > 0) {
      addSubHeader(doc, 'Rate Schedule');
      const rateWidths = [120, 100, 100, 160];
      addTableRow(doc, ['Season', 'Period', 'Rate/kWh', 'Hours'], rateWidths, { header: true });
      tariff.tariff_rates.forEach(r => {
        const hours = (r.weekday_hours || []).length > 0
          ? `Weekday: ${(r.weekday_hours || []).join(',')}`
          : 'All hours';
        addTableRow(doc, [r.season_key, r.period_name, fmtCurrency(r.rate_per_kwh, currency), hours], rateWidths);
      });
    }

    if (tariff.tariff_ancillary_charges?.length > 0) {
      doc.moveDown(0.5);
      addSubHeader(doc, 'Ancillary Charges');
      tariff.tariff_ancillary_charges.forEach(c => {
        addKV(doc, c.charge_label, fmtCurrency(c.rate, currency) + ` (${c.charge_type.replace(/_/g, ' ')})`);
      });
    }
  }

  // Baseline vs with-solar cost summary
  doc.moveDown(0.5);
  addSubHeader(doc, 'Annual Cost Comparison');
  addKV(doc, 'Baseline Grid Cost', fmtCurrency(result.baseline_annual_cost, currency));
  addKV(doc, 'With-Solar Grid Cost', fmtCurrency(result.with_solar_annual_cost, currency));
  addKV(doc, 'Annual Savings', fmtCurrency(result.annual_savings, currency));
  addKV(doc, 'Savings Percentage',
    result.baseline_annual_cost > 0
      ? ((result.annual_savings / result.baseline_annual_cost) * 100).toFixed(1) + '%'
      : '—'
  );

  // ━━━━━━━━━━━━━━━ PAGE 5: ENERGY ANALYSIS ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Energy Demand & Generation', { topPad: 0.2 });

  if (monthly.length > 0) {
    addSubHeader(doc, 'Monthly Energy Summary');
    const mWidths = [50, 75, 75, 75, 75, 80];
    addTableRow(doc, ['Month', 'Load kWh', 'Gen kWh', 'Self-use kWh', 'Export kWh', 'Grid kWh'], mWidths, { header: true });
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthly.forEach((m, i) => {
      addTableRow(doc, [
        monthNames[i] || i + 1,
        fmt(m.load_kwh, 0),
        fmt(m.generation_kwh, 0),
        fmt(m.self_consumption_kwh, 0),
        fmt(m.export_kwh, 0),
        fmt(m.grid_import_kwh, 0),
      ], mWidths);
    });
  }

  // Totals
  doc.moveDown(0.5);
  addKV(doc, 'Total Load', fmt(result.annual_consumption_kwh) + ' kWh');
  addKV(doc, 'Total Generation', fmt(result.annual_generation_kwh) + ' kWh');
  addKV(doc, 'Self-Consumption', fmt(result.self_consumption_kwh) + ' kWh');
  addKV(doc, 'Grid Export', fmt(result.grid_export_kwh) + ' kWh');
  addKV(doc, 'Grid Import', fmt(result.grid_import_kwh) + ' kWh');

  // ━━━━━━━━━━━━━━━ PAGE 6: BESS PERFORMANCE ━━━━━━━━━━━━━━━
  if (design?.bess_capacity_kwh > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Battery Storage Performance', { topPad: 0.2 });

    addKV(doc, 'Annual Throughput', fmt(result.bess_annual_throughput_kwh) + ' kWh');
    addKV(doc, 'Annual Full Cycles', fmt(result.annual_bess_cycles, 0));
    addKV(doc, 'Peak Shaving Contribution', result.peak_shave_kw ? fmt(result.peak_shave_kw, 1) + ' kW' : '—');

    if (monthly.length > 0) {
      doc.moveDown(0.5);
      addSubHeader(doc, 'Monthly Battery Utilisation');
      const bWidths = [50, 90, 90, 90, 110];
      addTableRow(doc, ['Month', 'Charge kWh', 'Discharge kWh', 'Cycles', 'Avg SOC'], bWidths, { header: true });
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthly.forEach((m, i) => {
        addTableRow(doc, [
          monthNames[i] || i + 1,
          fmt(m.bess_charge_kwh, 0),
          fmt(m.bess_discharge_kwh, 0),
          fmt(m.bess_cycles, 1),
          m.bess_avg_soc ? fmtPct(m.bess_avg_soc) : '—',
        ], bWidths);
      });
    }
  }

  // ━━━━━━━━━━━━━━━ PAGE 7: FINANCIAL ANALYSIS ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Financial Analysis', { topPad: 0.2 });

  addSubHeader(doc, 'Investment Summary');
  addKV(doc, 'Total System Cost', fmtCurrency(design?.total_cost || result.total_system_cost, currency));
  addKV(doc, 'Year 1 Savings', fmtCurrency(result.annual_savings, currency));
  addKV(doc, 'Simple Payback', result.simple_payback_years ? fmt(result.simple_payback_years, 1) + ' years' : '> 25 years');
  addKV(doc, 'Discounted Payback', result.discounted_payback_years ? fmt(result.discounted_payback_years, 1) + ' years' : '> 25 years');
  addKV(doc, 'NPV (25 years)', fmtCurrency(result.npv_25yr, currency));
  addKV(doc, 'IRR', result.irr ? (result.irr * 100).toFixed(1) + '%' : '—');
  addKV(doc, 'LCOE', result.lcoe ? fmtCurrency(result.lcoe, currency) + '/kWh' : '—');

  if (cashflow.length > 0) {
    doc.moveDown(0.5);
    addSubHeader(doc, '25-Year Cashflow Projection');

    // Print first 5 years + year 10, 15, 20, 25
    const cfWidths = [40, 80, 80, 80, 80, 80];
    addTableRow(doc, ['Year', 'Savings', 'O&M', 'Net CF', 'Cumul. CF', 'Grid Cost'], cfWidths, { header: true });

    const showYears = [0, 1, 2, 3, 4, 9, 14, 19, 24];
    showYears.forEach(yi => {
      const cf = cashflow[yi];
      if (!cf) return;
      addTableRow(doc, [
        cf.year || yi + 1,
        fmtCurrency(cf.savings, currency),
        fmtCurrency(cf.om_cost, currency),
        fmtCurrency(cf.net_cashflow, currency),
        fmtCurrency(cf.cumulative_cashflow, currency),
        fmtCurrency(cf.grid_cost, currency),
      ], cfWidths);
    });
  }

  // ━━━━━━━━━━━━━━━ PAGE 8: ASSUMPTIONS & DISCLAIMERS ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Assumptions & Methodology', { topPad: 0.2 });

  const assumptions = [
    'Solar resource data sourced from NASA POWER climatological averages.',
    `PV generation modelled using isotropic transposition with ${design?.system_losses_pct || 14}% total system losses.`,
    `Panel degradation rate: ${design?.annual_degradation_pct || 0.5}% per year.`,
    `Discount rate: ${design?.discount_rate_pct || 10}% (nominal).`,
    `Tariff escalation: ${design?.tariff_escalation_pct || 8}% per year.`,
    `Analysis period: 25 years.`,
    design?.bess_capacity_kwh > 0 ? `Battery round-trip efficiency: ${design?.bess_round_trip_efficiency ? (design.bess_round_trip_efficiency * 100) : 90}%.` : null,
    'Financial projections are estimates and do not constitute financial advice.',
  ].filter(Boolean);

  assumptions.forEach(a => {
    doc.fontSize(10).fillColor(hex(BRAND.text)).text(`• ${a}`, { indent: 10, lineGap: 3 });
  });

  doc.moveDown(1.5);
  doc.fontSize(8).fillColor(hex(BRAND.muted));
  doc.text('DISCLAIMER: This report is generated by the SolNuv platform for preliminary design and feasibility assessment purposes. Actual system performance may vary based on local conditions, equipment specifications, installation quality, and other factors. A detailed engineering study by a qualified professional is recommended before final investment decisions.', {
    lineGap: 2,
    width: 480,
  });

  // ── Footer on all pages ──
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    // Skip footer on cover page
    if (i === 0) continue;
    doc.fontSize(7).fillColor(hex(BRAND.muted));
    doc.text(
      `SolNuv Design Report — ${project?.name || 'Project'} — Page ${i + 1} of ${pages.count}`,
      55,
      doc.page.height - 35,
      { width: 480, align: 'center' }
    );
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/**
 * Generate Excel workbook with all simulation data.
 */
async function generateDesignReportExcel(simulationResultId) {
  const ExcelJS = require('exceljs');

  const { data: result } = await supabase
    .from('simulation_results')
    .select('*')
    .eq('id', simulationResultId)
    .single();

  if (!result) throw new Error('Simulation result not found');

  const { data: design } = await supabase
    .from('project_designs')
    .select('*')
    .eq('id', result.project_design_id)
    .single();

  const { data: project } = await supabase
    .from('projects')
    .select('name, location')
    .eq('id', design?.project_id)
    .single();

  const currency = result.currency || 'ZAR';
  const monthly = result.monthly_summary || [];
  const cashflow = result.yearly_cashflow || [];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SolNuv Platform';
  wb.created = new Date();

  // ── Summary Sheet ──
  const ws1 = wb.addWorksheet('Summary');
  ws1.columns = [{ width: 30 }, { width: 25 }];

  const summaryRows = [
    ['Project', project?.name || ''],
    ['Location', project?.location || ''],
    ['Report Date', new Date().toLocaleDateString()],
    [''],
    ['PV Capacity (kWp)', result.pv_capacity_kwp],
    ['Annual Generation (kWh)', result.annual_generation_kwh],
    ['Solar Fraction', result.solar_fraction],
    ['Self-Consumption Ratio', result.self_consumption_ratio],
    ['BESS Capacity (kWh)', design?.bess_capacity_kwh || 0],
    [''],
    ['Baseline Annual Cost', result.baseline_annual_cost],
    ['With-Solar Annual Cost', result.with_solar_annual_cost],
    ['Annual Savings', result.annual_savings],
    ['Simple Payback (yrs)', result.simple_payback_years],
    ['NPV 25-yr', result.npv_25yr],
    ['IRR', result.irr],
    ['LCOE', result.lcoe],
  ];
  summaryRows.forEach(r => ws1.addRow(r));

  // Style header
  ws1.getRow(1).font = { bold: true, size: 13, color: { argb: '0D3B2E' } };

  // ── Monthly Sheet ──
  const ws2 = wb.addWorksheet('Monthly');
  ws2.addRow(['Month', 'Load kWh', 'Generation kWh', 'Self-Use kWh', 'Export kWh', 'Grid kWh', 'Savings ' + currency]);
  ws2.getRow(1).font = { bold: true };
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  monthly.forEach((m, i) => {
    ws2.addRow([monthNames[i], m.load_kwh, m.generation_kwh, m.self_consumption_kwh, m.export_kwh, m.grid_import_kwh, m.savings]);
  });

  // ── Cashflow Sheet ──
  const ws3 = wb.addWorksheet('Cashflow');
  ws3.addRow(['Year', 'Savings', 'O&M', 'Net CF', 'Cumulative CF', 'Grid Cost', 'Solar Gen kWh']);
  ws3.getRow(1).font = { bold: true };
  cashflow.forEach(cf => {
    ws3.addRow([cf.year, cf.savings, cf.om_cost, cf.net_cashflow, cf.cumulative_cashflow, cf.grid_cost, cf.generation_kwh]);
  });

  // ── Hourly Sheet (optional — can be very large) ──
  if (result.hourly_flows?.length > 0 && result.hourly_flows.length <= 8760) {
    const ws4 = wb.addWorksheet('Hourly');
    ws4.addRow(['Hour', 'Load kW', 'PV kW', 'Grid kW', 'BESS kW', 'SOC']);
    ws4.getRow(1).font = { bold: true };
    result.hourly_flows.forEach((h, i) => {
      ws4.addRow([i, h.load, h.pv, h.grid, h.bess, h.soc]);
    });
  }

  return wb.xlsx.writeBuffer();
}

module.exports = {
  generateDesignReportPdf,
  generateDesignReportExcel,
};
