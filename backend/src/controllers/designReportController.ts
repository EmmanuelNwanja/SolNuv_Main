/**
 * SolNuv Design Report Controller
 * PDF/Excel/HTML report downloads and public share links
 */

const crypto = require('crypto');
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateDesignReportPdf: generatePdfkitPdf, generateDesignReportExcel, generateSharedReportPdf } = require('../services/designReportService');
const { buildExportPack } = require('../services/exportPackService');
const { computeDesignReportV2 } = require('../services/reportComputeService');
const logger = require('../utils/logger');

function isV2ReportsEnabled() {
  return String(process.env.REPORTS_V2_ENABLED || 'true').toLowerCase() !== 'false';
}

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
    .order('updated_at', { ascending: false })
    .limit(1)
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
 * GET /api/design-reports/:projectId/v2/json
 * Canonical typed report payload for bankable integrations.
 */
exports.getV2Json = async (req, res) => {
  const { projectId } = req.params;
  try {
    if (!isV2ReportsEnabled()) return sendError(res, 'V2 reports are currently disabled', 404);
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const result = await getLatestSimulationResult(projectId);
    if (!result) return sendError(res, 'No simulation results found. Run a simulation first.', 404);

    const report = await computeDesignReportV2(result.id);
    return sendSuccess(res, report, 'V2 report data retrieved');
  } catch (err) {
    logger.error('getV2Json error', {
      message: err.message,
      stack: err.stack,
      projectId,
      userId: req.user?.id,
    });
    return sendError(res, 'Failed to build V2 report');
  }
};

exports.downloadV2Pdf = async (req, res) => {
  const { projectId } = req.params;
  try {
    if (!isV2ReportsEnabled()) return sendError(res, 'V2 reports are currently disabled', 404);
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);
    const result = await getLatestSimulationResult(projectId);
    if (!result) return sendError(res, 'No simulation results found. Run a simulation first.', 404);

    // Compute payload eagerly so this endpoint guarantees full v2 traceability
    // even when rendering currently reuses the stable PDF generator.
    await computeDesignReportV2(result.id);
    const pdfBuffer = await generatePdfkitPdf(result.id);
    const filename = `SolNuv_Design_Report_V2_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('X-Solnuv-Report-Schema', '2.0.0');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    logger.error('downloadV2Pdf error', { message: err.message, stack: err.stack, projectId, userId: req.user?.id });
    return sendError(res, 'Failed to generate V2 PDF report');
  }
};

exports.downloadV2Excel = async (req, res) => {
  const { projectId } = req.params;
  try {
    if (!isV2ReportsEnabled()) return sendError(res, 'V2 reports are currently disabled', 404);
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);
    const result = await getLatestSimulationResult(projectId);
    if (!result) return sendError(res, 'No simulation results found', 404);

    await computeDesignReportV2(result.id);
    const buffer = await generateDesignReportExcel(result.id);
    const filename = `SolNuv_Design_Report_V2_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    res.setHeader('X-Solnuv-Report-Schema', '2.0.0');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    logger.error('downloadV2Excel error', { message: err.message, stack: err.stack, projectId, userId: req.user?.id });
    return sendError(res, 'Failed to generate V2 Excel report');
  }
};

/**
 * GET /api/design-reports/:projectId/pack
 * Download a reproducibility pack (ZIP) with PDF, Excel, and JSON inputs /
 * results / provenance. Pro+ plan.
 */
