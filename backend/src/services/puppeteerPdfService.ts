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
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-web-security',
        ],
      });
    } catch (launchErr) {
      console.error('Puppeteer launch failed:', launchErr.message);
      throw new Error('PDF generation service unavailable. Please try again later.');
    }
  }
  return browser;
}

async function renderHtmlToPdf(htmlContent, options: Record<string, any> = {}) {
  let browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    console.error('Failed to get browser:', err.message);
    throw err;
  }
  
  let page;
  try {
    page = await browser.newPage();
  } catch (pageErr) {
    console.error('Failed to create page:', pageErr.message);
    throw new Error('PDF generation service unavailable. Please try again.');
  }

  try {
    await page.setContent(htmlContent, {
      waitUntil: ['domcontentloaded'],
      timeout: 30000,
    });

    // Short wait for rendering
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));

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
  } catch (pdfErr) {
    console.error('PDF generation failed:', pdfErr.message);
    throw new Error('Failed to generate PDF: ' + pdfErr.message);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (_) {
        // Ignore page close failures during cleanup.
      }
    }
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
