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
      // Remove ALL sidebars completely - sidebar is the navigation panel
      const asides = clonedDoc.querySelectorAll('aside');
      asides.forEach(aside => {
        aside.style.display = 'none';
        aside.style.width = '0';
        aside.style.minWidth = '0';
        aside.style.maxWidth = '0';
        aside.style.padding = '0';
        aside.style.margin = '0';
        aside.style.border = 'none';
      });

      // Remove any sidebar-related navigation buttons
      const navButtons = clonedDoc.querySelectorAll('nav button');
      navButtons.forEach(btn => {
        btn.style.display = 'none';
      });

      // Find and fix the main container - it usually has flex layout
      const flexContainers = clonedDoc.querySelectorAll('[class*="flex"]');
      flexContainers.forEach(container => {
        // Skip if it's the header or footer
        if (container.tagName === 'HEADER' || container.tagName === 'FOOTER') return;
        
        // Check if this container has both sidebar-like and main-content-like children
        const children = container.children;
        let hasAside = false;
        let hasMain = false;
        
        for (let child of children) {
          if (child.tagName === 'ASIDE' || child.classList?.contains('sidebar')) {
            hasAside = true;
          }
          if (child.tagName === 'MAIN' || child.classList?.contains('main')) {
            hasMain = true;
          }
        }
        
        // If container has aside and main, restructure it
        if (hasAside && hasMain) {
          container.style.display = 'block';
          container.style.flexDirection = '';
          container.classList.remove('flex');
        }
      });

      // Fix main container layout - look for the max-w-7xl container that wraps content
      const mainContainers = clonedDoc.querySelectorAll('.max-w-7xl');
      mainContainers.forEach(mainContainer => {
        // Check if this is the report container (has flex layout with aside)
        if (mainContainer.classList.contains('flex') || mainContainer.style.display === 'flex') {
          mainContainer.style.display = 'block';
          mainContainer.classList.remove('flex');
          mainContainer.style.flex = '';
        }
        mainContainer.style.maxWidth = '100%';
        mainContainer.style.margin = '0 auto';
        mainContainer.style.padding = '0 8px';
      });

      // Fix main content area
      const mainElements = clonedDoc.querySelectorAll('main');
      mainElements.forEach(main => {
        main.style.width = '100%';
        main.style.maxWidth = '100%';
        main.style.flex = '1';
        main.style.padding = '16px 8px';
        main.style.boxSizing = 'border-box';
      });

      // Fix all grid layouts to fit A4
      const allGrids = clonedDoc.querySelectorAll('.grid');
      allGrids.forEach(grid => {
        grid.style.width = '100%';
        grid.style.maxWidth = '100%';
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
      });

      // Fix header sticky positioning that can cause issues
      const headers = clonedDoc.querySelectorAll('header');
      headers.forEach(header => {
        header.style.position = 'relative';
        header.style.top = '';
        header.style.zIndex = '';
      });

      // Ensure chart containers have proper dimensions
      const chartContainers = clonedDoc.querySelectorAll('[class*="h-"]');
      chartContainers.forEach(container => {
        // Reset height to auto for better PDF rendering
        const heightClass = Array.from(container.classList).find(c => c.match(/^h-\d+$/));
        if (heightClass) {
          container.style.height = 'auto';
          container.style.minHeight = '200px';
        }
      });

      // Convert Chart.js canvases to images
      const originalCanvases = document.querySelectorAll('canvas');
      originalCanvases.forEach(canvas => {
        if (canvas.width > 0 && canvas.height > 0 && canvas.parentElement) {
          try {
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            let clonedCanvas = null;
            
            // Try by ID first
            if (canvas.id) {
              clonedCanvas = clonedDoc.getElementById(canvas.id);
            }
            
            // Try by finding canvas in same parent with same dimensions
            if (!clonedCanvas) {
              const parent = canvas.parentElement;
              if (parent) {
                const firstClass = parent.className.split(' ')[0];
                if (firstClass) {
                  const clonedParent = clonedDoc.querySelector('[class*="' + firstClass + '"]');
                  if (clonedParent) {
                    clonedCanvas = clonedParent.querySelector('canvas');
                  }
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