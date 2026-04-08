/**
 * SolNuv Design Report Controller
 * PDF/Excel/HTML report downloads and public share links
 */

const crypto = require('crypto');
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateDesignReportExcel } = require('../services/designReportService');
const { generateDesignReportPdf: generatePuppeteerPdf } = require('../services/puppeteerPdfService');
const logger = require('../utils/logger');

/** Verify ownership supporting orphaned projects (created before user joined a company) */
async function verifyProjectOwnership(projectId, user) {
  const userId = user.id;
  const companyId = user.company_id;

  let query = supabase.from('projects').select('id, name, state, city, company_id, user_id').eq('id', projectId);

  if (companyId) {
    query = query.or(`company_id.eq.${companyId},and(user_id.eq.${userId},company_id.is.null)`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    logger.error('verifyProjectOwnership failed', { projectId, error: error.message });
  }
  return data;
}

/** Get latest simulation result for a project via project_designs FK */
async function getLatestSimulationResult(projectId, selectCols = 'id') {
  const { data: design, error: designErr } = await supabase
    .from('project_designs')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle();
  if (designErr || !design) {
    logger.error('getLatestSimulationResult: design lookup failed', {
      projectId,
      error: designErr?.message,
    });
    return null;
  }

  const { data: result, error: resultErr } = await supabase
    .from('simulation_results')
    .select(selectCols)
    .eq('project_design_id', design.id)
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resultErr) {
    logger.error('getLatestSimulationResult: result lookup failed', {
      designId: design.id,
      error: resultErr.message,
    });
  }

  return result;
}

/** Format currency value */
function fmtCurrency(n, currency = 'NGN') {
  if (n === null || n === undefined) return '—';
  const symbols = { NGN: '₦', ZAR: 'R', USD: '$', EUR: '€', GBP: '£' };
  const sym = symbols[currency] || currency + ' ';
  return sym + Number(n).toLocaleString('en', { maximumFractionDigits: 0 });
}

