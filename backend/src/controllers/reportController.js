/**
 * SolNuv Report Controller
 * NESREA EPR Compliance Reports + Cradle-to-Grave Certificates
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { generateNesreaReportPdf, generateCertificatePdf } = require('../services/puppeteerPdfService');
const { sendEmailWithAttachment, sendReportReadyEmail } = require('../services/emailService');
const { getSilverPrice } = require('../services/silverService');
const logger = require('../utils/logger');

/** Build template data for NESREA Report PDF */
async function buildNesreaReportData(company, projects, reportMeta) {
  const recoverySilver = (reportMeta.total_silver_grams * 0.35).toFixed(2);
  const recoveryValue = (reportMeta.total_silver_grams * 0.35 * (reportMeta.silver_price_ngn || 1555)).toLocaleString('en-NG');

  const projectRows = projects.map(proj => {
    const panels = (proj.equipment || []).filter(e => e.equipment_type === 'panel');
    const batteries = (proj.equipment || []).filter(e => e.equipment_type === 'battery');
    return {
      name: proj.name || '—',
      location: [proj.city, proj.state].filter(Boolean).join(', ') || '—',
      panels: panels.reduce((s, e) => s + (e.quantity || 0), 0),
      batteries: batteries.reduce((s, e) => s + (e.quantity || 0), 0),
      status: (proj.status || 'active').toUpperCase(),
      decommDate: proj.estimated_decommission_date
        ? new Date(proj.estimated_decommission_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })
        : 'TBD',
    };
  });

  return {
    companyName: company?.name || '—',
    nesreaRegNumber: company?.nesrea_registration_number || 'PENDING REGISTRATION',
    companyAddress: [company?.city, company?.state].filter(Boolean).join(', ') || '—',
    subscriptionTier: (company?.subscription_plan || 'free').toUpperCase(),

    periodStart: new Date(reportMeta.period_start).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }),
    periodEnd: new Date(reportMeta.period_end).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }),
    issueDate: new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }),

    totalProjects: projects.length,
    totalPanels: reportMeta.total_panels,
    totalBatteries: reportMeta.total_batteries,
    totalSilver: (reportMeta.total_silver_grams || 0).toFixed(2),
    recoverySilver,
    recoveryValue,
    silverPrice: (reportMeta.silver_price_ngn || 1555).toLocaleString('en-NG'),

    projects: projectRows,
  };
}

/** Build template data for Certificate PDF */
async function buildCertificateData(project, company) {
  const panels = (project.equipment || []).filter(e => e.equipment_type === 'panel');
  const batteries = (project.equipment || []).filter(e => e.equipment_type === 'battery');

  return {
    companyName: company?.name || '—',
    projectName: project.name || '—',
    location: [project.city, project.state].filter(Boolean).join(', ') || '—',
    installationDate: project.installation_date
      ? new Date(project.installation_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—',
    decommissionDate: project.estimated_decommission_date
      ? new Date(project.estimated_decommission_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })
      : 'Pending Calculation',
    totalPanels: panels.reduce((s, e) => s + (e.quantity || 0), 0),
    totalBatteries: batteries.reduce((s, e) => s + (e.quantity || 0), 0),
    certNumber: `SNV-${(project.id || '').substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`,
    issueDate: new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

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

    // Fetch all company projects with equipment (including orphaned projects created before user had a company)
    const { data: projects } = await supabase
      .from('projects')
      .select('*, equipment(*)')
      .or(`company_id.eq.${company.id},and(user_id.eq.${req.user.id},company_id.is.null)`)
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

    // Build template data and generate PDF using Puppeteer
    const templateData = await buildNesreaReportData(company, projects, reportMeta);
    const pdfBuffer = await generateNesreaReportPdf(templateData);

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
    logger.error('NESREA report error:', { message: error.message, stack: error.stack, userId: req.user?.id });
    return sendError(res, 'Failed to generate NESREA report: ' + error.message, 500);
  }
};