exports.downloadPack = async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const result = await getLatestSimulationResult(projectId);
    if (!result) return sendError(res, 'No simulation results found. Run a simulation first.', 404);

    const { buffer, filename } = await buildExportPack(result.id);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    logger.error('downloadPack error', {
      message: err.message,
      stack: err.stack,
      projectId,
      userId: req.user?.id,
    });
    return sendError(res, 'Failed to generate export pack: ' + err.message);
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

    const { data: importedReports } = await supabase
      .from('project_imported_design_reports')
      .select('id, source, file_name, file_public_url, report_label, created_at')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return sendSuccess(res, {
      project,
      design: result.project_designs,
      result: {
        ...result,
        project_designs: undefined, // Remove nested duplicate
      },
      tariff,
      imported_reports: importedReports || [],
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
      .order('updated_at', { ascending: false })
      .limit(1)
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

    // Get full design data with all fields
    const { data: fullDesign } = await supabase
      .from('project_designs')
      .select('*')
      .eq('id', design.id)
      .single();

    // Get project info with company
    const projectId = share.project_id || fullDesign?.project_id;
    let projectData = null;
    let tariffData = null;
    let loadProfileData = null;
    
    if (projectId) {
      const { data: project } = await supabase
        .from('projects')
        .select('*, companies(name, branding_primary_color, nesrea_registration_number, phone, email, website, address, city, state)')
        .eq('id', projectId)
        .single();
      projectData = project;
    }

    if (fullDesign?.load_profile_id) {
      const { data: lp } = await supabase
        .from('load_profiles')
        .select('source_type, annual_consumption_kwh, peak_demand_kw, load_factor, synthetic_priority_mode, synthetic_requested_peak_kw, synthetic_achieved_peak_kw, synthetic_requested_annual_kwh, synthetic_achieved_annual_kwh, synthetic_warnings')
        .eq('id', fullDesign.load_profile_id)
        .maybeSingle();
      loadProfileData = lp || null;
    }

    // Get tariff data
    if (fullDesign?.tariff_structure_id) {
      const { data: tariff } = await supabase
        .from('tariff_structures')
        .select('*, tariff_rates(*)')
        .eq('id', fullDesign.tariff_structure_id)
        .single();
      tariffData = tariff;
    }

    // Get equipment for brand info
    let equipmentData = null;
    if (projectId) {
      const { data: equipment } = await supabase
        .from('equipment')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_installed', true)
        .limit(20);
      equipmentData = equipment;
    }

    const { data: importedReports } = await supabase
      .from('project_imported_design_reports')
      .select('id, source, file_name, file_public_url, report_label, created_at')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return sendSuccess(res, {
      project: { 
        id: projectData?.id,
        name: projectData?.name || fullDesign?.project_name || 'Solar Project', 
        location: projectData?.location || projectData?.city || fullDesign?.location || 'N/A',
        address: projectData?.address,
        city: projectData?.city,
        state: projectData?.state,
        client_name: projectData?.client_name,
        client_email: projectData?.client_email,
        client_phone: projectData?.client_phone,
        installation_date: projectData?.installation_date,
        location_lat: fullDesign?.location_lat,
        location_lon: fullDesign?.location_lon,
        company: projectData?.companies?.name,
        company_address: projectData?.companies?.address,
        company_city: projectData?.companies?.city,
        company_state: projectData?.companies?.state,
        company_phone: projectData?.companies?.phone,
        company_email: projectData?.companies?.email,
        company_website: projectData?.companies?.website,
        nesrea_reg: projectData?.companies?.nesrea_registration_number,
      },
      design: {
        pv_technology: fullDesign?.pv_technology,
        pv_capacity_kwp: fullDesign?.pv_capacity_kwp,
        pv_tilt_deg: fullDesign?.pv_tilt_deg,
        pv_azimuth_deg: fullDesign?.pv_azimuth_deg,
        pv_system_losses_pct: fullDesign?.pv_system_losses_pct,
        pv_degradation_annual_pct: fullDesign?.pv_degradation_annual_pct,
        bess_capacity_kwh: fullDesign?.bess_capacity_kwh,
        bess_power_kw: fullDesign?.bess_power_kw,
        bess_dod_pct: fullDesign?.bess_dod_pct,
        bess_chemistry: fullDesign?.bess_chemistry,
        bess_dispatch_strategy: fullDesign?.bess_dispatch_strategy,
        bess_round_trip_efficiency: fullDesign?.bess_round_trip_efficiency,
        user_battery_max_discharge_kw: fullDesign?.user_battery_max_discharge_kw,
        user_pcs_power_kw: fullDesign?.user_pcs_power_kw,
        user_inverter_power_kw: fullDesign?.user_inverter_power_kw,
        capex_total: fullDesign?.capex_total,
        capex_breakdown: fullDesign?.capex_breakdown,
        discount_rate_pct: fullDesign?.discount_rate_pct,
        tariff_escalation_pct: fullDesign?.tariff_escalation_pct,
        analysis_period_years: fullDesign?.analysis_period_years,
        grid_topology: fullDesign?.grid_topology,
        installation_type: fullDesign?.installation_type,
        location_lat: fullDesign?.location_lat,
        location_lon: fullDesign?.location_lon,
      },
      tariff: tariffData ? {
        name: tariffData.tariff_name,
        utility: tariffData.utility_name,
        currency: tariffData.currency,
        rates: tariffData.tariff_rates,
      } : null,
      equipment: equipmentData,
      imported_reports: importedReports || [],
      result: {
        pv_capacity_kwp: result.pv_capacity_kwp,
        annual_solar_gen_kwh: result.annual_solar_gen_kwh,
        annual_generation_kwh: result.annual_solar_gen_kwh,
        solar_fraction: result.utilisation_pct,
        solar_utilised_kwh: result.solar_utilised_kwh,
        solar_exported_kwh: result.solar_exported_kwh,
        self_consumption_pct: result.self_consumption_pct,
        self_consumption_ratio: result.self_consumption_pct,
        utilisation_pct: result.utilisation_pct,
        annual_savings: result.year1_savings,
        year1_savings: result.year1_savings,
        simple_payback_years: result.simple_payback_months ? result.simple_payback_months / 12 : null,
        simple_payback_months: result.simple_payback_months,
        npv_25yr: result.npv_25yr,
        irr_pct: result.irr_pct,
        irr: result.irr_pct,
        lcoe_normal: result.lcoe_normal,
        lcoe: result.lcoe_normal,
        baseline_annual_cost: result.baseline_annual_cost,
        year1_annual_cost: result.year1_annual_cost,
        battery_discharged_kwh: result.battery_discharged_kwh,
        battery_charged_kwh: result.battery_charged_kwh,
        battery_cycles_annual: result.battery_cycles_annual,
        peak_demand_before_kw: result.peak_demand_before_kw,
        peak_demand_after_kw: result.peak_demand_after_kw,
        grid_import_kwh: result.grid_import_kwh,
        grid_export_kwh: result.grid_export_kwh,
        performance_ratio: result.performance_ratio,
        roi_pct: result.roi_pct,
        unmet_load_kwh: result.unmet_load_kwh,
        unmet_load_hours: result.unmet_load_hours,
        loss_of_load_pct: result.loss_of_load_pct,
        autonomy_achieved_days: result.autonomy_achieved_days,
        diesel_avoided_litres: result.diesel_avoided_litres,
        islanded_hours: result.islanded_hours,
        feed_in_revenue: result.feed_in_revenue,
        diesel_annual_cost: result.diesel_annual_cost,
        petrol_annual_cost: result.petrol_annual_cost,
        grid_only_annual_cost: result.grid_only_annual_cost,
        co2_avoided_tonnes: result.co2_avoided_tonnes,
        design_warnings: result.design_warnings,
        monthly_summary: result.monthly_summary,
        yearly_cashflow: result.yearly_cashflow,
        tou_breakdown: result.tou_breakdown,
        executive_summary_text: result.executive_summary_text,
        ai_expert_feedback: result.ai_expert_feedback,
        ai_feedback_edited: result.ai_feedback_edited,
        ai_feedback_generated_at: result.ai_feedback_generated_at,
        ai_feedback_text: result.ai_expert_feedback?.summary || result.ai_feedback_text || (typeof result.ai_expert_feedback === 'string' ? result.ai_expert_feedback : null),
        grid_topology: fullDesign?.grid_topology,
        analysis_period_years: fullDesign?.analysis_period_years,
        energy_comparison: (() => {
          let ec = result.energy_comparison;
          if (!ec) return null;
          if (typeof ec === 'string') {
            try { ec = JSON.parse(ec); } catch { return null; }
          }
          if (typeof ec !== 'object') return null;
          return ec;
        })(),
        load_profile_consistency:
          result?.extended_metrics?.load_profile_consistency ||
          (loadProfileData ? {
            source_type: loadProfileData.source_type || null,
            annual_consumption_kwh: loadProfileData.annual_consumption_kwh,
            peak_demand_kw: loadProfileData.peak_demand_kw,
            load_factor: loadProfileData.load_factor,
            priority_mode: loadProfileData.synthetic_priority_mode || null,
            requested_peak_kw: loadProfileData.synthetic_requested_peak_kw,
            achieved_peak_kw: loadProfileData.synthetic_achieved_peak_kw,
            requested_annual_kwh: loadProfileData.synthetic_requested_annual_kwh,
            achieved_annual_kwh: loadProfileData.synthetic_achieved_annual_kwh,
            warnings: Array.isArray(loadProfileData.synthetic_warnings) ? loadProfileData.synthetic_warnings : [],
          } : null),
      },
    }, 'Shared report retrieved');
  } catch (err) {
    logger.error('getSharedReport error', { message: err.message, stack: err.stack });
    return sendError(res, 'Failed to retrieve shared report: ' + err.message);
  }
};

