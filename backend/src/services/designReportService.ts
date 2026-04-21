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

function addHeader(doc, text, opts: Record<string, any> = {}) {
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

function addTableRow(doc, cols, widths, opts: Record<string, any> = {}) {
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
 * Generate a professional design report PDF (enhanced version).
 * @param {string} simulationResultId - UUID of the simulation_results row
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateDesignReportPdf(simulationResultId) {
  const { data: result, error: resultError } = await supabase
    .from('simulation_results')
    .select('*')
    .eq('id', simulationResultId)
    .single();

  if (resultError || !result) {
    throw new Error('Simulation result not found: ' + (resultError?.message || 'Unknown error'));
  }

  const { data: design } = await supabase
    .from('project_designs')
    .select('*')
    .eq('id', result.project_design_id)
    .single();

  const projectId = design?.project_id;
  let projectData = null;
  let tariffData = null;
  let equipmentData = null;

  if (projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('*, companies(name, branding_primary_color)')
      .eq('id', projectId)
      .single();
    projectData = project;

    const { data: equipment } = await supabase
      .from('equipment')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_installed', true)
      .limit(20);
    equipmentData = equipment;
  }

  if (design?.tariff_structure_id) {
    const { data: tariff } = await supabase
      .from('tariff_structures')
      .select('*, tariff_rates(*)')
      .eq('id', design.tariff_structure_id)
      .single();
    tariffData = tariff;
  }

  const companyName = projectData?.companies?.name || 'SolNuv';
  const currency = tariffData?.currency || 'NGN';
  const monthly = result.monthly_summary || [];
  const cashflow = result.yearly_cashflow || [];
  const energyComp = result.energy_comparison 
    ? (typeof result.energy_comparison === 'string' ? JSON.parse(result.energy_comparison) : result.energy_comparison) 
    : {};
  const exec = result.executive_summary_text || '';
  const aiFeedback = result.ai_feedback_text || '';

  const panels = equipmentData?.filter(e => e.equipment_type === 'panel') || [];
  const batteries = equipmentData?.filter(e => e.equipment_type === 'battery') || [];

  const co2Factor = 0.5;
  const annualCO2 = (result.annual_solar_gen_kwh || 0) * co2Factor;
  const treesOffset = annualCO2 * 0.02;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Solar Design Report — ${projectData?.name || 'Project'}`,
      Author: 'SolNuv Platform',
      Subject: 'Solar + BESS Design & Financial Analysis',
    },
    bufferPages: true,
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));

  const pageWidth = doc.page.width - 100;

  // ━━━━━━━━━━━━━━━ COVER PAGE ━━━━━━━━━━━━━━━
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(hex(BRAND.primary));
  doc.rect(0, 260, doc.page.width, 8).fill(hex(BRAND.accent));

  doc.fillColor(hex(BRAND.white));
  doc.fontSize(14).fillColor(hex(BRAND.accent)).text('SOLNUV', 50, 80);
  doc.fontSize(32).text('Solar Design Report', 50, 100);
  doc.fontSize(14).fillColor(hex(BRAND.white)).text(companyName, 50, 200);

  doc.fontSize(18).text(projectData?.name || 'Project', 50, 290);
  doc.fontSize(11).fillColor(hex(BRAND.accent)).text(`${projectData?.location || ''}${projectData?.state ? ', ' + projectData.state : ''}`, 50, 315);

  doc.fillColor(hex(BRAND.white)).fontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 50, 380);

  doc.fontSize(8).fillColor('#7FAAAA');
  doc.text("Generated by SolNuv — Africa's Solar Engineering Platform", 50, doc.page.height - 60);
  doc.text('www.solnuv.com', 50, doc.page.height - 48);

  // ━━━━━━━━━━━━━━━ EXECUTIVE SUMMARY ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Executive Summary', { topPad: 0.2 });

  if (exec) {
    doc.fontSize(10).fillColor(hex(BRAND.text)).text(exec, { lineGap: 4 });
  }

  doc.moveDown(0.8);
  addSubHeader(doc, 'Key Metrics');

  const metrics = [
    ['PV Capacity', fmt(design?.pv_capacity_kwp, 1) + ' kWp'],
    ['Annual Generation', fmt(result.annual_solar_gen_kwh) + ' kWh'],
    ['Year 1 Savings', fmtCurrency(result.year1_savings, currency)],
    ['Simple Payback', result.simple_payback_months ? fmt(result.simple_payback_months / 12, 1) + ' years' : '—'],
    ['Solar Fraction', result.utilisation_pct != null ? fmt(result.utilisation_pct, 1) + '%' : '—'],
    ['Self-Consumption', result.self_consumption_pct != null ? fmt(result.self_consumption_pct, 1) + '%' : '—'],
    ['NPV', fmtCurrency(result.npv_25yr, currency)],
    ['IRR', result.irr_pct != null ? fmt(result.irr_pct, 1) + '%' : '—'],
    ['LCOE', result.lcoe_normal != null ? fmtCurrency(result.lcoe_normal, currency) + '/kWh' : '—'],
  ];

  metrics.forEach(([k, v]) => addKV(doc, k, v));

  // ━━━━━━━━━━━━━━━ PV SYSTEM CONFIGURATION ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'PV System Configuration', { topPad: 0.2 });

  const pvConfig = [
    ['Technology', design?.pv_technology || 'Monocrystalline'],
    ['Array Tilt', (design?.pv_tilt_deg || 0) + '°'],
    ['Array Azimuth', (design?.pv_azimuth_deg || 0) + '°'],
    ['System Losses', (design?.pv_system_losses_pct || 14) + '%'],
    ['Annual Degradation', (design?.pv_degradation_annual_pct || 0.5) + '%'],
    ['Analysis Period', (design?.analysis_period_years || 25) + ' years'],
    ['Discount Rate', (design?.discount_rate_pct || 10) + '%'],
    ['Tariff Escalation', (design?.tariff_escalation_pct || 8) + '%/year'],
  ];

  pvConfig.forEach(([k, v]) => addKV(doc, k, v));

  if (panels.length > 0) {
    doc.moveDown(0.5);
    addSubHeader(doc, 'Installed Panels');
    panels.forEach(p => {
      addKV(doc, p.brand || p.manufacturer || 'Generic', `${p.quantity || 1} × ${p.rated_power_w ? (p.rated_power_w / 1000).toFixed(1) + ' kW' : '—'}`);
    });
  }

  // ━━━━━━━━━━━━━━━ BATTERY SYSTEM ━━━━━━━━━━━━━━━
  if (design?.bess_capacity_kwh > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Battery Energy Storage System', { topPad: 0.2 });

    const bessConfig = [
      ['Rated Capacity', fmt(design.bess_capacity_kwh) + ' kWh'],
      ['Power Rating', fmt(design.bess_power_kw) + ' kW'],
      ['Chemistry', (design.bess_chemistry || 'lifepo4').toUpperCase()],
      ['Depth of Discharge', (design.bess_dod_pct || 80) + '%'],
      ['Round-Trip Efficiency', ((design.bess_round_trip_efficiency || 0.9) * 100).toFixed(0) + '%'],
      ['Dispatch Strategy', (design.bess_dispatch_strategy || 'self_consumption').replace(/_/g, ' ')],
      ['Annual Throughput', fmt(result.battery_discharged_kwh) + ' kWh'],
      ['Annual Cycles', result.battery_cycles_annual != null ? fmt(result.battery_cycles_annual, 0) : '—'],
    ];

    bessConfig.forEach(([k, v]) => addKV(doc, k, v));

    if (batteries.length > 0) {
      doc.moveDown(0.5);
      addSubHeader(doc, 'Installed Batteries');
      batteries.forEach(b => {
        addKV(doc, b.brand || b.manufacturer || 'Generic', `${b.quantity || 1} × ${b.rated_capacity_kwh || '—'} kWh`);
      });
    }
  }

  // ━━━━━━━━━━━━━━━ GRID TARIFF PLAN ━━━━━━━━━━━━━━━
  if (tariffData) {
    addPageBreak(doc);
    addHeader(doc, 'Grid Tariff Plan', { topPad: 0.2 });

    addKV(doc, 'Tariff Name', tariffData.tariff_name || '—');
    addKV(doc, 'Utility', tariffData.utility_name || '—');
    addKV(doc, 'Currency', tariffData.currency || 'NGN');
    addKV(doc, 'Grid Topology', (design?.grid_topology || 'grid_tied').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    if (tariffData.tariff_rates?.length > 0) {
      doc.moveDown(0.5);
      addSubHeader(doc, 'Rate Schedule');
      const rateWidths = [150, 150, 180];
      addTableRow(doc, ['Season', 'Period', 'Rate/kWh'], rateWidths, { header: true });
      tariffData.tariff_rates.forEach(r => {
        addTableRow(doc, [r.season_key || '—', r.period_name || '—', fmtCurrency(r.rate_per_kwh, currency)], rateWidths);
      });
    }
  }

  // ━━━━━━━━━━━━━━━ COST ANALYSIS ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Cost Analysis', { topPad: 0.2 });

  const costData = [
    ['Baseline Annual Cost', fmtCurrency(result.baseline_annual_cost, currency)],
    ['With Solar Cost', fmtCurrency(result.year1_annual_cost, currency)],
    ['Annual Savings', fmtCurrency(result.year1_savings, currency)],
    ['LCOE', result.lcoe_normal != null ? fmtCurrency(result.lcoe_normal, currency) + '/kWh' : '—'],
  ];

  costData.forEach(([k, v]) => addKV(doc, k, v));

  if (result.peak_demand_before_kw && result.peak_demand_after_kw) {
    doc.moveDown(0.5);
    addKV(doc, 'Peak Demand (Before Solar)', fmt(result.peak_demand_before_kw, 1) + ' kW');
    addKV(doc, 'Peak Demand (After Solar)', fmt(result.peak_demand_after_kw, 1) + ' kW');
  }

  // ━━━━━━━━━━━━━━━ ENERGY SOURCE COMPARISON ━━━━━━━━━━━━━━━
  if (energyComp && Object.keys(energyComp).length > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Energy Source Comparison (Annual)', { topPad: 0.2 });

    const compWidths = [140, 110, 110, 120];
    addTableRow(doc, ['Energy Source', 'Annual Cost', 'CO2 Emissions', 'Fuel Used'], compWidths, { header: true });
    addTableRow(doc, ['Solar PV System', fmtCurrency(result.year1_annual_cost, currency), '0 kg', '0 L'], compWidths);
    
    if (energyComp.grid) {
      addTableRow(doc, ['Grid Electricity', fmtCurrency(energyComp.grid.annual_cost, currency), fmt(energyComp.grid.co2_kg) + ' kg', '—'], compWidths);
    }
    if (energyComp.diesel) {
      addTableRow(doc, ['Diesel Generator', fmtCurrency(energyComp.diesel.annual_cost, currency), fmt(energyComp.diesel.co2_kg) + ' kg', fmt(energyComp.diesel.fuel_liters) + ' L'], compWidths);
    }
    if (energyComp.petrol) {
      addTableRow(doc, ['Petrol Generator', fmtCurrency(energyComp.petrol.annual_cost, currency), fmt(energyComp.petrol.co2_kg) + ' kg', fmt(energyComp.petrol.fuel_liters) + ' L'], compWidths);
    }
  }

  // ━━━━━━━━━━━━━━━ FINANCIAL PROJECTION ━━━━━━━━━━━━━━━
  if (cashflow.length > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Yearly Cashflow Projection', { topPad: 0.2 });

    const cfWidths = [40, 80, 70, 80, 90, 80];
    addTableRow(doc, ['Year', 'Savings', 'O&M', 'Net Cashflow', 'Cumulative', 'Generation'], cfWidths, { header: true });

    const showYears = [0, 1, 2, 3, 4, 9, 14, 19, 24].filter(y => y < cashflow.length);
    showYears.forEach(yi => {
      const cf = cashflow[yi];
      if (!cf) return;
      addTableRow(doc, [
        cf.year || yi + 1,
        fmtCurrency(cf.savings, currency),
        fmtCurrency(cf.om_cost, currency),
        fmtCurrency(cf.net_cashflow, currency),
        fmtCurrency(cf.cumulative_cashflow, currency),
        fmt(cf.generation_kwh, 0) + ' kWh',
      ], cfWidths);
    });
  }

  // ━━━━━━━━━━━━━━━ ENVIRONMENTAL IMPACT ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Environmental Impact', { topPad: 0.2 });

  const envMetrics = [
    ['Annual CO2 Offset', fmt(annualCO2, 0) + ' kg'],
    ['Trees Equivalent', fmt(treesOffset, 0)],
    ['25-Year CO2 Offset', fmt(annualCO2 * 25, 0) + ' kg'],
  ];

  envMetrics.forEach(([k, v]) => addKV(doc, k, v));

  // ━━━━━━━━━━━━━━━ AI EXPERT ANALYSIS ━━━━━━━━━━━━━━━
  if (aiFeedback) {
    addPageBreak(doc);
    addHeader(doc, 'AI Expert Analysis', { topPad: 0.2 });

    doc.fontSize(10).fillColor(hex(BRAND.text)).text(aiFeedback, { lineGap: 4 });
  }

  // ━━━━━━━━━━━━━━━ MONTHLY ENERGY SUMMARY ━━━━━━━━━━━━━━━
  if (monthly.length > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Monthly Energy Summary', { topPad: 0.2 });

    const mWidths = [45, 65, 70, 70, 70, 70, 80];
    addTableRow(doc, ['Month', 'Load', 'Solar Gen', 'Self-Used', 'Grid Import', 'Grid Export', 'Savings'], mWidths, { header: true });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthly.forEach((m, i) => {
      addTableRow(doc, [
        monthNames[i] || i + 1,
        fmt(m.load_kwh, 0),
        fmt(m.pv_gen_kwh, 0),
        fmt(m.solar_utilised_kwh, 0),
        fmt(m.grid_import_kwh, 0),
        fmt(m.grid_export_kwh, 0),
        fmtCurrency(m.savings, currency),
      ], mWidths);
    });

    const totalLoad = monthly.reduce((s, m) => s + (m.load_kwh || 0), 0);
    const totalSelf = monthly.reduce((s, m) => s + (m.solar_utilised_kwh || 0), 0);
    const totalImport = monthly.reduce((s, m) => s + (m.grid_import_kwh || 0), 0);
    const totalExport = monthly.reduce((s, m) => s + (m.grid_export_kwh || 0), 0);

    doc.moveDown(0.5);
    addSubHeader(doc, 'Annual Totals');
    addKV(doc, 'Total Load', fmt(totalLoad) + ' kWh');
    addKV(doc, 'Total Generation', fmt(result.annual_solar_gen_kwh) + ' kWh');
    addKV(doc, 'Self-Consumption', fmt(totalSelf) + ' kWh');
    addKV(doc, 'Grid Import', fmt(totalImport) + ' kWh');
    addKV(doc, 'Grid Export', fmt(totalExport) + ' kWh');
  }

  // ━━━━━━━━━━━━━━━ UNCERTAINTY & TRACEABILITY ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Uncertainty & Traceability', { topPad: 0.2 });
  const uncertainty = result?.extended_metrics?.uncertainty || null;
  const prov = result?.run_provenance || {};
  if (uncertainty?.annual_generation_mwh) {
    addSubHeader(doc, 'Energy Probabilistic Band');
    addKV(doc, 'P50 generation', fmt(uncertainty.annual_generation_mwh.p50, 2) + ' MWh');
    addKV(doc, 'P90 generation', fmt(uncertainty.annual_generation_mwh.p90, 2) + ' MWh');
    addKV(doc, 'P95 generation', fmt(uncertainty.annual_generation_mwh.p95, 2) + ' MWh');
  }
  addSubHeader(doc, 'Run Provenance');
  addKV(doc, 'Engine version', prov.engine_version || '—');
  addKV(doc, 'Input snapshot hash', prov.input_snapshot_hash || prov.inputs_hash || '—');
  addKV(doc, 'Formula bundle hash', prov.formula_bundle_hash || '—');
  addKV(doc, 'Weather dataset hash', prov.weather_dataset_hash || '—');
  const references = result?.extended_metrics?.formula_references || {};
  const referenceItems = Object.entries(references).slice(0, 8);
  if (referenceItems.length > 0) {
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor(hex(BRAND.muted)).text('KPI Formula References');
    referenceItems.forEach(([kpi, formula]) => {
      doc.fontSize(9).fillColor(hex(BRAND.text)).text(`• ${kpi}: ${formula}`, { indent: 10, lineGap: 2 });
    });
  }

  // ━━━━━━━━━━━━━━━ DISCLAIMER ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Assumptions & Disclaimer', { topPad: 0.2 });

  const assumptions = [
    'Solar resource data sourced from NASA POWER climatological averages.',
    `PV generation modelled with ${design?.pv_system_losses_pct || 14}% total system losses.`,
    `Panel degradation: ${design?.pv_degradation_annual_pct || 0.5}% per year.`,
    `Discount rate: ${design?.discount_rate_pct || 10}%.`,
    `Tariff escalation: ${design?.tariff_escalation_pct || 8}% per year.`,
    `Analysis period: ${design?.analysis_period_years || 25} years.`,
    'Financial projections are estimates and do not constitute financial advice.',
  ];

  assumptions.forEach(a => {
    doc.fontSize(10).fillColor(hex(BRAND.text)).text(`• ${a}`, { indent: 10, lineGap: 3 });
  });

  doc.moveDown(1.5);
  doc.fontSize(8).fillColor(hex(BRAND.muted));
  doc.text('DISCLAIMER: This report is generated by the SolNuv platform for preliminary design and feasibility assessment purposes. Actual system performance may vary based on local conditions, equipment specifications, installation quality, and other factors. A detailed engineering study by a qualified professional is recommended before final investment decisions.', {
    lineGap: 2,
    width: pageWidth,
  });

  // ── Footer on all pages ──
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    if (i === 0) continue;
    doc.fontSize(7).fillColor(hex(BRAND.muted));
    doc.text(
      `SolNuv Design Report — ${projectData?.name || 'Project'} — Page ${i + 1} of ${pages.count}`,
      50,
      doc.page.height - 35,
      { width: pageWidth, align: 'center' }
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
    ['PV Capacity (kWp)', design?.pv_capacity_kwp],
    ['Annual Generation (kWh)', result.annual_solar_gen_kwh],
    ['Solar Fraction (%)', result.utilisation_pct],
    ['Self-Consumption (%)', result.self_consumption_pct],
    ['BESS Capacity (kWh)', design?.bess_capacity_kwh || 0],
    [''],
    ['Baseline Annual Cost', result.baseline_annual_cost],
    ['With-Solar Annual Cost', result.year1_annual_cost],
    ['Annual Savings', result.year1_savings],
    ['Simple Payback (yrs)', result.simple_payback_months ? (result.simple_payback_months / 12).toFixed(1) : '—'],
    [`NPV ${design?.analysis_period_years || 25}-yr`, result.npv_25yr],
    ['IRR (%)', result.irr_pct],
    ['LCOE', result.lcoe_normal],
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
    ws2.addRow([monthNames[i], m.load_kwh, m.pv_gen_kwh, m.solar_utilised_kwh, m.grid_export_kwh, m.grid_import_kwh, m.savings]);
  });

  // ── Cashflow Sheet ──
  const ws3 = wb.addWorksheet('Cashflow');
  ws3.addRow(['Year', 'Savings', 'O&M', 'Net CF', 'Cumulative CF', 'Gen kWh']);
  ws3.getRow(1).font = { bold: true };
  cashflow.forEach(cf => {
    ws3.addRow([cf.year, cf.savings, cf.om_cost, cf.net_cashflow, cf.cumulative_cashflow, cf.generation_kwh]);
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

/**
 * Generate a PDF from a share token (mirrors the shared report page).
 * @param {string} token - The share link token
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateSharedReportPdf(token) {
  const { data: share, error: shareError } = await supabase
    .from('report_shares')
    .select('*')
    .eq('share_token', token)
    .single();

  if (shareError || !share) {
    throw new Error('Share link not found or expired');
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    throw new Error('Share link has expired');
  }

  const designId = share.project_id
    ? (await supabase.from('project_designs').select('id').eq('project_id', share.project_id).order('updated_at', { ascending: false }).limit(1).single())?.data?.id
    : null;

  let resultQuery = supabase
    .from('simulation_results')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(1);

  if (designId) {
    resultQuery = resultQuery.eq('project_design_id', designId);
  } else if (share.simulation_result_id) {
    resultQuery = resultQuery.eq('id', share.simulation_result_id);
  }

  const { data: result } = await resultQuery.single();

  if (!result) throw new Error('No simulation results found');

  const { data: fullDesign } = await supabase
    .from('project_designs')
    .select('*')
    .eq('id', result.project_design_id)
    .single();

  const projectId = share.project_id || fullDesign?.project_id;
  let projectData = null;
  let tariffData = null;
  let equipmentData = null;

  if (projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('*, companies(name, branding_primary_color)')
      .eq('id', projectId)
      .single();
    projectData = project;

    const { data: equipment } = await supabase
      .from('equipment')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_installed', true)
      .limit(20);
    equipmentData = equipment;
  }

  if (fullDesign?.tariff_structure_id) {
    const { data: tariff } = await supabase
      .from('tariff_structures')
      .select('*, tariff_rates(*)')
      .eq('id', fullDesign.tariff_structure_id)
      .single();
    tariffData = tariff;
  }

  const companyName = projectData?.companies?.name || 'SolNuv';
  const currency = tariffData?.currency || 'NGN';
  const monthly = result.monthly_summary || [];
  const cashflow = result.yearly_cashflow || [];
  const energyComp = result.energy_comparison 
    ? (typeof result.energy_comparison === 'string' ? JSON.parse(result.energy_comparison) : result.energy_comparison) 
    : {};
  const exec = result.executive_summary_text || '';
  const aiFeedback = result.ai_feedback_text || '';

  const panels = equipmentData?.filter(e => e.equipment_type === 'panel') || [];
  const batteries = equipmentData?.filter(e => e.equipment_type === 'battery') || [];

  const co2Factor = 0.5;
  const annualCO2 = (result.annual_solar_gen_kwh || 0) * co2Factor;
  const treesOffset = annualCO2 * 0.02;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Solar Design Report — ${projectData?.name || 'Project'}`,
      Author: 'SolNuv Platform',
      Subject: 'Solar + BESS Design & Financial Analysis',
    },
    bufferPages: true,
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));

  const pageWidth = doc.page.width - 100;

  // ━━━━━━━━━━━━━━━ COVER PAGE ━━━━━━━━━━━━━━━
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(hex(BRAND.primary));
  doc.rect(0, 260, doc.page.width, 8).fill(hex(BRAND.accent));

  doc.fillColor(hex(BRAND.white));
  doc.fontSize(14).fillColor(hex(BRAND.accent)).text('SOLNUV', 50, 80);
  doc.fontSize(32).text('Solar Design Report', 50, 100);
  doc.fontSize(14).fillColor(hex(BRAND.white)).text(companyName, 50, 200);

  doc.fontSize(18).text(projectData?.name || 'Project', 50, 290);
  doc.fontSize(11).fillColor(hex(BRAND.accent)).text(`${projectData?.location || ''}${projectData?.state ? ', ' + projectData.state : ''}`, 50, 315);

  doc.fillColor(hex(BRAND.white)).fontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 50, 380);

  doc.fontSize(8).fillColor('#7FAAAA');
  doc.text('Generated by SolNuv — Africa\'s Solar Engineering Platform', 50, doc.page.height - 60);
  doc.text('www.solnuv.com', 50, doc.page.height - 48);

  // ━━━━━━━━━━━━━━━ EXECUTIVE SUMMARY ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Executive Summary', { topPad: 0.2 });

  if (exec) {
    doc.fontSize(10).fillColor(hex(BRAND.text)).text(exec, { lineGap: 4 });
  }

  doc.moveDown(0.8);
  addSubHeader(doc, 'Key Metrics');

  const metrics = [
    ['PV Capacity', fmt(fullDesign?.pv_capacity_kwp, 1) + ' kWp'],
    ['Annual Generation', fmt(result.annual_solar_gen_kwh) + ' kWh'],
    ['Year 1 Savings', fmtCurrency(result.year1_savings, currency)],
    ['Simple Payback', result.simple_payback_months ? fmt(result.simple_payback_months / 12, 1) + ' years' : '—'],
    ['Solar Fraction', result.utilisation_pct != null ? fmt(result.utilisation_pct, 1) + '%' : '—'],
    ['Self-Consumption', result.self_consumption_pct != null ? fmt(result.self_consumption_pct, 1) + '%' : '—'],
    ['NPV', fmtCurrency(result.npv_25yr, currency)],
    ['IRR', result.irr_pct != null ? fmt(result.irr_pct, 1) + '%' : '—'],
    ['LCOE', result.lcoe_normal != null ? fmtCurrency(result.lcoe_normal, currency) + '/kWh' : '—'],
  ];

  metrics.forEach(([k, v]) => addKV(doc, k, v));

  // ━━━━━━━━━━━━━━━ PV SYSTEM CONFIGURATION ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'PV System Configuration', { topPad: 0.2 });

  const pvConfig = [
    ['Technology', fullDesign?.pv_technology || 'Monocrystalline'],
    ['Array Tilt', (fullDesign?.pv_tilt_deg || 0) + '°'],
    ['Array Azimuth', (fullDesign?.pv_azimuth_deg || 0) + '°'],
    ['System Losses', (fullDesign?.pv_system_losses_pct || 14) + '%'],
    ['Annual Degradation', (fullDesign?.pv_degradation_annual_pct || 0.5) + '%'],
    ['Analysis Period', (fullDesign?.analysis_period_years || 25) + ' years'],
    ['Discount Rate', (fullDesign?.discount_rate_pct || 10) + '%'],
    ['Tariff Escalation', (fullDesign?.tariff_escalation_pct || 8) + '%/year'],
  ];

  pvConfig.forEach(([k, v]) => addKV(doc, k, v));

  if (panels.length > 0) {
    doc.moveDown(0.5);
    addSubHeader(doc, 'Installed Panels');
    panels.forEach(p => {
      addKV(doc, p.brand || p.manufacturer || 'Generic', `${p.quantity || 1} × ${p.rated_power_w ? (p.rated_power_w / 1000).toFixed(1) + ' kW' : '—'}`);
    });
  }

  // ━━━━━━━━━━━━━━━ BATTERY SYSTEM ━━━━━━━━━━━━━━━
  if (fullDesign?.bess_capacity_kwh > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Battery Energy Storage System', { topPad: 0.2 });

    const bessConfig = [
      ['Rated Capacity', fmt(fullDesign.bess_capacity_kwh) + ' kWh'],
      ['Power Rating', fmt(fullDesign.bess_power_kw) + ' kW'],
      ['Chemistry', (fullDesign.bess_chemistry || 'lifepo4').toUpperCase()],
      ['Depth of Discharge', (fullDesign.bess_dod_pct || 80) + '%'],
      ['Round-Trip Efficiency', ((fullDesign.bess_round_trip_efficiency || 0.9) * 100).toFixed(0) + '%'],
      ['Dispatch Strategy', (fullDesign.bess_dispatch_strategy || 'self_consumption').replace(/_/g, ' ')],
      ['Annual Throughput', fmt(result.battery_discharged_kwh) + ' kWh'],
      ['Annual Cycles', result.battery_cycles_annual != null ? fmt(result.battery_cycles_annual, 0) : '—'],
    ];

    bessConfig.forEach(([k, v]) => addKV(doc, k, v));

    if (batteries.length > 0) {
      doc.moveDown(0.5);
      addSubHeader(doc, 'Installed Batteries');
      batteries.forEach(b => {
        addKV(doc, b.brand || b.manufacturer || 'Generic', `${b.quantity || 1} × ${b.rated_capacity_kwh || '—'} kWh`);
      });
    }
  }

  // ━━━━━━━━━━━━━━━ GRID TARIFF PLAN ━━━━━━━━━━━━━━━
  if (tariffData) {
    addPageBreak(doc);
    addHeader(doc, 'Grid Tariff Plan', { topPad: 0.2 });

    addKV(doc, 'Tariff Name', tariffData.tariff_name || '—');
    addKV(doc, 'Utility', tariffData.utility_name || '—');
    addKV(doc, 'Currency', tariffData.currency || 'NGN');
    addKV(doc, 'Grid Topology', (fullDesign?.grid_topology || 'grid_tied').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    if (tariffData.tariff_rates?.length > 0) {
      doc.moveDown(0.5);
      addSubHeader(doc, 'Rate Schedule');
      const rateWidths = [150, 150, 180];
      addTableRow(doc, ['Season', 'Period', 'Rate/kWh'], rateWidths, { header: true });
      tariffData.tariff_rates.forEach(r => {
        addTableRow(doc, [r.season_key || '—', r.period_name || '—', fmtCurrency(r.rate_per_kwh, currency)], rateWidths);
      });
    }
  }

  // ━━━━━━━━━━━━━━━ COST ANALYSIS ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Cost Analysis', { topPad: 0.2 });

  const costData = [
    ['Baseline Annual Cost', fmtCurrency(result.baseline_annual_cost, currency)],
    ['With Solar Cost', fmtCurrency(result.year1_annual_cost, currency)],
    ['Annual Savings', fmtCurrency(result.year1_savings, currency)],
    ['LCOE', result.lcoe_normal != null ? fmtCurrency(result.lcoe_normal, currency) + '/kWh' : '—'],
  ];

  costData.forEach(([k, v]) => addKV(doc, k, v));

  if (result.peak_demand_before_kw && result.peak_demand_after_kw) {
    doc.moveDown(0.5);
    addKV(doc, 'Peak Demand (Before Solar)', fmt(result.peak_demand_before_kw, 1) + ' kW');
    addKV(doc, 'Peak Demand (After Solar)', fmt(result.peak_demand_after_kw, 1) + ' kW');
  }

  // ━━━━━━━━━━━━━━━ ENERGY SOURCE COMPARISON ━━━━━━━━━━━━━━━
  if (energyComp && Object.keys(energyComp).length > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Energy Source Comparison (Annual)', { topPad: 0.2 });

    const compWidths = [140, 110, 110, 120];
    addTableRow(doc, ['Energy Source', 'Annual Cost', 'CO2 Emissions', 'Fuel Used'], compWidths, { header: true });
    addTableRow(doc, ['Solar PV System', fmtCurrency(result.year1_annual_cost, currency), '0 kg', '0 L'], compWidths);
    
    if (energyComp.grid) {
      addTableRow(doc, ['Grid Electricity', fmtCurrency(energyComp.grid.annual_cost, currency), fmt(energyComp.grid.co2_kg) + ' kg', '—'], compWidths);
    }
    if (energyComp.diesel) {
      addTableRow(doc, ['Diesel Generator', fmtCurrency(energyComp.diesel.annual_cost, currency), fmt(energyComp.diesel.co2_kg) + ' kg', fmt(energyComp.diesel.fuel_liters) + ' L'], compWidths);
    }
    if (energyComp.petrol) {
      addTableRow(doc, ['Petrol Generator', fmtCurrency(energyComp.petrol.annual_cost, currency), fmt(energyComp.petrol.co2_kg) + ' kg', fmt(energyComp.petrol.fuel_liters) + ' L'], compWidths);
    }
  }

  // ━━━━━━━━━━━━━━━ FINANCIAL PROJECTION ━━━━━━━━━━━━━━━
  if (cashflow.length > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Yearly Cashflow Projection', { topPad: 0.2 });

    const cfWidths = [40, 80, 70, 80, 90, 80];
    addTableRow(doc, ['Year', 'Savings', 'O&M', 'Net Cashflow', 'Cumulative', 'Generation'], cfWidths, { header: true });

    const showYears = [0, 1, 2, 3, 4, 9, 14, 19, 24].filter(y => y < cashflow.length);
    showYears.forEach(yi => {
      const cf = cashflow[yi];
      if (!cf) return;
      addTableRow(doc, [
        cf.year || yi + 1,
        fmtCurrency(cf.savings, currency),
        fmtCurrency(cf.om_cost, currency),
        fmtCurrency(cf.net_cashflow, currency),
        fmtCurrency(cf.cumulative_cashflow, currency),
        fmt(cf.generation_kwh, 0) + ' kWh',
      ], cfWidths);
    });
  }

  // ━━━━━━━━━━━━━━━ ENVIRONMENTAL IMPACT ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Environmental Impact', { topPad: 0.2 });

  const envMetrics = [
    ['Annual CO2 Offset', fmt(annualCO2, 0) + ' kg'],
    ['Trees Equivalent', fmt(treesOffset, 0)],
    ['25-Year CO2 Offset', fmt(annualCO2 * 25, 0) + ' kg'],
  ];

  envMetrics.forEach(([k, v]) => addKV(doc, k, v));

  // ━━━━━━━━━━━━━━━ AI EXPERT ANALYSIS ━━━━━━━━━━━━━━━
  if (aiFeedback) {
    addPageBreak(doc);
    addHeader(doc, 'AI Expert Analysis', { topPad: 0.2 });

    doc.fontSize(10).fillColor(hex(BRAND.text)).text(aiFeedback, { lineGap: 4 });
  }

  // ━━━━━━━━━━━━━━━ MONTHLY ENERGY SUMMARY ━━━━━━━━━━━━━━━
  if (monthly.length > 0) {
    addPageBreak(doc);
    addHeader(doc, 'Monthly Energy Summary', { topPad: 0.2 });

    const mWidths = [45, 65, 70, 70, 70, 70, 80];
    addTableRow(doc, ['Month', 'Load', 'Solar Gen', 'Self-Used', 'Grid Import', 'Grid Export', 'Savings'], mWidths, { header: true });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthly.forEach((m, i) => {
      addTableRow(doc, [
        monthNames[i] || i + 1,
        fmt(m.load_kwh, 0),
        fmt(m.pv_gen_kwh, 0),
        fmt(m.solar_utilised_kwh, 0),
        fmt(m.grid_import_kwh, 0),
        fmt(m.grid_export_kwh, 0),
        fmtCurrency(m.savings, currency),
      ], mWidths);
    });

    const totalLoad = monthly.reduce((s, m) => s + (m.load_kwh || 0), 0);
    const totalSelf = monthly.reduce((s, m) => s + (m.solar_utilised_kwh || 0), 0);
    const totalImport = monthly.reduce((s, m) => s + (m.grid_import_kwh || 0), 0);
    const totalExport = monthly.reduce((s, m) => s + (m.grid_export_kwh || 0), 0);

    doc.moveDown(0.5);
    addSubHeader(doc, 'Annual Totals');
    addKV(doc, 'Total Load', fmt(totalLoad) + ' kWh');
    addKV(doc, 'Total Generation', fmt(result.annual_solar_gen_kwh) + ' kWh');
    addKV(doc, 'Self-Consumption', fmt(totalSelf) + ' kWh');
    addKV(doc, 'Grid Import', fmt(totalImport) + ' kWh');
    addKV(doc, 'Grid Export', fmt(totalExport) + ' kWh');
  }

  // ━━━━━━━━━━━━━━━ UNCERTAINTY & TRACEABILITY ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Uncertainty & Traceability', { topPad: 0.2 });
  const uncertainty = result?.extended_metrics?.uncertainty || null;
  const prov = result?.run_provenance || {};
  if (uncertainty?.annual_generation_mwh) {
    addSubHeader(doc, 'Energy Probabilistic Band');
    addKV(doc, 'P50 generation', fmt(uncertainty.annual_generation_mwh.p50, 2) + ' MWh');
    addKV(doc, 'P90 generation', fmt(uncertainty.annual_generation_mwh.p90, 2) + ' MWh');
    addKV(doc, 'P95 generation', fmt(uncertainty.annual_generation_mwh.p95, 2) + ' MWh');
  }
  addSubHeader(doc, 'Run Provenance');
  addKV(doc, 'Engine version', prov.engine_version || '—');
  addKV(doc, 'Input snapshot hash', prov.input_snapshot_hash || prov.inputs_hash || '—');
  addKV(doc, 'Formula bundle hash', prov.formula_bundle_hash || '—');
  addKV(doc, 'Weather dataset hash', prov.weather_dataset_hash || '—');
  const references = result?.extended_metrics?.formula_references || {};
  const referenceItems = Object.entries(references).slice(0, 8);
  if (referenceItems.length > 0) {
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor(hex(BRAND.muted)).text('KPI Formula References');
    referenceItems.forEach(([kpi, formula]) => {
      doc.fontSize(9).fillColor(hex(BRAND.text)).text(`• ${kpi}: ${formula}`, { indent: 10, lineGap: 2 });
    });
  }

  // ━━━━━━━━━━━━━━━ DISCLAIMER ━━━━━━━━━━━━━━━
  addPageBreak(doc);
  addHeader(doc, 'Assumptions & Disclaimer', { topPad: 0.2 });

  const assumptions = [
    'Solar resource data sourced from NASA POWER climatological averages.',
    `PV generation modelled with ${fullDesign?.pv_system_losses_pct || 14}% total system losses.`,
    `Panel degradation: ${fullDesign?.pv_degradation_annual_pct || 0.5}% per year.`,
    `Discount rate: ${fullDesign?.discount_rate_pct || 10}%.`,
    `Tariff escalation: ${fullDesign?.tariff_escalation_pct || 8}% per year.`,
    `Analysis period: ${fullDesign?.analysis_period_years || 25} years.`,
    'Financial projections are estimates and do not constitute financial advice.',
  ];

  assumptions.forEach(a => {
    doc.fontSize(10).fillColor(hex(BRAND.text)).text(`• ${a}`, { indent: 10, lineGap: 3 });
  });

  doc.moveDown(1.5);
  doc.fontSize(8).fillColor(hex(BRAND.muted));
  doc.text('DISCLAIMER: This report is generated by the SolNuv platform for preliminary design and feasibility assessment purposes. Actual system performance may vary based on local conditions, equipment specifications, installation quality, and other factors. A detailed engineering study by a qualified professional is recommended before final investment decisions.', {
    lineGap: 2,
    width: pageWidth,
  });

  // ── Footer on all pages ──
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    if (i === 0) continue;
    doc.fontSize(7).fillColor(hex(BRAND.muted));
    doc.text(
      `SolNuv Design Report — ${projectData?.name || 'Project'} — Page ${i + 1} of ${pages.count}`,
      50,
      doc.page.height - 35,
      { width: pageWidth, align: 'center' }
    );
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

module.exports = {
  generateDesignReportPdf,
  generateDesignReportExcel,
  generateSharedReportPdf,
};
