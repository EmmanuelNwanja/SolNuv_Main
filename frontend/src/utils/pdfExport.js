export async function exportToPdf(element, filename, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('PDF export is only available in the browser');
  }

  const html2pdf = (await import('html2pdf.js')).default;

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
    onclone: (clonedDoc) => {
      // Remove sidebar - target by tag name more reliably
      const asides = clonedDoc.querySelectorAll('aside');
      asides.forEach(aside => {
        aside.remove();
      });
      
      // Fix main container layout
      const mainContainer = clonedDoc.querySelector('.max-w-7xl');
      if (mainContainer) {
        mainContainer.style.display = '';
        mainContainer.classList.remove('flex');
        mainContainer.style.maxWidth = '100%';
        mainContainer.style.margin = '0 auto';
        mainContainer.style.padding = '0 16px';
      }
      
      // Fix main content
      const mainContent = clonedDoc.querySelector('main');
      if (mainContent) {
        mainContent.style.width = '100%';
        mainContent.style.maxWidth = '100%';
        mainContent.style.flex = '';
        mainContent.style.padding = '24px 16px';
      }

      // Fix all grid layouts to fit A4
      const allGrids = clonedDoc.querySelectorAll('.grid');
      allGrids.forEach(grid => {
        grid.style.width = '100%';
        grid.style.maxWidth = '100%';
      });

      // Fix header sticky positioning that can cause issues
      const headers = clonedDoc.querySelectorAll('header');
      headers.forEach(header => {
        header.style.position = 'relative';
        header.style.top = '';
        header.style.zIndex = '';
      });

      // Convert Chart.js canvases to images using class selectors
      const originalCanvases = document.querySelectorAll('canvas');
      originalCanvases.forEach(canvas => {
        if (canvas.width > 0 && canvas.height > 0 && canvas.parentElement) {
          try {
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            // Try multiple ways to find the corresponding canvas in clone
            let clonedCanvas = null;
            
            // Try by ID first
            if (canvas.id) {
              clonedCanvas = clonedDoc.getElementById(canvas.id);
            }
            
            // Try by finding canvas in same parent with same dimensions
            if (!clonedCanvas) {
              const parent = canvas.parentElement;
              if (parent) {
                const clonedParent = clonedDoc.querySelector('[class*="' + parent.className.split(' ')[0] + '"]');
                if (clonedParent) {
                  clonedCanvas = clonedParent.querySelector('canvas');
                }
              }
            }
            
            // Try by finding any canvas in clone that hasn't been converted yet
            if (!clonedCanvas) {
              const allClonedCanvases = clonedDoc.querySelectorAll('canvas');
              for (let c of allClonedCanvases) {
                if (c.parentElement && !c.parentElement.querySelector('img')) {
                  clonedCanvas = c;
                  break;
                }
              }
            }
            
            if (clonedCanvas) {
              const img = clonedDoc.createElement('img');
              img.src = dataUrl;
              img.style.width = '100%';
              img.style.height = 'auto';
              img.style.maxWidth = '100%';
              img.style.display = 'block';
              img.style.margin = '0 auto';
              clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
            }
          } catch (e) {
            console.warn('Could not convert canvas to image:', e);
          }
        }
      });
    },
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