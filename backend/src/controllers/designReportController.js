/**
 * SolNuv Design Report Controller
 * PDF/Excel/HTML report downloads and public share links
 */

const crypto = require('crypto');
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateDesignReportPdf: generatePdfkitPdf, generateDesignReportExcel } = require('../services/designReportService');
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

    // Use PDFKit for reliable server-side PDF generation
    const pdfBuffer = await generatePdfkitPdf(result.id);

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
