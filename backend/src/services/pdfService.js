/**
 * SolNuv PDF Service
 * Generates NESREA EPR Compliance Reports and Cradle-to-Grave Certificates
 */

const PDFDocument = require('pdfkit');
const { calculatePortfolioSilver } = require('./silverService');

// Brand colors
const COLORS = {
  primary: '#0D3B2E',
  secondary: '#F59E0B',
  accent: '#10B981',
  text: '#1E293B',
  muted: '#64748B',
  light: '#F1F5F9',
};

/**
 * Generate NESREA EPR Compliance Report PDF
 * @param {object} company - Company data
 * @param {array} projects - Array of projects with equipment
 * @param {object} reportMeta - Report period, stats
 * @returns {Buffer} - PDF buffer
 */
async function generateNesreaReport(company, projects, reportMeta) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        info: {
          Title: `NESREA EPR Compliance Report - ${company.name}`,
          Author: 'SolNuv Platform',
          Subject: 'Extended Producer Responsibility Report',
          Creator: 'SolNuv | solnuv.com',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // ============================
      // PAGE 1: COVER PAGE
      // ============================
      // Header bar
      doc.rect(0, 0, doc.page.width, 8).fill(COLORS.secondary);
      doc.rect(0, 8, doc.page.width, 130).fill(COLORS.primary);

      // Logo area
      doc.fillColor('#FFFFFF')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text('SolNuv', 60, 40);

      doc.fontSize(10).font('Helvetica')
        .text('Solar Waste Tracking, Recovery & Compliance Platform', 60, 72);

      doc.fontSize(9).fillColor(COLORS.secondary)
        .text('solnuv.com | compliance@solnuv.com', 60, 88);

      // Report title
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
        .text('National Environmental (Battery Control) &', 60, 120, { align: 'right' });

      doc.fontSize(16).fillColor(COLORS.secondary)
        .text('Extended Producer Responsibility (EPR) Compliance Report', 60, 145, { align: 'right' });

      doc.rect(0, 150, doc.page.width, 3).fill(COLORS.secondary);
      doc.moveDown(2);

      // Company info box
      doc.rect(60, 175, doc.page.width - 120, 150).fillAndStroke(COLORS.light, '#E2E8F0');

      doc.fillColor(COLORS.text).fontSize(12).font('Helvetica-Bold')
        .text('REPORTING ENTITY', 80, 190);

      const companyInfoY = 210;
      const infoItems = [
        ['Company Name:', company.name],
        ['NESREA Registration No.:', company.nesrea_registration_number || 'PENDING REGISTRATION'],
        ['Address:', `${company.city || ''}, ${company.state || ''}`],
        ['Email:', company.email],
        ['Subscription Tier:', company.subscription_plan?.toUpperCase()],
      ];

      infoItems.forEach((item, i) => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.muted)
          .text(item[0], 80, companyInfoY + (i * 22));
        doc.font('Helvetica').fillColor(COLORS.text)
          .text(item[1] || 'N/A', 250, companyInfoY + (i * 22));
      });

      // Report period box
      doc.rect(60, 340, doc.page.width - 120, 80).fillAndStroke('#FFF7ED', '#FED7AA');
      doc.fillColor(COLORS.primary).fontSize(11).font('Helvetica-Bold')
        .text('REPORT PERIOD', 80, 355);
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.text)
        .text(`${new Date(reportMeta.period_start).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })} — ${new Date(reportMeta.period_end).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}`, 80, 375);
      doc.fontSize(9).fillColor(COLORS.muted)
        .text(`Date of Issuance: ${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}`, 80, 395);

      // Key stats summary
      doc.fillColor(COLORS.primary).fontSize(13).font('Helvetica-Bold')
        .text('PORTFOLIO SUMMARY', 60, 445);

      const stats = [
        { label: 'Total Projects', value: projects.length, unit: '' },
        { label: 'Solar Panels', value: reportMeta.total_panels, unit: ' panels' },
        { label: 'Batteries', value: reportMeta.total_batteries, unit: ' units' },
        { label: 'Est. Silver (Total Fleet)', value: reportMeta.total_silver_grams?.toFixed(1) || '0', unit: 'g' },
      ];

      stats.forEach((stat, i) => {
        const x = 60 + (i * 115);
        doc.rect(x, 465, 105, 70).fillAndStroke(i % 2 === 0 ? COLORS.primary : COLORS.secondary, 'transparent');
        doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold')
          .text(`${stat.value}${stat.unit}`, x + 8, 480, { width: 89, align: 'center' });
        doc.fontSize(8).font('Helvetica')
          .text(stat.label, x + 8, 508, { width: 89, align: 'center' });
      });

      // Regulatory basis
      doc.rect(60, 555, doc.page.width - 120, 130).fillAndStroke('#F0FDF4', '#BBF7D0');
      doc.fillColor(COLORS.primary).fontSize(11).font('Helvetica-Bold')
        .text('REGULATORY BASIS', 80, 570);
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.text)
        .text('This report is generated in accordance with:', 80, 590);
      doc.fontSize(9).fillColor(COLORS.text)
        .text('• National Environmental (Electrical/Electronic Sector) Regulations (NESREA)', 80, 607)
        .text('• National Environmental (Battery Control) Regulations 2024', 80, 622)
        .text('• Extended Producer Responsibility (EPR) Guidelines for Solar PV Equipment', 80, 637)
        .text('• EPRON End-of-Life Accountability Framework', 80, 652);

      // Footer
      doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(8)
        .text('Generated by SolNuv Platform | solnuv.com | This report is for regulatory compliance purposes', 60, doc.page.height - 25);

      // ============================
      // PAGE 2: PROJECT DETAILS
      // ============================
      doc.addPage();

      // Page header
      doc.rect(0, 0, doc.page.width, 60).fill(COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
        .text('Cradle-to-Grave Traceability Report', 60, 20);
      doc.fontSize(10).font('Helvetica')
        .text(`${company.name} | NESREA Reg: ${company.nesrea_registration_number || 'N/A'}`, 60, 42);

      let yPos = 80;

      // Project table header
      doc.rect(60, yPos, doc.page.width - 120, 25).fill(COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
        .text('Project Name', 65, yPos + 8)
        .text('Location', 215, yPos + 8)
        .text('Panels', 310, yPos + 8)
        .text('Batteries', 360, yPos + 8)
        .text('Status', 420, yPos + 8)
        .text('Est. Decommission', 468, yPos + 8);

      yPos += 25;

      projects.forEach((proj, idx) => {
        if (yPos > doc.page.height - 100) {
          doc.addPage();
          yPos = 60;
        }

        const bgColor = idx % 2 === 0 ? '#FFFFFF' : COLORS.light;
        doc.rect(60, yPos, doc.page.width - 120, 35).fill(bgColor);

        const panels = proj.equipment?.filter(e => e.equipment_type === 'panel') || [];
        const batteries = proj.equipment?.filter(e => e.equipment_type === 'battery') || [];
        const totalPanels = panels.reduce((s, e) => s + e.quantity, 0);
        const totalBatteries = batteries.reduce((s, e) => s + e.quantity, 0);

        doc.fillColor(COLORS.text).fontSize(8.5).font('Helvetica')
          .text(proj.name?.substring(0, 22) || 'N/A', 65, yPos + 6, { width: 145 })
          .text(`${proj.city}, ${proj.state}`, 215, yPos + 6, { width: 90 })
          .text(totalPanels.toString(), 310, yPos + 6)
          .text(totalBatteries.toString(), 360, yPos + 6)
          .text(proj.status?.toUpperCase() || 'ACTIVE', 420, yPos + 6);

        const decommDate = proj.estimated_decommission_date
          ? new Date(proj.estimated_decommission_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })
          : 'Calculating...';
        doc.text(decommDate, 468, yPos + 6);

        // Silver value if panels exist
        if (panels.length > 0) {
          const totalSilver = panels.reduce((s, e) => s + (e.estimated_silver_grams || 0), 0);
          doc.fontSize(7.5).fillColor(COLORS.accent)
            .text(`Est. Silver: ${totalSilver.toFixed(2)}g | Route: Formal Hydrometallurgical Recovery`, 65, yPos + 22);
        }

        yPos += 37;
      });

      // ============================
      // PAGE 3: SILVER & COMPLIANCE
      // ============================
      doc.addPage();

      doc.rect(0, 0, doc.page.width, 60).fill(COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
        .text('Silver Recovery & Compliance Statement', 60, 20);
      doc.fontSize(10).font('Helvetica').text('Economic Value of Formal Recycling', 60, 42);

      yPos = 80;

      // Silver recovery section
      doc.fillColor(COLORS.primary).fontSize(13).font('Helvetica-Bold')
        .text('SILVER CONTENT ANALYSIS', 60, yPos);
      yPos += 20;

      doc.fontSize(10).font('Helvetica').fillColor(COLORS.text)
        .text('Based on research and industry data, silver represents approximately 47% of the reclaimable economic value of solar panels, despite constituting only 0.05% of panel mass. The following projections are based on a silver content of ~0.35mg per watt-peak (Wp) for crystalline silicon panels:', 60, yPos, { width: doc.page.width - 120, align: 'justify' });

      yPos += 60;

      // Recovery value table
      const recoveryData = [
        ['Total Estimated Silver', `${reportMeta.total_silver_grams?.toFixed(2) || 0}g`, 'Theoretical 100%'],
        ['Expected Formal Recovery (35%)', `${((reportMeta.total_silver_grams || 0) * 0.35).toFixed(2)}g`, 'At formal recycling'],
        ['Estimated Recovery Value', `₦${((reportMeta.total_silver_grams || 0) * 0.35 * (reportMeta.silver_price_ngn || 1555)).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`, 'At current silver price'],
        ['Value Lost to Informal Sector', '~₦0', 'Informal = metal burning'],
      ];

      recoveryData.forEach((row, i) => {
        const rowY = yPos + (i * 35);
        doc.rect(60, rowY, doc.page.width - 120, 30)
          .fillAndStroke(i % 2 === 0 ? COLORS.light : '#FFFFFF', '#E2E8F0');
        doc.fillColor(COLORS.text).fontSize(10).font('Helvetica-Bold')
          .text(row[0], 75, rowY + 9);
        doc.font('Helvetica').fillColor(COLORS.accent)
          .text(row[1], 350, rowY + 9);
        doc.fillColor(COLORS.muted).fontSize(8.5)
          .text(row[2], 450, rowY + 10);
      });

      yPos += 160;

      // Compliance declaration
      doc.rect(60, yPos, doc.page.width - 120, 140)
        .fillAndStroke('#FFF7ED', COLORS.secondary);

      doc.fillColor(COLORS.primary).fontSize(12).font('Helvetica-Bold')
        .text('COMPLIANCE DECLARATION', 80, yPos + 15);
      doc.fontSize(9.5).font('Helvetica').fillColor(COLORS.text)
        .text(`This organization hereby declares, under the National Environmental (Battery Control) Regulations 2024 and the Extended Producer Responsibility (EPR) guidelines administered by NESREA and EPRON, that all solar PV panels and batteries listed in this report are tracked from installation to end-of-life, and that all decommissioned equipment will be routed exclusively through certified formal recycling channels.`, 80, yPos + 40, { width: doc.page.width - 160, align: 'justify' });

      doc.fontSize(9).fillColor(COLORS.muted)
        .text(`Authorized by: ${company.name}`, 80, yPos + 110)
        .text(`Date: ${new Date().toLocaleDateString('en-NG')}`, 350, yPos + 110);

      // Footer for all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill(COLORS.primary);
        doc.fillColor('#FFFFFF').fontSize(7.5)
          .text(`SolNuv Platform | solnuv.com | Page ${i + 1} of ${range.count} | Generated ${new Date().toLocaleDateString('en-NG')}`, 60, doc.page.height - 22, { align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate individual project Cradle-to-Grave Certificate
 * @param {object} project
 * @param {object} company
 * @param {Array}  history  - project_history rows (oldest first)
 */
async function generateCradleToGraveCertificate(project, company, history = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 70, right: 70 }, bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Certificate border
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke(COLORS.primary);
      doc.rect(35, 35, doc.page.width - 70, doc.page.height - 70).stroke(COLORS.secondary);

      // Header
      doc.fillColor(COLORS.primary).fontSize(24).font('Helvetica-Bold')
        .text('CERTIFICATE OF COMPLIANCE', 0, 80, { align: 'center' });
      doc.fontSize(14).fillColor(COLORS.secondary)
        .text('Cradle-to-Grave Solar Equipment Traceability', 0, 112, { align: 'center' });
      doc.fontSize(9).fillColor(COLORS.muted)
        .text('Issued under NESREA EPR Framework & National Environmental (Battery Control) Regulations 2024', 0, 135, { align: 'center' });

      doc.rect(70, 155, doc.page.width - 140, 2).fill(COLORS.secondary);

      // Certificate body
      doc.fillColor(COLORS.text).fontSize(12).font('Helvetica-Bold')
        .text('This certifies that:', 70, 175);
      doc.fontSize(16).fillColor(COLORS.primary)
        .text(company.name?.toUpperCase(), 70, 198, { align: 'center' });

      doc.fontSize(11).font('Helvetica').fillColor(COLORS.text)
        .text('has registered and is tracking the following solar installation in compliance with Nigerian environmental regulations:', 70, 230, { align: 'center', width: doc.page.width - 140 });

      // Project details box
      doc.rect(70, 268, doc.page.width - 140, 200).fillAndStroke(COLORS.light, '#E2E8F0');

      const details = [
        ['Project Name', project.name],
        ['Location', `${project.city}, ${project.state}`],
        ['Installation Date', new Date(project.installation_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })],
        ['Est. Decommission (West African Adjusted)', project.estimated_decommission_date ? new Date(project.estimated_decommission_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' }) : 'Pending Calculation'],
        ['Total Panels', `${project.equipment?.filter(e => e.equipment_type === 'panel').reduce((s, e) => s + e.quantity, 0) || 0} panels`],
        ['Total Batteries', `${project.equipment?.filter(e => e.equipment_type === 'battery').reduce((s, e) => s + e.quantity, 0) || 0} units`],
        ['Intended Recycling Route', 'Certified Formal Hydrometallurgical Recovery'],
      ];

      details.forEach((item, i) => {
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(COLORS.muted)
          .text(item[0] + ':', 90, 282 + (i * 26));
        doc.font('Helvetica').fillColor(COLORS.text)
          .text(item[1] || 'N/A', 300, 282 + (i * 26));
      });

      // Certificate number
      const certNumber = `SNV-${project.id.substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
      doc.fillColor(COLORS.primary).fontSize(10).font('Helvetica-Bold')
        .text(`Certificate No: ${certNumber}`, 70, 490, { align: 'center' });

      doc.rect(70, 510, doc.page.width - 140, 2).fill(COLORS.secondary);

      // Signature area
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.text)
        .text('SolNuv Compliance Engine', 70, 530, { align: 'center' });
      doc.fontSize(8.5).fillColor(COLORS.muted)
        .text(`Issued: ${new Date().toLocaleDateString('en-NG')} | Valid for the declared project lifecycle`, 70, 548, { align: 'center' });

      doc.fontSize(7.5).fillColor(COLORS.muted)
        .text('This certificate is system-generated by SolNuv (solnuv.com) and represents a declaration of compliance under Nigerian law. Verify at solnuv.com/verify/' + certNumber, 70, 575, { align: 'center', width: doc.page.width - 140 });

      // ============================
      // PAGE 2: PROJECT HISTORY APPENDIX
      // ============================
      if (history && history.length > 0) {
        doc.addPage();

        doc.rect(0, 0, doc.page.width, 55).fill(COLORS.primary);
        doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
          .text('Project History — Appendix', 70, 18);
        doc.fontSize(9).font('Helvetica')
          .text(`${project.name} | ${history.length} event${history.length !== 1 ? 's' : ''}`, 70, 40);

        const CHANGE_LABELS = {
          project_created: 'Created',
          project_updated: 'Updated',
          equipment_added: 'Equipment Added',
          equipment_updated: 'Equipment Updated',
          equipment_removed: 'Equipment Removed',
        };

        let hy = 75;

        // Table header
        doc.rect(70, hy, doc.page.width - 140, 22).fill('#1E293B');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
          .text('Date', 75, hy + 7)
          .text('Event', 175, hy + 7)
          .text('Stage', 290, hy + 7)
          .text('Summary', 350, hy + 7)
          .text('By', 490, hy + 7);
        hy += 22;

        history.forEach((entry, idx) => {
          if (hy > doc.page.height - 80) {
            doc.addPage();
            hy = 60;
          }

          const rowH = 28;
          const bg = idx % 2 === 0 ? COLORS.light : '#FFFFFF';
          doc.rect(70, hy, doc.page.width - 140, rowH).fillAndStroke(bg, '#E2E8F0');

          const dateStr = entry.created_at
            ? new Date(entry.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
            : 'N/A';

          const label = CHANGE_LABELS[entry.change_type] || entry.change_type || '';
          const labelColor =
            entry.change_type === 'project_created' ? COLORS.accent :
            entry.change_type === 'equipment_removed' ? '#B91C1C' :
            COLORS.primary;

          doc.fillColor(COLORS.muted).fontSize(7.5).font('Helvetica')
            .text(dateStr, 75, hy + 9, { width: 95 });
          doc.fillColor(labelColor).font('Helvetica-Bold')
            .text(label, 175, hy + 9, { width: 110 });
          doc.fillColor(COLORS.muted).font('Helvetica')
            .text((entry.project_stage || '').toUpperCase(), 290, hy + 9, { width: 55 });
          doc.fillColor(COLORS.text)
            .text((entry.change_summary || '').substring(0, 60), 350, hy + 9, { width: 135 });
          doc.fillColor(COLORS.muted)
            .text((entry.actor_name || '').substring(0, 18), 490, hy + 9, { width: 70 });

          hy += rowH;
        });
      }

      // Footer on all pages
      const range2 = doc.bufferedPageRange();
      for (let i = 0; i < range2.count; i++) {
        doc.switchToPage(range2.start + i);
        doc.rect(0, doc.page.height - 30, doc.page.width, 30).fill(COLORS.primary);
        doc.fillColor('#FFFFFF').fontSize(7.5)
          .text(`SolNuv Platform | solnuv.com | Page ${i + 1} of ${range2.count} | Generated ${new Date().toLocaleDateString('en-NG')}`,
            70, doc.page.height - 18, { align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate localized hybrid ROI proposal PDF
 */
async function generateProposalPdf(payload, result) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 55, right: 55 } });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const title = 'Hybrid Solar Proposal & ROI Summary';
      const generated = new Date().toLocaleString('en-NG');

      doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
        .text(title, 55, 25);
      doc.fontSize(9).font('Helvetica')
        .text(`Generated: ${generated}`, 55, 55);

      let y = 95;
      doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-Bold')
        .text('Assumptions', 55, y);
      y += 18;

      const rows = [
        ['Tariff Band', String(payload.tariff_band || 'A')],
        ['Tariff Rate', `N${Number(payload.tariff_rate_ngn_per_kwh || 0).toLocaleString('en-NG')}/kWh`],
        ['Generator Fuel Price', `N${Number(payload.generator_fuel_price_ngn_per_liter || 0).toLocaleString('en-NG')}/L`],
        ['Grid Offset', `${Number(payload.projected_grid_kwh_offset_per_day || 0).toLocaleString('en-NG')} kWh/day`],
        ['Generator Offset', `${Number(payload.projected_generator_liters_offset_per_day || 0).toLocaleString('en-NG')} L/day`],
        ['Solar CAPEX', `N${Number(payload.proposed_solar_capex_ngn || 0).toLocaleString('en-NG')}`],
        ['Annual O&M', `N${Number(payload.annual_om_cost_ngn || 0).toLocaleString('en-NG')}`],
      ];

      rows.forEach((r, i) => {
        const rowY = y + (i * 24);
        doc.rect(55, rowY, doc.page.width - 110, 22).fill(i % 2 === 0 ? COLORS.light : '#FFFFFF');
        doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica-Bold').text(r[0], 65, rowY + 7);
        doc.fillColor(COLORS.text).font('Helvetica').text(r[1], 270, rowY + 7);
      });

      y += (rows.length * 24) + 20;
      doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-Bold').text('Investment Metrics', 55, y);
      y += 20;

      const metricCards = [
        { label: 'Payback', value: `${result?.investment_metrics?.payback_months ?? '-'} months` },
        { label: 'Annual Net Savings', value: `N${Number(result?.annual_savings?.net_ngn || 0).toLocaleString('en-NG')}` },
        { label: '10-Year Net Savings', value: `N${Number(result?.investment_metrics?.ten_year_net_savings_ngn || 0).toLocaleString('en-NG')}` },
        { label: '10-Year ROI', value: `${result?.investment_metrics?.ten_year_roi_pct ?? 0}%` },
      ];

      metricCards.forEach((m, i) => {
        const x = 55 + ((i % 2) * 250);
        const yy = y + (Math.floor(i / 2) * 80);
        doc.rect(x, yy, 235, 70).fillAndStroke('#F8FAFC', '#E2E8F0');
        doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold').text(m.label, x + 12, yy + 12);
        doc.fillColor(COLORS.primary).fontSize(16).font('Helvetica-Bold').text(m.value, x + 12, yy + 32, { width: 210 });
      });

      y += 180;
      doc.rect(55, y, doc.page.width - 110, 100).fillAndStroke('#ECFDF5', '#A7F3D0');
      doc.fillColor(COLORS.primary).fontSize(10).font('Helvetica-Bold').text('Proposal Notes', 70, y + 15);
      doc.fillColor(COLORS.text).fontSize(9).font('Helvetica')
        .text('This estimate is localized for African hybrid energy conditions, combining NERC tariff exposure and generator fuel displacement. Final economics depend on site load profile, component selection, and installation quality.', 70, y + 35, { width: doc.page.width - 140, align: 'justify' });

      doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill(COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(8).text('Generated by SolNuv Proposal Engine', 55, doc.page.height - 22);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate cable compliance certificate PDF
 */
async function generateCableComplianceCertificate(payload, result) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 60, right: 60 } });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const certRef = `CC-${Date.now()}`;

      doc.rect(0, 0, doc.page.width, 90).fill(COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
        .text('DC Cable Sizing Compliance Certificate', 60, 30);
      doc.fontSize(9).font('Helvetica')
        .text(`Certificate Ref: ${certRef}`, 60, 58)
        .text(`Date: ${new Date().toLocaleDateString('en-NG')}`, 430, 58);

      let y = 115;
      const inputs = [
        ['Current', `${payload.current_amps} A`],
        ['One-way Length', `${payload.one_way_length_m} m`],
        ['System Voltage', `${payload.system_voltage_v} V`],
        ['Allowable Voltage Drop', `${payload.allowable_voltage_drop_pct || 3}%`],
        ['Conductor Material', `${payload.conductor_material || 'copper'}`],
        ['Ambient Temperature', `${payload.ambient_temperature_c || 30} C`],
      ];

      doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-Bold').text('Input Parameters', 60, y);
      y += 20;
      inputs.forEach((item, i) => {
        const rowY = y + (i * 22);
        doc.rect(60, rowY, doc.page.width - 120, 20).fill(i % 2 === 0 ? COLORS.light : '#FFFFFF');
        doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica-Bold').text(item[0], 72, rowY + 6);
        doc.fillColor(COLORS.text).font('Helvetica').text(item[1], 300, rowY + 6);
      });

      y += (inputs.length * 22) + 25;
      doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-Bold').text('Computed Outputs', 60, y);
      y += 20;

      const cal = result?.calculations || {};
      const outputs = [
        ['Required Area', `${cal.required_area_mm2 ?? '-'} mm2`],
        ['Recommended Standard', `${cal.recommended_standard_mm2 ?? '-'} mm2`],
        ['Predicted Voltage Drop', `${cal.predicted_voltage_drop_v ?? '-'} V`],
        ['Predicted Drop Percentage', `${cal.predicted_voltage_drop_pct ?? '-'}%`],
        ['Compliance Status', cal.compliant ? 'PASS' : 'FAIL'],
      ];

      outputs.forEach((item, i) => {
        const rowY = y + (i * 24);
        doc.rect(60, rowY, doc.page.width - 120, 22).fill(i % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
        doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica-Bold').text(item[0], 72, rowY + 7);
        const statusColor = item[0] === 'Compliance Status'
          ? (cal.compliant ? '#047857' : '#B91C1C')
          : COLORS.primary;
        doc.fillColor(statusColor).font('Helvetica-Bold').text(item[1], 300, rowY + 7);
      });

      y += (outputs.length * 24) + 30;
      doc.rect(60, y, doc.page.width - 120, 110).fillAndStroke('#FFF7ED', '#FED7AA');
      doc.fillColor(COLORS.primary).fontSize(10).font('Helvetica-Bold').text('Engineering Statement', 75, y + 14);
      doc.fillColor(COLORS.text).fontSize(9).font('Helvetica')
        .text('This certificate documents the DC cable sizing calculation for field installation quality assurance. Validate all final selections against applicable site constraints, insulation ratings, and local code requirements.', 75, y + 34, { width: doc.page.width - 150, align: 'justify' });

      doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill(COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(8).text('Generated by SolNuv Field Compliance Engine', 60, doc.page.height - 22);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateNesreaReport,
  generateCradleToGraveCertificate,
  generateProposalPdf,
  generateCableComplianceCertificate,
};