/** Format number with commas */
function fmt(n, d = 0) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Build template data for Design Report PDF */
async function buildDesignReportData(simulationResultId) {
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
  const currency = tariff?.currency || 'NGN';
  const monthly = result.monthly_summary || [];
  const cashflow = result.yearly_cashflow || [];
  const analysisPeriod = Number(design?.analysis_period_years) || 25;

  // Calculate peak sun hours
  const peakSunHours = (design?.pv_capacity_kwp && result.annual_solar_gen_kwh)
    ? (result.annual_solar_gen_kwh / design.pv_capacity_kwp / 365).toFixed(1)
    : '—';

  // Calculate BESS usable capacity
  const bessUsableKwh = design?.bess_capacity_kwh
    ? (design.bess_capacity_kwh * (design.bess_dod_pct || 80) / 100).toFixed(1)
    : 0;

  // Build monthly arrays for charts
  const monthlyLoad = monthly.map(m => fmt(m.load_kwh, 0)).join(',');
  const monthlyGen = monthly.map(m => fmt(m.pv_gen_kwh, 0)).join(',');
  const monthlyCharge = monthly.map(m => fmt(m.battery_charged_kwh, 0)).join(',');
  const monthlyDischarge = monthly.map(m => fmt(m.battery_discharged_kwh, 0)).join(',');

  // Build cashflow for chart (show every year)
  const cashflowLabels = cashflow.map(c => c.year).join(',');
  const cashflowValues = cashflow.map(c => fmt(c.net_cashflow, 0)).join(',');
  const cumulativeValues = cashflow.map(c => fmt(c.cumulative_cashflow, 0)).join(',');

  // Build cashflow table rows (sample years)
  const showYears = [0, 1, 2, 3, 4, ...[9, 14, 19, 24].filter(y => y < cashflow.length)];
  const cashflowRows = showYears.map(yi => {
    const cf = cashflow[yi];
    if (!cf) return null;
    return {
      year: cf.year || yi + 1,
      savings: fmtCurrency(cf.savings, currency),
      omCost: fmtCurrency(cf.om_cost, currency),
      netCashflow: fmtCurrency(cf.net_cashflow, currency),
      cumulativeCashflow: fmtCurrency(cf.cumulative_cashflow, currency),
      generationKwh: fmt(cf.generation_kwh, 0),
    };
  }).filter(Boolean);

  // Total load from monthly
  const totalLoad = monthly.reduce((s, m) => s + (m.load_kwh || 0), 0);

  // Build assumptions list
  const assumptions = [
    'Solar resource data sourced from NASA POWER climatological averages.',
    `PV generation modelled using isotropic transposition with ${design?.pv_system_losses_pct || 14}% total system losses.`,
    `Panel degradation rate: ${design?.pv_degradation_annual_pct || 0.5}% per year.`,
    `Discount rate: ${design?.discount_rate_pct || 10}% (nominal).`,
    `Tariff escalation: ${design?.tariff_escalation_pct || 8}% per year.`,
    `Analysis period: ${analysisPeriod} years.`,
    design?.bess_capacity_kwh > 0 ? `Battery round-trip efficiency: ${((design?.bess_round_trip_efficiency ?? 0.90) * 100).toFixed(0)}%.` : null,
    'Financial projections are estimates and do not constitute financial advice.',
  ].filter(Boolean);

  return {
    projectName: project?.name || 'Project',
    companyName,
    location: [project?.city, project?.state].filter(Boolean).join(', ') || project?.location || 'N/A',
    lat: (design?.location_lat || 0).toFixed(4),
    lon: (design?.location_lon || 0).toFixed(4),
    reportDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),

    executiveSummary: result.executive_summary_text || 'A comprehensive solar and battery energy storage system design analysis.',

    pvCapacity: fmt(design?.pv_capacity_kwp),
    annualGeneration: fmt(result.annual_solar_gen_kwh),
    solarFraction: result.utilisation_pct != null ? fmt(result.utilisation_pct, 1) : '—',
    bessCapacity: design?.bess_capacity_kwh ? fmt(design.bess_capacity_kwh) : 'None',
    annualSavings: fmtCurrency(result.year1_savings, currency),
    paybackPeriod: result.simple_payback_months ? fmt(result.simple_payback_months / 12, 1) + ' years' : '—',
    npv: fmtCurrency(result.npv_25yr, currency),
    irr: result.irr_pct != null ? fmt(result.irr_pct, 1) : '—',
    lcoe: result.lcoe_normal != null ? fmtCurrency(result.lcoe_normal, currency) + '/kWh' : '—',

    pvTechnology: design?.pv_technology || 'Monocrystalline PERC',
    pvTilt: design?.pv_tilt_deg || 0,
    pvAzimuth: design?.pv_azimuth_deg || 0,
    pvDegradation: design?.pv_degradation_annual_pct || 0.5,
    pvLosses: design?.pv_system_losses_pct || 14,

    bessUsable: bessUsableKwh,
    bessChemistry: (design?.bess_chemistry || 'LFP').toUpperCase(),
    bessStrategy: (design?.bess_dispatch_strategy || 'self_consumption').replace(/_/g, ' '),

    peakSunHours,

    totalLoad: fmt(totalLoad),
    selfConsumption: fmt(result.solar_utilised_kwh),
    gridExport: fmt(result.grid_export_kwh),

    bessThroughput: fmt(result.battery_discharged_kwh),
    bessCycles: fmt(result.battery_cycles_annual, 0),
    peakShaving: (result.peak_demand_before_kw && result.peak_demand_after_kw)
      ? fmt(result.peak_demand_before_kw - result.peak_demand_after_kw, 1)
      : '—',

    capexTotal: fmtCurrency(design?.capex_total, currency),
    analysisPeriod,

    monthlyLoad,
    monthlyGen,
    monthlyCharge,
    monthlyDischarge,

    cashflowLabels,
    cashflowValues,
    cumulativeValues,
    cashflowRows,

    assumptions,
  };
}

/**
 * GET /api/design-reports/:projectId/pdf
 * Download professional PDF design report. Pro+ plan.
 */
exports.downloadPdf = async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const result = await getLatestSimulationResult(projectId);
    if (!result) return sendError(res, 'No simulation results found. Run a simulation first.', 404);

    // Build template data
    const templateData = await buildDesignReportData(result.id);

    // Use Puppeteer for high-quality PDF with charts
    const pdfBuffer = await generatePuppeteerPdf(templateData);

    const filename = `SolNuv_Design_Report_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    logger.error('downloadPdf error', { 
      message: err.message, 
      stack: err.stack,
      projectId,
      userId: req.user?.id 
    });
    return sendError(res, 'Failed to generate PDF report: ' + err.message);
  }
};

/**
 * GET /api/design-reports/:projectId/excel
 * Download Excel workbook. Elite+ plan.
 */
exports.downloadExcel = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const result = await getLatestSimulationResult(projectId);
    if (!result) return sendError(res, 'No simulation results found', 404);

    const buffer = await generateDesignReportExcel(result.id);

    const filename = `SolNuv_Design_Report_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    logger.error('downloadExcel error', { message: err.message });
    return sendError(res, 'Failed to generate Excel report');
  }
};

/**
 * GET /api/design-reports/:projectId/html
 * Get structured JSON data for HTML report rendering (all plans).
 */
