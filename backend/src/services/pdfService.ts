/**
 * SolNuv PDF Service
 * Generates NESREA EPR Compliance Reports, Cradle-to-Grave Certificates,
 * ROI Proposals, and Cable Compliance Certificates.
 *
 * All PDFs are branded with the company's logo, primary colour, and signature
 * when those assets are stored in the company profile (logo_url,
 * branding_primary_color, company_signature_url).
 */

const PDFDocument = require('pdfkit');
const axios = require('axios');

// ─── Default SolNuv brand colours ────────────────────────────────────────────
const DEFAULT_BRAND = {
  primary: '#0D3B2E',
  secondary: '#F59E0B',
  accent: '#10B981',
  text: '#1E293B',
  muted: '#64748B',
  light: '#F1F5F9',
  white: '#FFFFFF',
};

/**
 * Build a brand colour palette merging company overrides with SolNuv defaults.
 * @param {object} company
 */
function buildBrand(company) {
  const primary = (company?.branding_primary_color || DEFAULT_BRAND.primary).trim();
  return { ...DEFAULT_BRAND, primary };
}

/**
 * Fetch an image URL and return a Buffer, or null on failure.
 * @param {string|null} url
 */
async function fetchImageBuffer(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
    });
    return Buffer.from(response.data);
  } catch {
    return null;
  }
}

/** Draw a horizontal rule */
function hRule(doc, x, y, w, color) {
  doc.save().rect(x, y, w, 1.5).fill(color).restore();
}

/** Draw a small decorative diamond accent */
function diamond(doc, cx, cy, size, color) {
  doc.save()
    .moveTo(cx, cy - size)
    .lineTo(cx + size, cy)
    .lineTo(cx, cy + size)
    .lineTo(cx - size, cy)
    .closePath()
    .fill(color)
    .restore();
}

function estimateEprMilestones(project: any = {}) {
  const installDate = project.installation_date ? new Date(project.installation_date) : new Date();
  const panelLifespanYears = 25;
  const inverterLifespanYears = 12;
  const batteryLifespanYears = 8;
  const panelEol = new Date(installDate);
  panelEol.setFullYear(panelEol.getFullYear() + panelLifespanYears);
  const inverterEol = new Date(installDate);
  inverterEol.setFullYear(inverterEol.getFullYear() + inverterLifespanYears);
  const batteryEol = new Date(installDate);
  batteryEol.setFullYear(batteryEol.getFullYear() + batteryLifespanYears);
  return {
    installDate,
    panelEol,
    inverterEol,
    batteryEol,
  };
}

/**
 * Render a branded page header bar.
 * Returns the Y position immediately after the header.
 */
function renderPageHeader(doc, brand, title, subtitle, logoBuffer) {
  const W = doc.page.width;

  doc.rect(0, 0, W, 70).fill(brand.primary);
  doc.rect(0, 0, W, 5).fill(brand.secondary);

  let logoEndX = 20;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 20, 10, { height: 48, fit: [120, 48] });
      logoEndX = 150;
    } catch { /* ignore bad image */ }
  } else {
    doc.fillColor(brand.white).fontSize(20).font('Helvetica-Bold').text('SolNuv', 20, 22);
    doc.fillColor(brand.secondary).fontSize(7).font('Helvetica').text('Solar Waste & Compliance', 20, 46);
    logoEndX = 145;
  }

  doc.save().rect(logoEndX + 8, 12, 1, 44).fill(brand.secondary).restore();

  const titleX = logoEndX + 22;
  doc.fillColor(brand.white).fontSize(14).font('Helvetica-Bold')
    .text(title, titleX, 18, { width: W - titleX - 20 });
  if (subtitle) {
    doc.fillColor(brand.secondary).fontSize(8).font('Helvetica')
      .text(subtitle, titleX, 39, { width: W - titleX - 20 });
  }

  doc.rect(0, 65, W, 5).fill(brand.secondary);
  return 82;
}

/**
 * Render footer bars on all buffered pages.
 */
function renderFooters(doc, brand, totalPages) {
  const W = doc.page.width;
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const footerY = doc.page.height - 28;
    doc.rect(0, footerY, W, 28).fill(brand.primary);
    doc.fillColor(brand.secondary).fontSize(7).font('Helvetica-Bold')
      .text(`Page ${i + 1} of ${totalPages}`, W - 80, footerY + 9, { width: 68, align: 'right' });
    doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica')
      .text(
        `SolNuv Compliance Platform  •  solnuv.com  •  Generated ${new Date().toLocaleDateString('en-NG')}`,
        0, footerY + 9, { align: 'center', width: W }
      );
    doc.rect(0, footerY, 4, 28).fill(brand.secondary);
  }
}

