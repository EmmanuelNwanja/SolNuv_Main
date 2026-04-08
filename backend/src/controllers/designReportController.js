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
        project_id: projectId,
        share_token: token,
        created_by: req.user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      logger.error('createShareLink DB error', { 
        message: error.message, 
        details: error.details,
        hint: error.hint,
        projectId,
        userId: req.user?.id 
      });
      return sendError(res, 'Failed to create share link: ' + error.message);
    }

    if (!share) {
      return sendError(res, 'Share link creation failed - no data returned', 500);
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://solnuv.com';
    return sendSuccess(res, {
      share_id: share.id,
      token,
      url: `${baseUrl}/report/${token}`,
      expires_at: expiresAt,
    }, 'Share link created', 201);
  } catch (err) {
    logger.error('createShareLink error', { message: err.message, stack: err.stack });
    return sendError(res, 'Failed to create share link: ' + err.message);
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
      .select('*')
      .eq('share_token', token)
      .single();

    if (!share) return sendError(res, 'Report not found or link invalid', 404);

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return sendError(res, 'This share link has expired', 410);
    }

    // Check if active
    if (!share.is_active) {
      return sendError(res, 'This share link has been deactivated', 410);
    }

    // Get latest simulation result for this project
    const { data: design } = await supabase
      .from('project_designs')
      .select('id')
      .eq('project_id', share.project_id)
      .maybeSingle();

    if (!design) return sendError(res, 'No design found for this project', 404);

    const { data: result } = await supabase
      .from('simulation_results')
      .select('*')
      .eq('project_design_id', design.id)
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (!result) return sendError(res, 'No simulation results found', 404);

    // Get full design data
    const { data: fullDesign } = await supabase
      .from('project_designs')
      .select('*, project:projects(name, location, companies(name))')
      .eq('id', design.id)
      .single();

    // Get project info - try from share first, fallback to design's project
    const projectId = share.project_id || fullDesign?.project_id;
    let projectData = null;
    if (projectId) {
      const { data: project } = await supabase
        .from('projects')
        .select('name, location, city, state, companies(name)')
        .eq('id', projectId)
        .single();
      projectData = project;
    }

    return sendSuccess(res, {
      project: { 
        name: projectData?.name || fullDesign?.project?.name || 'Solar Project', 
        location: projectData?.location || projectData?.city || fullDesign?.project?.location || 'N/A', 
        company: projectData?.companies?.name || fullDesign?.project?.companies?.name 
      },
      design: {
        pv_technology: fullDesign?.pv_technology,
        pv_capacity_kwp: fullDesign?.pv_capacity_kwp,
        pv_tilt_deg: fullDesign?.pv_tilt_deg,
        pv_azimuth_deg: fullDesign?.pv_azimuth_deg,
        pv_system_losses_pct: fullDesign?.pv_system_losses_pct,
        pv_degradation_annual_pct: fullDesign?.pv_degradation_annual_pct,
        bess_capacity_kwh: fullDesign?.bess_capacity_kwh,
        bess_dod_pct: fullDesign?.bess_dod_pct,
        bess_chemistry: fullDesign?.bess_chemistry,
        bess_dispatch_strategy: fullDesign?.bess_dispatch_strategy,
        bess_round_trip_efficiency: fullDesign?.bess_round_trip_efficiency,
        capex_total: fullDesign?.capex_total,
        discount_rate_pct: fullDesign?.discount_rate_pct,
        tariff_escalation_pct: fullDesign?.tariff_escalation_pct,
        analysis_period_years: fullDesign?.analysis_period_years,
        grid_topology: fullDesign?.grid_topology,
      },
      result: {
        pv_capacity_kwp: result.pv_capacity_kwp,
        annual_generation_kwh: result.annual_solar_gen_kwh,
        solar_fraction: result.utilisation_pct,
        self_consumption_ratio: result.self_consumption_pct,
        annual_savings: result.year1_savings,
        simple_payback_years: result.simple_payback_months ? result.simple_payback_months / 12 : null,
        simple_payback_months: result.simple_payback_months,
        npv_25yr: result.npv_25yr,
        irr: result.irr_pct,
        lcoe: result.lcoe_normal,
        baseline_annual_cost: result.baseline_annual_cost,
        year1_annual_cost: result.year1_annual_cost,
        battery_discharged_kwh: result.battery_discharged_kwh,
        battery_cycles_annual: result.battery_cycles_annual,
        monthly_summary: result.monthly_summary,
        yearly_cashflow: result.yearly_cashflow,
        executive_summary_text: result.executive_summary_text,
      },
    }, 'Shared report retrieved');
  } catch (err) {
    logger.error('getSharedReport error', { message: err.message, stack: err.stack });
    return sendError(res, 'Failed to retrieve shared report: ' + err.message);
  }
};
