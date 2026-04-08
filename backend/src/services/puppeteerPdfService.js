/**
 * SolNuv Puppeteer PDF Service
 * Renders HTML templates to PDF using Puppeteer/Chromium
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

async function renderHtmlToPdf(htmlContent, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(htmlContent, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 30000,
    });

    // Wait for Chart.js to render if present
    if (htmlContent.includes('chart.js') || htmlContent.includes('Chart')) {
      await page.waitForFunction(() => {
        return typeof Chart !== 'undefined';
      }, { timeout: 10000 }).catch(() => {});
      
      // Give charts time to render
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    }

    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      margin: {
        top: options.marginTop || '15mm',
        right: options.marginRight || '15mm',
        bottom: options.marginBottom || '20mm',
        left: options.marginLeft || '15mm',
      },
      displayHeaderFooter: options.displayHeaderFooter !== false,
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || `
        <div style="width: 100%; font-size: 8pt; display: flex; justify-content: space-between; padding: 0 15mm;">
          <span>SolNuv Compliance Platform | solnuv.com</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

function loadTemplate(templateName) {
  const templatePath = path.join(__dirname, 'templates', 'pdfs', `${templateName}.html`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateName}`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

function renderTemplate(templateStr, data) {
  // Handlebars-style template rendering for basic constructs
  let rendered = templateStr;
  
  // Handle #if blocks
  const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  rendered = rendered.replace(ifRegex, (match, condition, content) => {
    return data[condition] ? content : '';
  });

  // Handle #each blocks
  const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  rendered = rendered.replace(eachRegex, (match, arrayName, itemTemplate) => {
    const array = data[arrayName] || [];
    return array.map(item => {
      let itemRendered = itemTemplate;
      for (const [key, value] of Object.entries(item)) {
        itemRendered = itemRendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
      return itemRendered;
    }).join('');
  });

  // Handle simple {{variable}} replacements
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, value !== undefined && value !== null ? String(value) : '');
  }

  return rendered;
}

/**
 * Generate Design Report PDF
 */
async function generateDesignReportPdf(data) {
  const template = loadTemplate('designReport');
  const html = renderTemplate(template, data);
  return renderHtmlToPdf(html);
}

/**
 * Generate NESREA Report PDF
 */
async function generateNesreaReportPdf(data) {
  const template = loadTemplate('nesreaReport');
  const html = renderTemplate(template, data);
  return renderHtmlToPdf(html);
}

/**
 * Generate Certificate PDF
 */
async function generateCertificatePdf(data) {
  const template = loadTemplate('certificate');
  const html = renderTemplate(template, data);
  return renderHtmlToPdf(html, {
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    displayHeaderFooter: false,
  });
}

/**
 * Generate ROI Proposal PDF
 */
async function generateProposalPdf(data) {
  const template = loadTemplate('proposal');
  const html = renderTemplate(template, data);
  return renderHtmlToPdf(html);
}

/**
 * Cleanup browser on process exit
 */
async function cleanup() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = {
  generateDesignReportPdf,
  generateNesreaReportPdf,
  generateCertificatePdf,
  generateProposalPdf,
  renderHtmlToPdf,
  renderTemplate,
  cleanup,
};