/**
 * GET /api/reports/certificate/:projectId
 * Generate Cradle-to-Grave Certificate for a single project (Pro+)
 */
exports.generateCertificate = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    let projectQuery = supabase
      .from('projects')
      .select('*, equipment(*), companies:companies!projects_company_id_fkey(*)')
      .eq('id', projectId);

    if (companyId) {
      projectQuery = projectQuery.or(`company_id.eq.${companyId},and(user_id.eq.${userId},company_id.is.null)`);
    } else {
      projectQuery = projectQuery.eq('user_id', userId);
    }

    const { data: project } = await projectQuery.maybeSingle();

    if (!project) return sendError(res, 'Project not found', 404);

    const company = project.companies || req.company || { name: req.user.brand_name || req.user.first_name };

    // Build template data and generate PDF using Puppeteer
    const templateData = await buildCertificateData(project, company);
    const pdfBuffer = await generateCertificatePdf(templateData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SolNuv_Certificate_${project.name.replace(/\s/g, '_')}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    logger.error('Certificate generation failed', { user_id: req.user?.id || null, project_id: req.params?.projectId || null, message: error.message, stack: error.stack });
    return sendError(res, 'Failed to generate certificate: ' + error.message, 500);
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
    logger.error('Failed to fetch report history', { user_id: req.user?.id || null, company_id: req.user?.company_id || null, message: error.message });
    return sendError(res, 'Failed to fetch report history', 500);
  }
};

/**
 * POST /api/reports/excel
 * Generate Excel export of all projects (Pro+)
 */
exports.generateExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const userId = req.user.id;
    const companyId = req.user.company_id;

    let projectsQuery = supabase
      .from('projects')
      .select('*, equipment(*)');

    if (companyId) {
      projectsQuery = projectsQuery.or(`company_id.eq.${companyId},and(user_id.eq.${userId},company_id.is.null)`);
    } else {
      projectsQuery = projectsQuery.eq('user_id', userId);
    }

    const { data: projects } = await projectsQuery;

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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Projects');

    if (rows.length > 0) {
      worksheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: Math.max(16, key.length + 2) }));
      rows.forEach((row) => worksheet.addRow(row));
      worksheet.getRow(1).font = { bold: true };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    } else {
      worksheet.columns = [{ header: 'Message', key: 'message', width: 40 }];
      worksheet.addRow({ message: 'No projects found' });
    }

    // History sheet
    const { data: allHistory } = await supabase
      .from('project_history')
      .select('project_id, change_type, change_summary, project_stage, actor_name, created_at')
      .in('project_id', (projects || []).map(p => p.id))
      .order('created_at', { ascending: true });

    const historySheet = workbook.addWorksheet('Project History');
    historySheet.columns = [
      { header: 'Date', key: 'date', width: 22 },
      { header: 'Project', key: 'project', width: 30 },
      { header: 'Change Type', key: 'change_type', width: 22 },
      { header: 'Summary', key: 'summary', width: 50 },
      { header: 'Stage', key: 'stage', width: 16 },
      { header: 'By', key: 'actor', width: 24 },
    ];
    historySheet.getRow(1).font = { bold: true };

    const projectNameMap = {};
    (projects || []).forEach(p => { projectNameMap[p.id] = p.name; });

    (allHistory || []).forEach(h => {
      historySheet.addRow({
        date: h.created_at ? new Date(h.created_at).toLocaleString('en-NG') : '',
        project: projectNameMap[h.project_id] || h.project_id,
        change_type: h.change_type,
        summary: h.change_summary || '',
        stage: h.project_stage || '',
        actor: h.actor_name || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=SolNuv_Projects_${new Date().toISOString().split('T')[0]}.xlsx`);
    return res.send(buffer);
  } catch (error) {
    logger.error('Failed to generate Excel export', { user_id: req.user?.id || null, company_id: req.user?.company_id || null, message: error.message });
    return sendError(res, 'Failed to generate Excel export', 500);
  }
};