exports.getHtmlData = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    // Exclude hourly_flows (8760 objects) — too large for HTML report; fetched separately if needed
    const htmlCols = [
      'id', 'project_design_id', 'run_at',
      'annual_solar_gen_kwh', 'solar_utilised_kwh', 'solar_exported_kwh', 'curtailed_kwh',
      'battery_discharged_kwh', 'battery_charged_kwh', 'battery_cycles_annual',
      'grid_import_kwh', 'grid_export_kwh',
      'peak_demand_before_kw', 'peak_demand_after_kw',
      'performance_ratio', 'utilisation_pct', 'self_consumption_pct',
      'baseline_annual_cost', 'year1_annual_cost', 'year1_savings',
      'lcoe_normal', 'lcoe_ls',
      'npv_25yr', 'irr_pct', 'roi_pct', 'simple_payback_months',
      'monthly_summary', 'yearly_cashflow', 'tou_breakdown', 'executive_summary_text',
      'grid_topology', 'unmet_load_kwh', 'unmet_load_hours', 'loss_of_load_pct',
      'autonomy_achieved_days', 'diesel_avoided_litres', 'islanded_hours', 'feed_in_revenue',
      'ai_expert_feedback', 'ai_feedback_edited', 'ai_feedback_generated_at',
      'installation_type', 'energy_comparison', 'co2_avoided_tonnes',
      'diesel_annual_cost', 'petrol_annual_cost', 'grid_only_annual_cost',
      'design_warnings',
      'project_designs(*)',
    ].join(', ');

    const result = await getLatestSimulationResult(projectId, htmlCols);
    if (!result) return sendError(res, 'No simulation results found', 404);

    // Fetch tariff info if available
    let tariff = null;
    if (result.project_designs?.tariff_structure_id) {
      const { data: t } = await supabase
        .from('tariff_structures')
        .select('tariff_name, utility_name, tariff_type, currency, tariff_rates(*)')
        .eq('id', result.project_designs.tariff_structure_id)
        .single();
      tariff = t;
    }

    return sendSuccess(res, {
      project,
      design: result.project_designs,
      result: {
        ...result,
        project_designs: undefined, // Remove nested duplicate
      },
      tariff,
    }, 'Report data retrieved');
  } catch (err) {
    logger.error('getHtmlData error', { message: err.message });
    return sendError(res, 'Failed to retrieve report data');
  }
};

/**
 * POST /api/design-reports/:projectId/share
 * Create a public share token (24h default, configurable).
 */
exports.createShareLink = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { expires_hours = 24 } = req.body;

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const result = await getLatestSimulationResult(projectId);
    if (!result) return sendError(res, 'No simulation results to share', 404);

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + Math.min(expires_hours, 720) * 3600000).toISOString();

    const { data: share, error } = await supabase
      .from('report_shares')
      .insert({
        simulation_result_id: result.id,
        share_token: token,
        created_by: req.user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;

    const baseUrl = process.env.FRONTEND_URL || 'https://solnuv.com';
    return sendSuccess(res, {
      share_id: share.id,
      token,
      url: `${baseUrl}/report/${token}`,
      expires_at: expiresAt,
    }, 'Share link created', 201);
  } catch (err) {
    logger.error('createShareLink error', { message: err.message });
    return sendError(res, 'Failed to create share link');
  }
};

/**
 * GET /api/design-reports/shared/:token
 * Public endpoint — no auth required. Retrieve report by share token.
 */
exports.getSharedReport = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return sendError(res, 'Token required', 400);

    const { data: share } = await supabase
      .from('report_shares')
      .select('*, simulation_results(*)')
      .eq('share_token', token)
      .single();

    if (!share) return sendError(res, 'Report not found or link invalid', 404);

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return sendError(res, 'This share link has expired', 410);
    }

    // Increment view count
    await supabase
      .from('report_shares')
      .update({ views: (share.views || 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq('id', share.id);

    const result = share.simulation_results;
    if (!result) return sendError(res, 'Report data not found', 404);

    // Load design and project (limited fields for public view)
    const { data: design } = await supabase
      .from('project_designs')
      .select('pv_technology, pv_capacity_kwp, pv_tilt_deg, pv_azimuth_deg, bess_capacity_kwh, bess_power_kw, bess_chemistry, bess_dispatch_strategy')
      .eq('id', result.project_design_id)
      .single();

    // Get project_id from the design row
    const { data: designForProject } = await supabase
      .from('project_designs')
      .select('project_id')
      .eq('id', result.project_design_id)
      .single();

    const { data: project } = await supabase
      .from('projects')
      .select('name, location, companies(name)')
      .eq('id', designForProject?.project_id)
      .single();

    return sendSuccess(res, {
      project: { name: project?.name, location: project?.location, company: project?.companies?.name },
      design,
      result: {
        pv_capacity_kwp: result.pv_capacity_kwp,
        annual_generation_kwh: result.annual_generation_kwh,
        solar_fraction: result.solar_fraction,
        self_consumption_ratio: result.self_consumption_ratio,
        annual_savings: result.annual_savings,
        simple_payback_years: result.simple_payback_years,
        npv_25yr: result.npv_25yr,
        irr: result.irr,
        lcoe: result.lcoe,
        monthly_summary: result.monthly_summary,
        executive_summary_text: result.executive_summary_text,
      },
    }, 'Shared report retrieved');
  } catch (err) {
    logger.error('getSharedReport error', { message: err.message });
    return sendError(res, 'Failed to retrieve shared report');
  }
};
