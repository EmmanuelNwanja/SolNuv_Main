export async function exportToPdf(element, filename, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('PDF export is only available in the browser');
  }

  const html2pdf = (await import('html2pdf.js')).default;

  const defaultOptions = {
    margin: 10,
    filename: filename || 'document.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      logging: false,
      letterRendering: true,
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true,
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    await html2pdf().set(mergedOptions).from(element).save();
    return { success: true };
  } catch (error) {
    console.error('PDF export failed:', error);
    throw error;
  }
}

export async function exportElementToPdf(elementRef, filename, options = {}) {
  if (!elementRef) {
    throw new Error('Element reference is required for PDF export');
  }
  const element = elementRef.current || elementRef;
  return exportToPdf(element, filename, options);
}

export function downloadPdfFallback(filename = 'download.pdf') {
  window.print();
}