/**
 * Generate NESREA EPR Compliance Report PDF
 * @param {object} company - Company data (must include logo_url, branding_primary_color, company_signature_url)
 * @param {array}  projects - Array of projects with equipment
 * @param {object} reportMeta - Report period, stats
 * @returns {Promise<Buffer>}
 */
async function generateNesreaReport(company, projects, reportMeta) {
  const brand = buildBrand(company);
  const [logoBuffer, sigBuffer] = await Promise.all([
    fetchImageBuffer(company?.logo_url),
    fetchImageBuffer(company?.company_signature_url),
  ]);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        bufferPages: true,
        info: {
          Title: `NESREA EPR Compliance Report — ${company?.name || 'Company'}`,
          Author: 'SolNuv Platform',
          Subject: 'Extended Producer Responsibility Report',
          Creator: 'SolNuv | solnuv.com',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const W = doc.page.width;
      const L = 55;
      const contentW = W - 2 * L;

      // ── PAGE 1: COVER ─────────────────────────────────────────────
      let y = renderPageHeader(
        doc, brand,
        'National Environmental (Battery Control) & EPR Compliance Report',
        'Extended Producer Responsibility — SolNuv Platform',
        logoBuffer
      );
      y += 14;

      // Reporting Entity
      doc.fillColor(brand.primary).fontSize(8).font('Helvetica-Bold').text('REPORTING ENTITY', L, y);
      hRule(doc, L, y + 12, contentW, brand.secondary);
      y += 18;

      doc.rect(L, y, contentW, 138).fillAndStroke(brand.light, '#CBD5E1');
      const entityFields = [
        ['Company Name',       company?.name || '—'],
        ['NESREA Reg. No.',    company?.nesrea_registration_number || 'PENDING REGISTRATION'],
        ['Address',           [company?.city, company?.state].filter(Boolean).join(', ') || '—'],
        ['Email',             company?.email || '—'],
        ['Subscription Tier', (company?.subscription_plan || 'free').toUpperCase()],
        ['Website',           company?.website || '—'],
      ];
      entityFields.forEach(([label, value], i) => {
        const fy = y + 10 + i * 21;
        doc.fillColor(brand.muted).fontSize(8).font('Helvetica-Bold').text(label + ':', L + 12, fy);
        doc.fillColor(brand.text).font('Helvetica').text(String(value), L + 165, fy);
      });
      y += 148;

      // Report period
      doc.rect(L, y, contentW, 58).fillAndStroke('#FFF7ED', '#FED7AA');
      diamond(doc, L + 14, y + 29, 5, brand.secondary);
      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold').text('REPORT PERIOD', L + 26, y + 12);
      const ps = new Date(reportMeta.period_start).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
      const pe = new Date(reportMeta.period_end).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.fillColor(brand.text).fontSize(10).font('Helvetica-Bold').text(`${ps} — ${pe}`, L + 26, y + 28);
      doc.fillColor(brand.muted).fontSize(8).font('Helvetica')
        .text(`Issued: ${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}`, L + 26, y + 43);
      y += 70;

      // Portfolio summary cards
      doc.fillColor(brand.primary).fontSize(8).font('Helvetica-Bold').text('PORTFOLIO SUMMARY', L, y);
      hRule(doc, L, y + 12, contentW, brand.secondary);
      y += 20;

      const statCards = [
        { label: 'Total Projects',      value: String(projects.length) },
        { label: 'Solar Panels',        value: `${reportMeta.total_panels || 0} panels` },
        { label: 'Battery Units',       value: `${reportMeta.total_batteries || 0} units` },
        { label: 'Est. Silver (Fleet)', value: `${(reportMeta.total_silver_grams || 0).toFixed(1)}g` },
      ];
      const cardW = Math.floor(contentW / 4) - 4;
      statCards.forEach((s, i) => {
        const cx = L + i * (cardW + 5);
        const fill = i % 2 === 0 ? brand.primary : brand.secondary;
        doc.rect(cx, y, cardW, 64).fill(fill);
        doc.rect(cx, y, cardW, 3).fill(i % 2 === 0 ? brand.secondary : brand.primary);
        doc.fillColor('#FFFFFF').fontSize(17).font('Helvetica-Bold')
          .text(s.value, cx + 4, y + 14, { width: cardW - 8, align: 'center' });
        doc.fontSize(7.5).font('Helvetica')
          .text(s.label, cx + 4, y + 44, { width: cardW - 8, align: 'center' });
      });
      y += 76;

      // Regulatory basis
      doc.rect(L, y, contentW, 108).fillAndStroke('#F0FDF4', '#BBF7D0');
      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold').text('REGULATORY BASIS', L + 14, y + 14);
      doc.fillColor(brand.text).fontSize(8.5).font('Helvetica').text('This report is prepared in accordance with:', L + 14, y + 31);
      ['• National Environmental (Electrical/Electronic Sector) Regulations (NESREA)',
       '• National Environmental (Battery Control) Regulations 2024',
       '• Extended Producer Responsibility (EPR) Guidelines for Solar PV Equipment',
       '• EPRON End-of-Life Accountability Framework',
      ].forEach((r, i) => {
        doc.fillColor(brand.text).fontSize(8).font('Helvetica').text(r, L + 14, y + 47 + i * 14);
      });

      // ── PAGE 2: TRACEABILITY ──────────────────────────────────────
      doc.addPage();
      let y2 = renderPageHeader(
        doc, brand,
        'Cradle-to-Grave Traceability Report',
        `${company?.name || '—'}  •  NESREA Reg: ${company?.nesrea_registration_number || 'N/A'}`,
        logoBuffer
      );
      y2 += 10;

      const colX = [L, L + 150, L + 255, L + 303, L + 358, L + 410];
      const colW = [145, 100, 44, 52, 49, contentW - (colX[5] - L)];
      doc.rect(L, y2, contentW, 24).fill(brand.primary);
      ['Project Name', 'Location', 'Panels', 'Batteries', 'Status', 'Est. Decomm.'].forEach((h, i) => {
        doc.fillColor(brand.white).fontSize(8).font('Helvetica-Bold')
          .text(h, colX[i] + 3, y2 + 8, { width: colW[i] - 6 });
      });
      y2 += 24;

      projects.forEach((proj, idx) => {
        if (y2 > doc.page.height - 80) {
          doc.addPage();
          y2 = renderPageHeader(doc, brand, 'Traceability Report (cont.)', null, logoBuffer) + 10;
        }
        const panels = (proj.equipment || []).filter(e => e.equipment_type === 'panel');
        const batteries = (proj.equipment || []).filter(e => e.equipment_type === 'battery');
        const totalPanels = panels.reduce((s, e) => s + (e.quantity || 0), 0);
        const totalBatteries = batteries.reduce((s, e) => s + (e.quantity || 0), 0);
        const totalSilver = panels.reduce((s, e) => s + (e.estimated_silver_grams || 0), 0);
        const rowH = totalPanels > 0 ? 36 : 26;

        doc.rect(L, y2, contentW, rowH).fill(idx % 2 === 0 ? '#FFFFFF' : brand.light);
        doc.rect(L, y2, 3, rowH).fill(idx % 2 === 0 ? brand.secondary : brand.primary);

        const ry = y2 + 7;
        doc.fillColor(brand.text).fontSize(8).font('Helvetica-Bold')
          .text((proj.name || '').substring(0, 24), colX[0] + 6, ry, { width: colW[0] - 9 });
        doc.font('Helvetica').fontSize(7.5)
          .text([proj.city, proj.state].filter(Boolean).join(', '), colX[1] + 3, ry, { width: colW[1] - 6 })
          .text(String(totalPanels), colX[2] + 3, ry)
          .text(String(totalBatteries), colX[3] + 3, ry);

        const statusColor = proj.status === 'active' ? brand.accent
          : proj.status === 'decommissioned' ? '#B45309' : brand.muted;
        doc.fillColor(statusColor).fontSize(7).font('Helvetica-Bold')
          .text((proj.status || '').toUpperCase(), colX[4] + 3, ry, { width: colW[4] - 6 });

        const dDate = proj.estimated_decommission_date
          ? new Date(proj.estimated_decommission_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })
          : 'TBD';
        doc.fillColor(brand.text).fontSize(7.5).font('Helvetica')
          .text(dDate, colX[5] + 3, ry, { width: colW[5] - 6 });

        if (totalPanels > 0) {
          doc.fillColor(brand.accent).fontSize(7).font('Helvetica')
            .text(`Est. Silver: ${totalSilver.toFixed(2)}g  •  Route: Formal Hydrometallurgical Recovery`, colX[0] + 6, y2 + 22, { width: contentW - 12 });
        }
        doc.rect(L, y2 + rowH - 0.5, contentW, 0.5).fill('#E2E8F0');
        y2 += rowH;
      });

      // ── PAGE 3: SILVER RECOVERY & COMPLIANCE ─────────────────────
      doc.addPage();
      let y3 = renderPageHeader(
        doc, brand,
        'Silver Recovery & Compliance Statement',
        'Economic Value of Formal End-of-Life Recycling',
        logoBuffer
      );
      y3 += 14;

      doc.fillColor(brand.primary).fontSize(8.5).font('Helvetica-Bold').text('SILVER CONTENT ANALYSIS', L, y3);
      hRule(doc, L, y3 + 12, contentW, brand.secondary);
      y3 += 22;

      doc.fillColor(brand.text).fontSize(9).font('Helvetica')
        .text(
          'Silver constitutes ~47% of the reclaimable economic value of crystalline silicon panels despite being only ~0.05% of ' +
          'panel mass. Projections use a silver content of ~0.35 mg per watt-peak (Wp).',
          L, y3, { width: contentW, align: 'justify' }
        );
      y3 += 36;

      const silverGrams = reportMeta.total_silver_grams || 0;
      const silverPrice = reportMeta.silver_price_ngn || 1555;
      const recoveryRows = [
        ['Total Estimated Silver',        `${silverGrams.toFixed(2)} g`,    '100% theoretical'],
        ['Expected Formal Recovery (35%)',`${(silverGrams * 0.35).toFixed(2)} g`, 'Certified recyclers'],
        ['Estimated Recovery Value',      `₦${(silverGrams * 0.35 * silverPrice).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`, `@ ₦${silverPrice.toLocaleString('en-NG')}/g`],
        ['Lost to Informal Sector',       '~₦0',                            'Informal = metal burning'],
      ];
      recoveryRows.forEach((row, i) => {
        const ry = y3 + i * 34;
        doc.rect(L, ry, contentW, 30).fillAndStroke(i % 2 === 0 ? brand.light : '#FFFFFF', '#E2E8F0');
        doc.rect(L, ry, 4, 30).fill(i === 0 ? brand.primary : i === 2 ? brand.secondary : brand.muted);
        doc.fillColor(brand.text).fontSize(9).font('Helvetica-Bold').text(row[0], L + 12, ry + 9, { width: 230 });
        doc.fillColor(brand.accent).font('Helvetica-Bold').fontSize(10).text(row[1], L + 250, ry + 9, { width: 130 });
        doc.fillColor(brand.muted).font('Helvetica').fontSize(7.5).text(row[2], L + 390, ry + 10, { width: contentW - 390 });
      });
      y3 += 150;

      // Compliance declaration
      doc.rect(L, y3, contentW, 145).fillAndStroke('#FFF7ED', brand.secondary);
      doc.rect(L, y3, 5, 145).fill(brand.secondary);
      doc.fillColor(brand.primary).fontSize(10).font('Helvetica-Bold').text('COMPLIANCE DECLARATION', L + 16, y3 + 16);
      hRule(doc, L + 16, y3 + 32, contentW - 32, brand.secondary);
      doc.fillColor(brand.text).fontSize(8.5).font('Helvetica')
        .text(
          'This organisation hereby declares, under the National Environmental (Battery Control) Regulations 2024 and the ' +
          'Extended Producer Responsibility (EPR) guidelines administered by NESREA and EPRON, that all solar PV panels and ' +
          'batteries listed in this report are tracked from installation to end-of-life, and that all decommissioned equipment ' +
          'will be routed exclusively through EPRON-certified formal recycling channels.',
          L + 16, y3 + 42, { width: contentW - 32, align: 'justify' }
        );

      const sigY = y3 + 100;
      if (sigBuffer) {
        try { doc.image(sigBuffer, L + 16, sigY - 28, { height: 28, fit: [110, 28] }); } catch { /* skip */ }
      }
      hRule(doc, L + 16, sigY, 150, brand.muted);
      doc.fillColor(brand.muted).fontSize(7.5).font('Helvetica')
        .text(`Authorised by: ${company?.name || '—'}`, L + 16, sigY + 5);
      hRule(doc, L + 316, sigY, 150, brand.muted);
      doc.text(`Date: ${new Date().toLocaleDateString('en-NG')}`, L + 316, sigY + 5);

      const totalPages = doc.bufferedPageRange().count;
      renderFooters(doc, brand, totalPages);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate individual project Cradle-to-Grave Certificate
 * @param {object} project
 * @param {object} company  (must include logo_url, branding_primary_color, company_signature_url)
 * @param {Array}  history  - project_history rows (oldest first)
 */
async function generateCradleToGraveCertificate(project, company, history = []) {
  const brand = buildBrand(company);
  const [logoBuffer, sigBuffer] = await Promise.all([
    fetchImageBuffer(company?.logo_url),
    fetchImageBuffer(company?.company_signature_url),
  ]);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 55, bottom: 55, left: 65, right: 65 },
        bufferPages: true,
      });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const W = doc.page.width;
      const L = 65;
      const contentW = W - 2 * L;
      const certNumber = `SNV-${(project.id || '').substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`;

      // Outer decorative border
      doc.rect(25, 25, W - 50, doc.page.height - 50).stroke(brand.primary);
      doc.rect(30, 30, W - 60, doc.page.height - 60).stroke(brand.secondary);
      doc.rect(30, 30, W - 60, 6).fill(brand.secondary); // gold top band

      // Company logo centred above title
      let logoRenderH = 0;
      if (logoBuffer) {
        try {
          const logoW = 90;
          doc.image(logoBuffer, (W - logoW) / 2, 50, { width: logoW, fit: [logoW, 50] });
          logoRenderH = 58;
        } catch { /* skip */ }
      }

      const titleY = 52 + logoRenderH;
      doc.fillColor(brand.primary).fontSize(20).font('Helvetica-Bold')
        .text('CERTIFICATE OF COMPLIANCE', 0, titleY, { align: 'center' });
      doc.fillColor(brand.secondary).fontSize(11).font('Helvetica-Bold')
        .text('Cradle-to-Grave Solar Equipment Traceability', 0, titleY + 26, { align: 'center' });
      doc.fillColor(brand.muted).fontSize(7.5).font('Helvetica')
        .text('Issued under NESREA EPR Framework & National Environmental (Battery Control) Regulations 2024',
          0, titleY + 44, { align: 'center' });

      hRule(doc, L, titleY + 60, contentW, brand.secondary);

      let y = titleY + 74;
      doc.fillColor(brand.muted).fontSize(9).font('Helvetica')
        .text('This certifies that:', L, y, { align: 'center', width: contentW });
      y += 18;
      doc.fillColor(brand.primary).fontSize(15).font('Helvetica-Bold')
        .text((company?.name || '—').toUpperCase(), L, y, { align: 'center', width: contentW });
      y += 24;
      doc.fillColor(brand.text).fontSize(8.5).font('Helvetica')
        .text('has registered and is actively tracking the following solar installation in compliance with Nigerian environmental law:',
          L, y, { align: 'center', width: contentW });
      y += 24;

      // Project details box
      doc.rect(L, y, contentW, 198).fillAndStroke(brand.light, '#CBD5E1');
      doc.rect(L, y, 5, 198).fill(brand.secondary);

      const panels = (project.equipment || []).filter(e => e.equipment_type === 'panel');
      const batteries = (project.equipment || []).filter(e => e.equipment_type === 'battery');
      const detailItems = [
        ['Project Name',     project.name || '—'],
        ['Location',         [project.city, project.state].filter(Boolean).join(', ') || '—'],
        ['Installation Date', project.installation_date
          ? new Date(project.installation_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })
          : '—'],
        ['Est. Decommission (West African Adjusted)', project.estimated_decommission_date
          ? new Date(project.estimated_decommission_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })
          : 'Pending Calculation'],
        ['Total Solar Panels', `${panels.reduce((s, e) => s + (e.quantity || 0), 0)} panels`],
        ['Total Batteries',    `${batteries.reduce((s, e) => s + (e.quantity || 0), 0)} units`],
        ['Recycling Route',    'EPRON-Certified Formal Hydrometallurgical Recovery'],
      ];

      detailItems.forEach(([label, value], i) => {
        const itemY = y + 14 + i * 25;
        doc.fillColor(brand.muted).fontSize(7.5).font('Helvetica-Bold').text(label + ':', L + 16, itemY, { width: 220 });
        doc.fillColor(brand.text).font('Helvetica').fontSize(8.5).text(String(value), L + 245, itemY, { width: contentW - 254 });
      });
      y += 210;

      // Lifecycle + EPR hook block (required for final compliance export context)
      const epr = estimateEprMilestones(project);
      doc.rect(L, y, contentW, 94).fillAndStroke('#ECFDF5', '#A7F3D0');
      doc.rect(L, y, 4, 94).fill(brand.accent);
      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold')
        .text('Decommissioning & E-Waste Management Plan (EPR Hook)', L + 12, y + 12);
      doc.fillColor(brand.text).fontSize(7.8).font('Helvetica')
        .text(
          'This project is lifecycle-locked for EPR compliance. SolNuv will trigger decommission and formal recycling checkpoints for major components at the estimated windows below.',
          L + 12, y + 28, { width: contentW - 24, align: 'justify' }
        );
      doc.fillColor(brand.muted).fontSize(7.6).font('Helvetica-Bold')
        .text(`Battery EOL checkpoint: ${epr.batteryEol.toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })}`, L + 12, y + 56)
        .text(`Inverter EOL checkpoint: ${epr.inverterEol.toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })}`, L + 12, y + 68)
        .text(`Panel EOL checkpoint: ${epr.panelEol.toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })}`, L + 12, y + 80);
      y += 104;

      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold')
        .text(`Certificate No: ${certNumber}`, L, y, { align: 'center', width: contentW });
      y += 15;
      hRule(doc, L, y, contentW, brand.secondary);
      y += 14;

      // Signature area
      const sigLineY = y + 30;
      if (sigBuffer) {
        try { doc.image(sigBuffer, L + 10, y, { height: 28, fit: [120, 28] }); } catch { /* skip */ }
      }
      hRule(doc, L + 10, sigLineY, 140, brand.muted);
      doc.fillColor(brand.muted).fontSize(7.5).font('Helvetica')
        .text(company?.name || 'Authorised Signatory', L + 10, sigLineY + 5, { width: 140 });

      const sealX = L + contentW - 150;
      hRule(doc, sealX, sigLineY, 140, brand.muted);
      doc.text('SolNuv Compliance Engine', sealX, sigLineY + 5, { width: 140 });
      doc.text(`Issued: ${new Date().toLocaleDateString('en-NG')}`, sealX, sigLineY + 16, { width: 140 });
      y = sigLineY + 30;

      doc.fillColor(brand.muted).fontSize(6.5)
        .text(`Verify this certificate at: solnuv.com/verify/${certNumber}`, L, y, { align: 'center', width: contentW });

      doc.rect(30, doc.page.height - 36, W - 60, 6).fill(brand.secondary); // gold bottom band

      // ── PAGE 2: PROJECT HISTORY APPENDIX ─────────────────────────
      if (history && history.length > 0) {
        doc.addPage();
        let hy = renderPageHeader(
          doc, brand,
          'Project History — Appendix',
          `${project.name || '—'}  •  ${history.length} event${history.length !== 1 ? 's' : ''}`,
          logoBuffer
        );
        hy += 10;

        const CHANGE_LABELS = {
          project_created:   'Created',
          project_updated:   'Updated',
          equipment_added:   'Equipment Added',
          equipment_updated: 'Equipment Updated',
          equipment_removed: 'Equipment Removed',
        };

        const hCols = [L, L + 100, L + 200, L + 270, L + 360];
        const hColW = [95, 95, 65, 88, contentW - (hCols[4] - L)];
        doc.rect(L, hy, contentW, 22).fill('#1E293B');
        ['Date', 'Event', 'Stage', 'Summary', 'By'].forEach((h, i) => {
          doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
            .text(h, hCols[i] + 4, hy + 7, { width: hColW[i] - 8 });
        });
        hy += 22;

        history.forEach((entry, idx) => {
          if (hy > doc.page.height - 80) {
            doc.addPage();
            hy = renderPageHeader(doc, brand, 'Project History (cont.)', null, logoBuffer) + 10;
          }
          const rowH = 26;
          doc.rect(L, hy, contentW, rowH).fill(idx % 2 === 0 ? brand.light : '#FFFFFF');
          doc.rect(L, hy + rowH - 0.5, contentW, 0.5).fill('#E2E8F0');

          const dateStr = entry.created_at
            ? new Date(entry.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
            : '—';
          const label = CHANGE_LABELS[entry.change_type] || entry.change_type || '';
          const labelColor = entry.change_type === 'project_created' ? brand.accent
            : entry.change_type === 'equipment_removed' ? '#B91C1C' : brand.primary;

          doc.fillColor(brand.muted).fontSize(7.5).font('Helvetica').text(dateStr, hCols[0] + 4, hy + 8, { width: hColW[0] - 8 });
          doc.fillColor(labelColor).font('Helvetica-Bold').text(label, hCols[1] + 4, hy + 8, { width: hColW[1] - 8 });
          doc.fillColor(brand.muted).font('Helvetica').text((entry.project_stage || '').toUpperCase(), hCols[2] + 4, hy + 8, { width: hColW[2] - 8 });
          doc.fillColor(brand.text).text((entry.change_summary || '').substring(0, 55), hCols[3] + 4, hy + 8, { width: hColW[3] - 8 });
          doc.fillColor(brand.muted).text((entry.actor_name || '').substring(0, 20), hCols[4] + 4, hy + 8, { width: hColW[4] - 8 });
          hy += rowH;
        });
      }

      const totalPages = doc.bufferedPageRange().count;
      renderFooters(doc, brand, totalPages);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate localized hybrid ROI proposal PDF
 */
async function generateProposalPdf(payload, result, company = null) {
  const brand = buildBrand(company);
  const logoBuffer = await fetchImageBuffer(company?.logo_url);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        bufferPages: true,
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const W = doc.page.width;
      const L = 60;
      const contentW = W - 2 * L;
      let y = renderPageHeader(
        doc, brand,
        'Hybrid Solar ROI Proposal',
        `Prepared: ${new Date().toLocaleDateString('en-NG')}`,
        logoBuffer
      );
      y += 18;

      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold').text('SYSTEM ASSUMPTIONS', L, y);
      hRule(doc, L, y + 12, contentW, brand.secondary);
      y += 22;

      const rows = [
        ['Tariff Band',          String(payload.tariff_band || 'A')],
        ['Tariff Rate',          `₦${Number(payload.tariff_rate_ngn_per_kwh || 0).toLocaleString('en-NG')}/kWh`],
        ['Generator Fuel Price', `₦${Number(payload.generator_fuel_price_ngn_per_liter || 0).toLocaleString('en-NG')}/L`],
        ['Grid Offset',          `${Number(payload.projected_grid_kwh_offset_per_day || 0).toLocaleString('en-NG')} kWh/day`],
        ['Generator Offset',     `${Number(payload.projected_generator_liters_offset_per_day || 0).toLocaleString('en-NG')} L/day`],
        ['Solar CAPEX',          `₦${Number(payload.proposed_solar_capex_ngn || 0).toLocaleString('en-NG')}`],
        ['Annual O&M',           `₦${Number(payload.annual_om_cost_ngn || 0).toLocaleString('en-NG')}`],
      ];

      rows.forEach((r, i) => {
        const ry = y + i * 24;
        doc.rect(L, ry, contentW, 22).fill(i % 2 === 0 ? brand.light : '#FFFFFF');
        doc.rect(L, ry, 3, 22).fill(brand.secondary);
        doc.fillColor(brand.muted).fontSize(8.5).font('Helvetica-Bold').text(r[0], L + 12, ry + 7);
        doc.fillColor(brand.text).font('Helvetica').text(r[1], L + 250, ry + 7);
      });

      y += rows.length * 24 + 18;
      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold').text('INVESTMENT METRICS', L, y);
      hRule(doc, L, y + 12, contentW, brand.secondary);
      y += 22;

      const metricCards = [
        { label: 'Payback Period',     value: `${result?.investment_metrics?.payback_months ?? '—'} months` },
        { label: 'Annual Net Savings', value: `₦${Number(result?.annual_savings?.net_ngn || 0).toLocaleString('en-NG')}` },
        { label: '10-Year Net Savings',value: `₦${Number(result?.investment_metrics?.ten_year_net_savings_ngn || 0).toLocaleString('en-NG')}` },
        { label: '10-Year ROI',        value: `${result?.investment_metrics?.ten_year_roi_pct ?? 0}%` },
      ];

      const cardHalf = Math.floor((contentW - 8) / 2);
      metricCards.forEach((m, i) => {
        const cx = L + (i % 2) * (cardHalf + 8);
        const cy = y + Math.floor(i / 2) * 78;
        doc.rect(cx, cy, cardHalf, 70).fillAndStroke('#F8FAFC', '#E2E8F0');
        doc.rect(cx, cy, cardHalf, 4).fill(i % 2 === 0 ? brand.primary : brand.secondary);
        doc.fillColor(brand.muted).fontSize(7.5).font('Helvetica-Bold').text(m.label, cx + 10, cy + 14);
        doc.fillColor(brand.primary).fontSize(16).font('Helvetica-Bold').text(m.value, cx + 10, cy + 30, { width: cardHalf - 20 });
      });

      y += 168;
      doc.rect(L, y, contentW, 80).fillAndStroke('#ECFDF5', '#A7F3D0');
      doc.rect(L, y, 4, 80).fill(brand.accent);
      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold').text('Proposal Notes', L + 14, y + 14);
      doc.fillColor(brand.text).fontSize(8).font('Helvetica')
        .text(
          'This estimate is localised for African hybrid energy conditions, combining NERC tariff exposure and generator fuel ' +
          'displacement. Final economics depend on site load profile, component selection, and installation quality.',
          L + 14, y + 32, { width: contentW - 28, align: 'justify' }
        );

      const totalPages = doc.bufferedPageRange().count;
      renderFooters(doc, brand, totalPages);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate DC cable sizing compliance certificate PDF
 * @param {object} payload   - Sizing inputs
 * @param {object} result    - Sizing outputs
 * @param {object} company   - Optional company for branding
 */
async function generateCableComplianceCertificate(payload, result, company = null) {
  const brand = buildBrand(company);
  const logoBuffer = await fetchImageBuffer(company?.logo_url);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        bufferPages: true,
      });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const W = doc.page.width;
      const L = 60;
      const contentW = W - 2 * L;
      const certRef = `CC-${Date.now()}`;

      let y = renderPageHeader(
        doc, brand,
        'DC Cable Sizing Compliance Certificate',
        `Certificate Ref: ${certRef}  •  Date: ${new Date().toLocaleDateString('en-NG')}`,
        logoBuffer
      );
      y += 14;

      const inputs = [
        ['Current',                `${payload.current_amps} A`],
        ['One-way Length',         `${payload.one_way_length_m} m`],
        ['System Voltage',         `${payload.system_voltage_v} V`],
        ['Allowable Voltage Drop', `${payload.allowable_voltage_drop_pct || 3}%`],
        ['Conductor Material',     `${payload.conductor_material || 'Copper'}`],
        ['Ambient Temperature',    `${payload.ambient_temperature_c || 30}°C`],
      ];

      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold').text('INPUT PARAMETERS', L, y);
      hRule(doc, L, y + 12, contentW, brand.secondary);
      y += 22;

      inputs.forEach((item, i) => {
        const ry = y + i * 22;
        doc.rect(L, ry, contentW, 20).fill(i % 2 === 0 ? brand.light : '#FFFFFF');
        doc.rect(L, ry, 3, 20).fill(brand.secondary);
        doc.fillColor(brand.muted).fontSize(8.5).font('Helvetica-Bold').text(item[0], L + 12, ry + 6);
        doc.fillColor(brand.text).font('Helvetica').text(item[1], L + 265, ry + 6);
      });

      y += inputs.length * 22 + 18;

      const cal = result?.calculations || {};
      const outputs = [
        ['Required Cross-Sectional Area',  `${cal.required_area_mm2 ?? '—'} mm²`],
        ['Recommended Standard Size',      `${cal.recommended_standard_mm2 ?? '—'} mm²`],
        ['Predicted Voltage Drop',         `${cal.predicted_voltage_drop_v ?? '—'} V`],
        ['Predicted Drop Percentage',      `${cal.predicted_voltage_drop_pct ?? '—'}%`],
        ['Compliance Status',              cal.compliant ? 'PASS ✓' : 'FAIL ✗'],
      ];

      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold').text('COMPUTED OUTPUTS', L, y);
      hRule(doc, L, y + 12, contentW, brand.secondary);
      y += 22;

      outputs.forEach((item, i) => {
        const ry = y + i * 26;
        doc.rect(L, ry, contentW, 24).fill(i % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
        const isStatus = item[0] === 'Compliance Status';
        const statusColor = isStatus ? (cal.compliant ? '#047857' : '#B91C1C') : brand.primary;
        doc.rect(L, ry, 3, 24).fill(isStatus ? statusColor : brand.muted);
        doc.fillColor(brand.muted).fontSize(8.5).font('Helvetica-Bold').text(item[0], L + 12, ry + 8);
        doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(isStatus ? 10 : 9).text(item[1], L + 265, ry + 8);
      });

      y += outputs.length * 26 + 18;

      doc.rect(L, y, contentW, 80).fillAndStroke('#FFF7ED', '#FED7AA');
      doc.rect(L, y, 4, 80).fill(brand.secondary);
      doc.fillColor(brand.primary).fontSize(9).font('Helvetica-Bold').text('Engineering Statement', L + 14, y + 14);
      doc.fillColor(brand.text).fontSize(8).font('Helvetica')
        .text(
          'This certificate documents the DC cable sizing calculation for field installation quality assurance. Validate all final ' +
          'selections against applicable site constraints, insulation ratings, and local code requirements.',
          L + 14, y + 32, { width: contentW - 28, align: 'justify' }
        );

      const totalPages = doc.bufferedPageRange().count;
      renderFooters(doc, brand, totalPages);
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



