/**
 * SolNuv Report Controller
 * NESREA EPR Compliance Reports + Cradle-to-Grave Certificates
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateNesreaReport, generateCradleToGraveCertificate } = require('../services/pdfService');
const { sendEmailWithAttachment, sendReportReadyEmail } = require('../services/emailService');
const { getSilverPrice } = require('../services/silverService');

/**
 * POST /api/reports/nesrea
 * Generate NESREA EPR Compliance Report (Pro+ only)
 * action: 'download' | 'send_to_nesrea'
 */
exports.generateNesrea = async (req, res) => {
  try {
    const { action = 'download', period_start, period_end } = req.body;
    const company = req.company;

    if (!company) return sendError(res, 'Company profile required for NESREA reports', 400);

    const startDate = period_start || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = period_end || new Date().toISOString().split('T')[0];

    // Fetch all company projects with equipment
    const { data: projects } = await supabase
      .from('projects')
      .select('*, equipment(*)')
      .eq('company_id', company.id)
      .gte('installation_date', startDate)
      .lte('installation_date', endDate);

    if (!projects || projects.length === 0) {
      return sendError(res, 'No projects found in the selected period. Add projects first.', 404);
    }

    // Calculate totals
    let totalPanels = 0, totalBatteries = 0, totalSilverGrams = 0;
    for (const proj of projects) {
      for (const eq of proj.equipment || []) {
        if (eq.equipment_type === 'panel') {
          totalPanels += eq.quantity;
          totalSilverGrams += eq.estimated_silver_grams || 0;
        } else totalBatteries += eq.quantity;
      }
    }

    const silverPrice = await getSilverPrice();

    const reportMeta = {
      period_start: startDate,
      period_end: endDate,
      total_panels: totalPanels,
      total_batteries: totalBatteries,
      total_silver_grams: totalSilverGrams,
      silver_price_ngn: silverPrice.price_per_gram_ngn,
    };

    // Generate PDF
    const pdfBuffer = await generateNesreaReport(company, projects, reportMeta);

    // Save report record
    const { data: reportRecord } = await supabase.from('nesrea_reports').insert({
      company_id: company.id,
      generated_by: req.user.id,
      report_period_start: startDate,
      report_period_end: endDate,
      total_panels: totalPanels,
      total_batteries: totalBatteries,
      total_silver_grams: totalSilverGrams,
      sent_to_nesrea: action === 'send_to_nesrea',
      sent_at: action === 'send_to_nesrea' ? new Date().toISOString() : null,
    }).select().single();

    if (action === 'send_to_nesrea') {
      // Send to NESREA email
      await sendEmailWithAttachment(
        process.env.NESREA_EMAIL || 'compliance@nesrea.gov.ng',
        `EPR Compliance Report — ${company.name}`,
        `<p>Please find attached the EPR Compliance Report from <strong>${company.name}</strong> (NESREA Reg: ${company.nesrea_registration_number || 'PENDING'}) for the period ${startDate} to ${endDate}. Generated via SolNuv Platform.</p>`,
        {
          filename: `NESREA_EPR_Report_${company.name.replace(/\s/g, '_')}_${endDate}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }
      );

      // Also send confirmation to company
      await sendReportReadyEmail(req.user, company, null);

      return sendSuccess(res, { report_id: reportRecord?.id, sent_to: process.env.NESREA_EMAIL }, 'Report successfully transmitted to NESREA');
    }

    // Stream PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SolNuv_NESREA_Report_${endDate}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('NESREA report error:', error);
    return sendError(res, 'Failed to generate report. Please try again.', 500);
  }
};

/**
 * GET /api/reports/certificate/:projectId
 * Generate Cradle-to-Grave Certificate for a single project (Pro+)
 */
exports.generateCertificate = async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: project } = await supabase
      .from('projects')
      .select('*, equipment(*), companies(*)')
      .eq('id', projectId)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);

    const company = project.companies || req.company || { name: req.user.brand_name || req.user.first_name };

    const pdfBuffer = await generateCradleToGraveCertificate(project, company);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SolNuv_Certificate_${project.name.replace(/\s/g, '_')}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Certificate error:', error);
    return sendError(res, 'Failed to generate certificate', 500);
  }
};

/**
 * GET /api/reports/history
 * List generated reports
 */
exports.getHistory = async (req, res) => {
  try {
    if (!req.user.company_id) return sendSuccess(res, []);

    const { data: reports } = await supabase
      .from('nesrea_reports')
      .select('*')
      .eq('company_id', req.user.company_id)
      .order('created_at', { ascending: false })
      .limit(20);

    return sendSuccess(res, reports || []);
  } catch (error) {
    return sendError(res, 'Failed to fetch report history', 500);
  }
};

/**
 * POST /api/reports/excel
 * Generate Excel export of all projects (Pro+)
 */
exports.generateExcel = async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const scopeFilter = req.user.company_id
      ? { field: 'company_id', value: req.user.company_id }
      : { field: 'user_id', value: req.user.id };

    const { data: projects } = await supabase
      .from('projects')
      .select('*, equipment(*)')
      .eq(scopeFilter.field, scopeFilter.value);

    const rows = [];
    for (const proj of projects || []) {
      const panels = proj.equipment?.filter(e => e.equipment_type === 'panel') || [];
      const batteries = proj.equipment?.filter(e => e.equipment_type === 'battery') || [];

      rows.push({
        'Project Name': proj.name,
        'Client': proj.client_name || 'N/A',
        'State': proj.state,
        'City': proj.city,
        'Installation Date': proj.installation_date,
        'Est. Decommission': proj.estimated_decommission_date || 'TBD',
        'Status': proj.status?.toUpperCase(),
        'Total Panels': panels.reduce((s, e) => s + e.quantity, 0),
        'Total Batteries': batteries.reduce((s, e) => s + e.quantity, 0),
        'Panel Brands': [...new Set(panels.map(e => e.brand))].join(', '),
        'Battery Brands': [...new Set(batteries.map(e => e.brand))].join(', '),
        'Est. Silver (g)': panels.reduce((s, e) => s + (e.estimated_silver_grams || 0), 0).toFixed(4),
        'Climate Zone': panels[0]?.climate_zone || 'N/A',
        'Notes': proj.notes || '',
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=SolNuv_Projects_${new Date().toISOString().split('T')[0]}.xlsx`);
    return res.send(buffer);
  } catch (error) {
    return sendError(res, 'Failed to generate Excel export', 500);
  }
};
