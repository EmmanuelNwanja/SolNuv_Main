export async function exportToPdf(element, filename, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('PDF export is only available in the browser');
  }

  const html2pdf = (await import('html2pdf.js')).default;

  // Clone the element to modify it for PDF export without affecting the UI
  const clonedElement = element.cloneNode(true);
  
  // Find and remove the sidebar navigation in the clone
  const sidebar = clonedElement.querySelector('aside');
  if (sidebar) {
    sidebar.remove();
  }
  
  // Find the main container with flex and make it block for full width
  const mainContainer = clonedElement.querySelector('.max-w-7xl');
  if (mainContainer) {
    mainContainer.style.display = 'block';
    mainContainer.classList.remove('flex');
  }
  
  // Find main content and ensure it's full width
  const mainContent = clonedElement.querySelector('main');
  if (mainContent) {
    mainContent.style.width = '100%';
    mainContent.style.maxWidth = '100%';
    mainContent.classList.remove('flex-1');
    mainContent.style.flex = 'none';
  }

  // Adjust all grid layouts to fit A4
  const allGrids = clonedElement.querySelectorAll('.grid');
  allGrids.forEach(grid => {
    grid.style.width = '100%';
  });

  const defaultOptions = {
    margin: 5,
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
    await html2pdf().set(mergedOptions).from(clonedElement).save();
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