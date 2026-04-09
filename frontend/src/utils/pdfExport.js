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
      // STEP 1: Completely remove sidebar <aside> elements
      const asides = clonedDoc.querySelectorAll('aside');
      asides.forEach(aside => aside.remove());

      // Remove nav elements that are inside the sidebar container
      const navElements = clonedDoc.querySelectorAll('nav');
      navElements.forEach(nav => {
        // Check if this nav is likely a sidebar nav (has buttons as children)
        const buttons = nav.querySelectorAll('button');
        if (buttons.length > 2) {
          nav.remove();
        }
      });

      // STEP 2: Fix flex containers that had sidebar + main layout
      const allDivs = clonedDoc.querySelectorAll('div');
      allDivs.forEach(div => {
        const style = div.style;
        const classList = div.className || '';
        
        // If div has flex and contains the main content area, convert to block
        if (style.display === 'flex' || classList.includes('flex')) {
          // Check if this is a layout container (has w-64 which is sidebar width)
          if (classList.includes('w-64') || style.width === '16rem' || style.width === '256px') {
            style.display = 'none';
          }
          
          // Check parent to see if this div is the flex container with aside
          const parent = div.parentElement;
          if (parent) {
            const parentClass = parent.className || '';
            // If parent has max-w-7xl and is flex, make it block
            if (parentClass.includes('max-w-7xl')) {
              parent.style.display = 'block';
              parent.classList.remove('flex');
              parent.style.flex = '';
              parent.style.maxWidth = '100%';
              parent.style.padding = '16px';
            }
          }
        }
      });

      // STEP 3: Fix the main content wrapper
      const maxWContainers = clonedDoc.querySelectorAll('[class*="max-w-"]');
      maxWContainers.forEach(container => {
        const style = container.style;
        const classList = container.className || '';
        
        // Skip header/footer
        if (container.tagName === 'HEADER' || container.tagName === 'FOOTER') {
          style.position = 'relative';
          style.top = '';
          return;
        }
        
        // If this container has flex layout, convert to block
        if (style.display === 'flex' || classList.includes('flex')) {
          style.display = 'block';
        }
        
        // Expand to full width
        style.maxWidth = '100%';
        style.width = '100%';
        style.margin = '0';
        style.padding = '16px';
      });

      // STEP 4: Fix main content area
      const mainElements = clonedDoc.querySelectorAll('main');
      mainElements.forEach(main => {
        main.style.width = '100%';
        main.style.maxWidth = '100%';
        main.style.flex = '';
        main.style.padding = '0';
        main.style.boxSizing = 'border-box';
      });

      // STEP 5: Fix grid layouts
      const grids = clonedDoc.querySelectorAll('[class*="grid"]');
      grids.forEach(grid => {
        grid.style.width = '100%';
        grid.style.maxWidth = '100%';
      });

      // STEP 6: Ensure charts render properly
      const chartContainers = clonedDoc.querySelectorAll('[class*="h-"]');
      chartContainers.forEach(container => {
        container.style.height = 'auto';
        container.style.minHeight = '200px';
        container.style.maxHeight = '400px';
      });

      // STEP 7: Convert Chart.js canvases to images BEFORE html2canvas captures
      const originalCanvases = Array.from(document.querySelectorAll('canvas'));
      originalCanvases.forEach(canvas => {
        if (canvas.width > 0 && canvas.height > 0 && canvas.parentElement) {
          try {
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            // Find the corresponding canvas in the cloned document
            let clonedCanvas = null;
            
            // Method 1: Match by ID
            if (canvas.id) {
              clonedCanvas = clonedDoc.getElementById(canvas.id);
            }
            
            // Method 2: Match by parent class pattern
            if (!clonedCanvas && canvas.parentElement) {
              const parentClasses = canvas.parentElement.className?.split(' ') || [];
              for (const cls of parentClasses) {
                if (cls && cls.length > 3) {
                  const matches = clonedDoc.querySelectorAll('.' + cls + ' canvas');
                  if (matches.length > 0) {
                    clonedCanvas = matches[0];
                    break;
                  }
                }
              }
            }
            
            // Method 3: Find any canvas that hasn't been replaced yet
            if (!clonedCanvas) {
              const canvases = clonedDoc.querySelectorAll('canvas');
              for (const c of canvases) {
                if (c.parentElement && !c.parentElement.querySelector('img')) {
                  clonedCanvas = c;
                  break;
                }
              }
            }
            
            // Replace with image
            if (clonedCanvas && clonedCanvas.parentElement) {
              const img = clonedDoc.createElement('img');
              img.src = dataUrl;
              img.style.width = '100%';
              img.style.height = 'auto';
              img.style.maxWidth = '100%';
              img.style.display = 'block';
              img.style.margin = '0 auto';
              clonedCanvas.parentElement.replaceChild(img, clonedCanvas);
            }
          } catch (e) {
            console.warn('Canvas conversion failed:', e);
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