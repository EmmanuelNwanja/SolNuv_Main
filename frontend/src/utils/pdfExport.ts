import type { RefObject } from "react";

type Html2PdfOptions = Record<string, unknown>;

export async function exportToPdf(
  element: HTMLElement,
  filename: string,
  options: Html2PdfOptions = {}
): Promise<{ success: boolean }> {
  if (typeof window === "undefined") {
    throw new Error("PDF export is only available in the browser");
  }

  const html2pdf = (await import("html2pdf.js")).default as (opts?: Html2PdfOptions) => {
    set: (o: Html2PdfOptions) => { from: (el: HTMLElement) => { save: () => Promise<void> } };
  };

  const defaultOptions: Html2PdfOptions = {
    margin: 5,
    filename: filename || "document.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    onclone: (clonedDoc: Document) => {
      const asides = clonedDoc.querySelectorAll("aside");
      asides.forEach((aside) => aside.remove());

      const navElements = clonedDoc.querySelectorAll("nav");
      navElements.forEach((nav) => {
        const buttons = nav.querySelectorAll("button");
        if (buttons.length > 2) {
          nav.remove();
        }
      });

      const allDivs = clonedDoc.querySelectorAll("div");
      allDivs.forEach((div) => {
        const style = div.style;
        const classList = div.className || "";

        if (style.display === "flex" || classList.includes("flex")) {
          if (classList.includes("w-64") || style.width === "16rem" || style.width === "256px") {
            style.display = "none";
          }

          const parent = div.parentElement;
          if (parent) {
            const parentClass = parent.className || "";
            if (parentClass.includes("max-w-7xl")) {
              parent.style.display = "block";
              parent.classList.remove("flex");
              parent.style.flex = "";
              parent.style.maxWidth = "100%";
              parent.style.padding = "16px";
            }
          }
        }
      });

      const maxWContainers = clonedDoc.querySelectorAll('[class*="max-w-"]');
      maxWContainers.forEach((container) => {
        const style = (container as HTMLElement).style;
        const classList = container.className || "";

        if (container.tagName === "HEADER" || container.tagName === "FOOTER") {
          style.position = "relative";
          style.top = "";
          return;
        }

        if (style.display === "flex" || classList.includes("flex")) {
          style.display = "block";
        }

        style.maxWidth = "100%";
        style.width = "100%";
        style.margin = "0";
        style.padding = "16px";
      });

      const mainElements = clonedDoc.querySelectorAll("main");
      mainElements.forEach((main) => {
        const el = main as HTMLElement;
        el.style.width = "100%";
        el.style.maxWidth = "100%";
        el.style.flex = "";
        el.style.padding = "0";
        el.style.boxSizing = "border-box";
      });

      const grids = clonedDoc.querySelectorAll('[class*="grid"]');
      grids.forEach((grid) => {
        const el = grid as HTMLElement;
        el.style.width = "100%";
        el.style.maxWidth = "100%";
      });

      const chartContainers = clonedDoc.querySelectorAll('[class*="h-"]');
      chartContainers.forEach((container) => {
        const el = container as HTMLElement;
        el.style.height = "auto";
        el.style.minHeight = "200px";
        el.style.maxHeight = "400px";
      });

      const originalCanvases = Array.from(document.querySelectorAll("canvas"));
      originalCanvases.forEach((canvas) => {
        if (canvas.width > 0 && canvas.height > 0 && canvas.parentElement) {
          try {
            const dataUrl = canvas.toDataURL("image/png", 1.0);

            let clonedCanvas: HTMLCanvasElement | null = null;

            if (canvas.id) {
              clonedCanvas = clonedDoc.getElementById(canvas.id) as HTMLCanvasElement | null;
            }

            if (!clonedCanvas && canvas.parentElement) {
              const parentClasses = canvas.parentElement.className?.split(" ") || [];
              for (const cls of parentClasses) {
                if (cls && cls.length > 3) {
                  const matches = clonedDoc.querySelectorAll(`.${cls} canvas`);
                  if (matches.length > 0) {
                    clonedCanvas = matches[0] as HTMLCanvasElement;
                    break;
                  }
                }
              }
            }

            if (!clonedCanvas) {
              const canvases = clonedDoc.querySelectorAll("canvas");
              for (const c of canvases) {
                if (c.parentElement && !c.parentElement.querySelector("img")) {
                  clonedCanvas = c as HTMLCanvasElement;
                  break;
                }
              }
            }

            if (clonedCanvas?.parentElement) {
              const img = clonedDoc.createElement("img");
              img.src = dataUrl;
              img.style.width = "100%";
              img.style.height = "auto";
              img.style.maxWidth = "100%";
              img.style.display = "block";
              img.style.margin = "0 auto";
              clonedCanvas.parentElement.replaceChild(img, clonedCanvas);
            }
          } catch (e) {
            console.warn("Canvas conversion failed:", e);
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
    console.error("PDF export failed:", error);
    throw error;
  }
}

export async function exportElementToPdf(
  elementRef: RefObject<HTMLElement | null> | { current?: HTMLElement | null } | HTMLElement | null,
  filename: string,
  options: Html2PdfOptions = {}
): Promise<{ success: boolean }> {
  if (!elementRef) {
    throw new Error("Element reference is required for PDF export");
  }
  const element =
    "current" in elementRef && elementRef.current !== undefined
      ? elementRef.current
      : (elementRef as HTMLElement);
  if (!element) {
    throw new Error("Element reference is required for PDF export");
  }
  return exportToPdf(element, filename, options);
}

export function downloadPdfFallback(_filename = "download.pdf"): void {
  window.print();
}
