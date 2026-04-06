/**
 * SolNuv Design Report Controller
 * PDF/Excel/HTML report downloads and public share links
 */

const crypto = require('crypto');
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateDesignReportPdf, generateDesignReportExcel } = require('../services/designReportService');
const logger = require('../utils/logger');

/** Verify ownership supporting solo engineers (no company_id) */
async function verifyProjectOwnership(projectId, user) {
  let query = supabase.from('projects').select('id, name, location, company_id').eq('id', projectId);
  if (user.company_id) {
    query = query.eq('company_id', user.company_id);
  } else {
    query = query.eq('user_id', user.id);
  }
  const { data } = await query.single();
  return data;
}

/** Get latest simulation result for a project via project_designs FK */
async function getLatestSimulationResult(projectId, selectCols = 'id') {
  const { data: design } = await supabase
    .from('project_designs')
    .select('id')
    .eq('project_id', projectId)
    .single();
  if (!design) return null;

  const { data: result } = await supabase
    .from('simulation_results')
    .select(selectCols)
    .eq('project_design_id', design.id)
    .order('run_at', { ascending: false })
    .limit(1)
    .single();
  return result;
}

/**
 * GET /api/design-reports/:projectId/pdf
 * Download professional PDF design report. Pro+ plan.
 */
exports.downloadPdf = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const result = await getLatestSimulationResult(projectId);
    if (!result) return sendError(res, 'No simulation results found. Run a simulation first.', 404);

    const pdfBuffer = await generateDesignReportPdf(result.id);

    const filename = `SolNuv_Design_Report_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    logger.error('downloadPdf error', { message: err.message });
    return sendError(res, 'Failed to generate PDF report');
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

    const result = await getLatestSimulationResult(projectId, '*, project_designs(*)');
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
