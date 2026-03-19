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
 */
async function generateCradleToGraveCertificate(project, company) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 70, right: 70 } });
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

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateNesreaReport, generateCradleToGraveCertificate };