exports.downloadSharedReportPdf = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return sendError(res, 'Share token is required', 400);
    }

    const pdfBuffer = await generateSharedReportPdf(token);

    const filename = `SolNuv_Design_Report_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (err) {
    logger.error('downloadSharedReportPdf error', { message: err.message, stack: err.stack });
    return sendError(res, 'Failed to generate PDF: ' + err.message);
  }
};

exports.uploadImportedDesignReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);
    if (!req.file) return sendError(res, 'File is required', 400);

    const maxBytes = 20 * 1024 * 1024;
    if (req.file.size > maxBytes) return sendError(res, 'File exceeds 20MB max size', 400);
    const name = String(req.file.originalname || '').toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.xls') && !name.endsWith('.xlsx')) {
      return sendError(res, 'Only PDF/Excel reports are supported', 400);
    }

    const path = `${projectId}/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    const { error: uploadErr } = await supabase.storage
      .from('design-report-imports')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        upsert: false,
      });
    if (uploadErr) {
      logger.error('uploadImportedDesignReport storage upload failed', { projectId, message: uploadErr.message });
      return sendError(res, 'Failed to upload report file', 500);
    }

    const { data: urlData } = supabase.storage.from('design-report-imports').getPublicUrl(path);
    const reportLabel = req.body?.report_label ? String(req.body.report_label).slice(0, 80) : 'imported';

    const { data, error } = await supabase
      .from('project_imported_design_reports')
      .insert({
        project_id: projectId,
        user_id: req.user.id,
        company_id: req.user.company_id || null,
        source: 'pvsyst',
        report_label: reportLabel,
        file_name: req.file.originalname,
        mime_type: req.file.mimetype || null,
        file_size_bytes: req.file.size || null,
        file_path: path,
        file_public_url: urlData?.publicUrl || null,
        parsed_summary: req.body?.summary && typeof req.body.summary === 'object' ? req.body.summary : null,
        is_active: true,
      })
      .select('id, project_id, source, report_label, file_name, file_public_url, created_at')
      .single();

    if (error) {
      logger.error('uploadImportedDesignReport DB insert failed', { projectId, message: error.message });
      return sendError(res, 'Failed to save imported report metadata', 500);
    }

    return sendSuccess(res, data, 'Imported design report uploaded', 201);
  } catch (err) {
    logger.error('uploadImportedDesignReport error', { message: err.message, stack: err.stack });
    return sendError(res, 'Failed to upload imported design report');
  }
};

exports.listImportedDesignReports = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const { data, error } = await supabase
      .from('project_imported_design_reports')
      .select('id, source, report_label, file_name, file_public_url, created_at, is_active')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) {
      logger.error('listImportedDesignReports error', { projectId, message: error.message });
      return sendError(res, 'Failed to fetch imported reports', 500);
    }
    return sendSuccess(res, data || [], 'Imported design reports retrieved');
  } catch (err) {
    logger.error('listImportedDesignReports exception', { message: err.message, stack: err.stack });
    return sendError(res, 'Failed to fetch imported reports');
  }
};
