/**
 * Bulletproof Print Utility for Physical Computer Printers
 * Handles standard desktop printing, iframe preview environments,
 * and popup window fallbacks with exact CSS and A4 margin retention.
 */

export interface PrintOptions {
  documentTitle?: string;
  pageOrientation?: 'portrait' | 'landscape';
  pageMargin?: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

/**
 * Collects all current document styles, link tags, and font definitions
 */
export function getDocumentStyles(): string {
  let styleHtml = '';

  const styles = document.querySelectorAll('style');
  styles.forEach((style) => {
    styleHtml += style.outerHTML;
  });

  const links = document.querySelectorAll('link[rel="stylesheet"]');
  links.forEach((link) => {
    styleHtml += link.outerHTML;
  });

  return styleHtml;
}

/**
 * Builds a standalone clean HTML document for printing
 */
export function generatePrintHtml(
  element: HTMLElement,
  options: PrintOptions = {}
): string {
  const {
    documentTitle = 'ITRIS_Service_Report',
    pageOrientation = 'portrait',
    pageMargin = '6mm 6mm',
  } = options;

  const stylesHtml = getDocumentStyles();
  const contentHtml = element.outerHTML;

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${documentTitle}</title>
  ${stylesHtml}
  <style>
    @page {
      size: A4 ${pageOrientation};
      margin: ${pageMargin};
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      background-color: #ffffff !important;
      color: #0f172a !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: auto !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .print\\:hidden, .no-print {
      display: none !important;
    }
    .print-clean-page {
      position: static !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: white !important;
    }
    @media screen {
      body {
        padding: 24px;
        background: #f1f5f9 !important;
      }
      .screen-bar {
        max-width: 800px;
        margin: 0 auto 16px auto;
        padding: 12px 16px;
        background: #0f172a;
        color: white;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      }
      .screen-bar button {
        cursor: pointer;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 13px;
        border: none;
      }
      .btn-print {
        background: #dc2626;
        color: white;
      }
      .btn-print:hover {
        background: #b91c1c;
      }
      .btn-close {
        background: #334155;
        color: white;
        margin-left: 8px;
      }
      .btn-close:hover {
        background: #475569;
      }
      .print-wrapper {
        max-width: 800px;
        margin: 0 auto;
        background: white;
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      }
    }
    @media print {
      .screen-bar {
        display: none !important;
      }
      .print-wrapper {
        max-width: 100% !important;
        margin: 0 !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="screen-bar no-print">
    <div>
      <span style="font-weight: bold; font-size: 14px;">🖨️ หน้าต่างสั่งพิมพ์เอกสาร (Print Window)</span>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">ระบบกำลังเรียกเครื่องพิมพ์ของคุณ หากหน้าต่างเลือกเครื่องพิมพ์ไม่แสดง ให้คลิกปุ่ม "สั่งพิมพ์"</p>
    </div>
    <div>
      <button class="btn-print" onclick="window.print()">🖨️ สั่งพิมพ์ (Print)</button>
      <button class="btn-close" onclick="window.close()">✕ ปิดหน้าต่าง</button>
    </div>
  </div>
  <div class="print-wrapper">
    ${contentHtml}
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      }, 300);
    });
  </script>
</body>
</html>`;
}

/**
 * Method 1: Print directly in the current window by isolating the element
 */
export function printDirectInWindow(
  element: HTMLElement,
  options: PrintOptions = {}
): Promise<boolean> {
  const { onBeforePrint, onAfterPrint } = options;

  return new Promise((resolve) => {
    if (onBeforePrint) onBeforePrint();

    // Remove any previous print portal
    const existingPortal = document.getElementById('app-print-portal');
    if (existingPortal) {
      existingPortal.remove();
    }

    // Create print portal
    const portal = document.createElement('div');
    portal.id = 'app-print-portal';
    portal.className = 'print-portal-container';
    portal.innerHTML = element.outerHTML;
    document.body.appendChild(portal);

    document.body.classList.add('is-printing-now');

    const cleanUp = () => {
      document.body.classList.remove('is-printing-now');
      const p = document.getElementById('app-print-portal');
      if (p) p.remove();
      window.removeEventListener('afterprint', cleanUp);
      if (onAfterPrint) onAfterPrint();
      resolve(true);
    };

    window.addEventListener('afterprint', cleanUp, { once: true });

    // Slight delay to allow DOM render before triggering browser print dialog
    setTimeout(() => {
      try {
        window.focus();
        window.print();
        // Fallback cleanup if afterprint doesn't fire (some browsers)
        setTimeout(cleanUp, 1500);
      } catch (err) {
        console.error('Window print error:', err);
        cleanUp();
      }
    }, 150);
  });
}

/**
 * Method 2: Open dedicated print popup tab/window with auto-print
 */
export function printInNewWindow(
  element: HTMLElement,
  options: PrintOptions = {}
): boolean {
  try {
    const html = generatePrintHtml(element, options);
    const printWindow = window.open('', '_blank', 'width=950,height=850,menubar=no,toolbar=no,location=no,status=no');
    
    if (!printWindow) {
      console.warn('Popup blocked, falling back to direct window print');
      printDirectInWindow(element, options);
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return true;
  } catch (err) {
    console.error('Error opening print window:', err);
    printDirectInWindow(element, options);
    return false;
  }
}

/**
 * Main printElement entry point:
 * Uses high-reliability direct print with fallback.
 */
export async function printElement(
  element: HTMLElement | null,
  options: PrintOptions = {}
): Promise<boolean> {
  if (!element) {
    console.error('Print error: Element to print was not found');
    return false;
  }

  // Check if we are embedded in an iframe (e.g. AI Studio / Cloud Run preview)
  const isInsideIframe = window.self !== window.top;

  if (isInsideIframe) {
    // In iframe mode, opening a new window or direct window print
    const opened = printInNewWindow(element, options);
    if (!opened) {
      return printDirectInWindow(element, options);
    }
    return true;
  }

  // Otherwise, standard desktop direct print
  return printDirectInWindow(element, options);
}
