import bwipjs from 'bwip-js';
import { BarcodeElement, BarcodeSymbology } from '../types';
import { evaluateElementData, EvaluationContext } from './dataSourceEngine';

export interface SymbologyMetadata {
  id: BarcodeSymbology;
  name: string;
  category: string;
  folderCategories: string[];
  bwipBcId: string;
  description: string;
  defaultSample: string;
  is2D: boolean;
  supportsGS1: boolean;
  validationRegex?: RegExp;
}

export const SYMBOLOGY_CATALOG: SymbologyMetadata[] = [
  // General Purpose & Primary BarTender Barcodes
  {
    id: 'code128',
    name: 'Code 128',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'code128',
    description: 'High-density alphanumeric barcode supporting all 128 ASCII characters.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'code39',
    name: 'Code 39',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'code39',
    description: 'Widely used in automotive, defense, and industrial inventory systems.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'code93',
    name: 'Code 93',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'code93',
    description: 'Higher density variant of Code 39 with full ASCII capability.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'datamatrix',
    name: 'Data Matrix',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Disc / CD / DVD', 'Health Care', 'Pharmaceutical', 'All Symbologies'],
    bwipBcId: 'datamatrix',
    description: 'Compact 2D matrix code standard for electronics, direct part marking (DPM), and small parts.',
    defaultSample: '12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'qr',
    name: 'QR Code',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Disc / CD / DVD', 'All Symbologies'],
    bwipBcId: 'qrcode',
    description: 'Quick Response 2D matrix code supporting URLs, text, and industrial tracking.',
    defaultSample: 'https://verify.industrial-label.com/12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'micro-qr',
    name: 'Micro QR Code',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Disc / CD / DVD', 'All Symbologies'],
    bwipBcId: 'microqrcode',
    description: 'Miniaturized QR Code for very small electronics and hardware tags.',
    defaultSample: '12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'pdf417',
    name: 'PDF417',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'pdf417',
    description: 'High-capacity stacked 2D barcode standard for shipping, logistics, and government IDs.',
    defaultSample: '12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'pdf417-truncated',
    name: 'PDF417 Truncated',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'pdf417compact',
    description: 'Compact version of PDF417 with reduced right stop pattern for space-constrained labels.',
    defaultSample: '12345678',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'aztec',
    name: 'Aztec Code',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Disc / CD / DVD', 'All Symbologies'],
    bwipBcId: 'azteccode',
    description: 'High-density matrix code with a central bullseye finder, widely used in ticketing.',
    defaultSample: 'TKT-AIR-992384-SEC',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'maxicode',
    name: 'MaxiCode (UPS)',
    category: 'Postal / Shipping',
    folderCategories: ['Postal / Shipping', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'maxicode',
    description: 'Fixed-size matrix code with hexagonal grid and concentric rings used by UPS for high-speed sorting.',
    defaultSample: '[)>01961234567898400011Z00004951UPSN06X61015912345671/1',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'interleaved2of5',
    name: 'Interleaved 2 of 5',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'interleaved2of5',
    description: 'Continuous two-width barcode symbology encoding pairs of digits.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
    validationRegex: /^\d+$/,
  },
  {
    id: 'itf14',
    name: 'ITF-14',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'GS1 (by Application)', 'Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'itf14',
    description: '14-digit carton & master case barcode with heavy bearer bars for corrugated cardboard.',
    defaultSample: '10012345678902',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{13,14}$/,
  },

  // Retail & Consumer
  {
    id: 'ean13',
    name: 'EAN-13',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'ean13',
    description: 'International standard 13-digit product barcode used in retail worldwide.',
    defaultSample: '5901234123457',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{12,13}$/,
  },
  {
    id: 'ean8',
    name: 'EAN-8',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'ean8',
    description: 'Compact 8-digit retail barcode for small packages and items.',
    defaultSample: '96385074',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{7,8}$/,
  },
  {
    id: 'upca',
    name: 'UPC-A',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'upca',
    description: 'Standard 12-digit point-of-sale barcode used primarily in North America.',
    defaultSample: '012345678905',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{11,12}$/,
  },
  {
    id: 'upce',
    name: 'UPC-E',
    category: 'GS1 (by Symbology)',
    folderCategories: ['GS1 (by Symbology)', 'General Purpose', 'All Symbologies'],
    bwipBcId: 'upce',
    description: 'Zero-suppressed 8-digit version of UPC-A for small retail items.',
    defaultSample: '01234565',
    is2D: false,
    supportsGS1: true,
    validationRegex: /^\d{6,8}$/,
  },

  // GS1 Standards
  {
    id: 'gs1-128',
    name: 'GS1-128',
    category: 'GS1 (by Application)',
    folderCategories: ['GS1 (by Application)', 'GS1 (by Symbology)', 'Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'gs1-128',
    description: 'Industry standard for shipping containers, pallets, and logistics with Application Identifiers.',
    defaultSample: '(01)00850006531233(17)261231(10)LOT456(21)SN9876',
    is2D: false,
    supportsGS1: true,
  },
  {
    id: 'gs1-datamatrix',
    name: 'GS1 DataMatrix',
    category: 'GS1 (by Application)',
    folderCategories: ['GS1 (by Application)', 'GS1 (by Symbology)', 'Health Care', 'Pharmaceutical', 'All Symbologies'],
    bwipBcId: 'gs1datamatrix',
    description: 'GS1 compliant 2D matrix code mandatory for FDA UDI medical devices and pharma serialization.',
    defaultSample: '(01)00850006531233(17)261231(10)LOT456(21)SN9876',
    is2D: true,
    supportsGS1: true,
  },
  {
    id: 'gs1-qr',
    name: 'GS1 QR Code',
    category: 'GS1 (by Application)',
    folderCategories: ['GS1 (by Application)', 'GS1 (by Symbology)', 'All Symbologies'],
    bwipBcId: 'gs1qrcode',
    description: 'GS1 2D barcode for consumer engagement and supply chain track and trace.',
    defaultSample: '(01)00850006531233(10)LOT123',
    is2D: true,
    supportsGS1: true,
  },
  {
    id: 'gs1-databar',
    name: 'GS1 DataBar Omnidirectional',
    category: 'GS1 (by Application)',
    folderCategories: ['GS1 (by Application)', 'GS1 (by Symbology)', 'All Symbologies'],
    bwipBcId: 'databarexpanded',
    description: 'GS1 barcode for fresh produce, coupons, and variable weight retail products.',
    defaultSample: '(01)00850006531233',
    is2D: false,
    supportsGS1: true,
  },

  // Health Care & Pharma
  {
    id: 'hibc-128',
    name: 'HIBC Code 128',
    category: 'Health Care',
    folderCategories: ['Health Care', 'All Symbologies'],
    bwipBcId: 'hibccode128',
    description: 'Health Industry Bar Code standard for medical equipment and supplies labeling.',
    defaultSample: '+A99912345/$$5261231LOT456',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'hibc-datamatrix',
    name: 'HIBC DataMatrix',
    category: 'Health Care',
    folderCategories: ['Health Care', 'Pharmaceutical', 'All Symbologies'],
    bwipBcId: 'hibcdatamatrix',
    description: '2D HIBC matrix code for surgical instruments and sterile medical packaging.',
    defaultSample: '+A99912345/$$5261231LOT456',
    is2D: true,
    supportsGS1: false,
  },
  {
    id: 'pharmacode',
    name: 'Pharmacode',
    category: 'Pharmaceutical',
    folderCategories: ['Pharmaceutical', 'Health Care', 'All Symbologies'],
    bwipBcId: 'pharmacode',
    description: 'Binary barcode standard used in pharmaceutical packaging control.',
    defaultSample: '12345',
    is2D: false,
    supportsGS1: false,
    validationRegex: /^\d+$/,
  },

  // Patch Code
  {
    id: 'patchcode',
    name: 'Patch Code',
    category: 'Document Imaging',
    folderCategories: ['Document Imaging', 'All Symbologies'],
    bwipBcId: 'code39',
    description: 'Document separation and indexing barcode for production sheet scanners.',
    defaultSample: 'PATCH-T',
    is2D: false,
    supportsGS1: false,
  },

  // Postal & Shipping
  {
    id: 'usps-imb',
    name: 'USPS Intelligent Mail (IMb)',
    category: 'Postal / Shipping',
    folderCategories: ['Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'onecode',
    description: 'US Postal Service 65-bar 4-state barcode sorting and tracking mailpieces.',
    defaultSample: '0123456709498765432101234567891',
    is2D: false,
    supportsGS1: false,
    validationRegex: /^\d{20,31}$/,
  },
  {
    id: 'royalmail',
    name: 'Royal Mail 4-State (RM4SCC)',
    category: 'Postal / Shipping',
    folderCategories: ['Postal / Shipping', 'All Symbologies'],
    bwipBcId: 'royalmail',
    description: 'UK Royal Mail Cleanmail barcode for automated letter sorting.',
    defaultSample: 'SN34RD1A',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'codabar',
    name: 'Codabar (NW-7)',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'Health Care', 'All Symbologies'],
    bwipBcId: 'rationalizedCodabar',
    description: 'Self-checking barcode used in libraries, blood banks, and airbills.',
    defaultSample: 'A123456789B',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'msi',
    name: 'MSI Plessey',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'msi',
    description: 'Numeric barcode commonly used for warehouse shelf tagging.',
    defaultSample: '8052194',
    is2D: false,
    supportsGS1: false,
    validationRegex: /^\d+$/,
  },
  {
    id: 'telepen',
    name: 'Telepen',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'telepen',
    description: 'Compact ASCII barcode with high data integrity.',
    defaultSample: 'TELEPEN123',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'tlc39',
    name: 'TLC39 (Telecommunications)',
    category: 'TLC',
    folderCategories: ['TLC', 'All Symbologies'],
    bwipBcId: 'code39',
    description: 'TCIF Linked Code 39 composite barcode.',
    defaultSample: 'TLC39-EQUIP-8849',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'posicode-b',
    name: 'PosiCode B',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'posicode',
    description: 'PosiCode variant B for positional scanning in automated sorting.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'posicode-a',
    name: 'PosiCode A',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'posicode',
    description: 'PosiCode variant A with fixed length.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
  {
    id: 'posicode-b',
    name: 'PosiCode B',
    category: 'General Purpose',
    folderCategories: ['General Purpose', 'All Symbologies'],
    bwipBcId: 'posicode',
    description: 'PosiCode variant B with variable length.',
    defaultSample: '12345678',
    is2D: false,
    supportsGS1: false,
  },
];

export function getSymbologyMetadata(symbology: BarcodeSymbology): SymbologyMetadata {
  return SYMBOLOGY_CATALOG.find(s => s.id === symbology) || SYMBOLOGY_CATALOG[0];
}

export function validateBarcodeValue(symbology: BarcodeSymbology, value: string): { valid: boolean; message?: string } {
  if (!value || !value.trim()) {
    return { valid: false, message: 'Barcode value cannot be empty' };
  }

  const meta = getSymbologyMetadata(symbology);
  if (meta.validationRegex && !meta.validationRegex.test(value)) {
    return { valid: false, message: `Value does not match required format for ${meta.name}` };
  }

  return { valid: true };
}

/**
 * Auto-formats or pads values for fixed-length numeric symbologies so BarTender behaves seamlessly
 */
export function formatValueForSymbology(symbology: BarcodeSymbology, rawValue: string): string {
  if (!rawValue) return rawValue;
  const s = rawValue.trim();

  // Interleaved 2 of 5 requires an even number of digits. If odd, prepend leading '0'
  if (symbology === 'interleaved2of5' && /^\d+$/.test(s) && s.length % 2 !== 0) {
    return '0' + s;
  }

  return s;
}

/**
 * Renders barcode to HTML Canvas element with high DPI scaling and BarTender formatting
 */
export async function renderBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  element: BarcodeElement,
  scale: number = 2,
  ctxEval?: EvaluationContext
): Promise<void> {
  const meta = getSymbologyMetadata(element.symbology);
  const rawEvaluated = evaluateElementData(element, ctxEval);
  const evaluatedValue = (rawEvaluated !== undefined && rawEvaluated !== '') 
    ? rawEvaluated 
    : (element.value !== undefined && element.value !== '') 
      ? element.value 
      : meta.defaultSample;

  const formattedText = formatValueForSymbology(element.symbology, evaluatedValue);

  try {
    const is2D = meta.is2D;
    
    // bwip-js options
    const options: any = {
      bcid: meta.bwipBcId || 'code128',
      text: formattedText || '12345678',
      scale: Math.max(1, Math.round(scale * (element.barWidth || 1.8))),
    };

    if (!is2D) {
      options.height = Math.max(8, Math.round((element.barHeight || 12) * 1.5));
      options.includetext = Boolean(element.includeText !== false);
      options.textxalign = element.humanReadableAlignment || element.horizontalAlignment || element.textAlign || 'center';
      options.textyalign = element.textPosition === 'above' ? 'above' : 'below';

      let fSize = element.humanReadableFontSize || element.fontSize || 12;
      if (element.autoSize || element.autoSizeText) {
        const minPt = Math.max(4, element.minFontSize || 6);
        const maxPt = Math.max(minPt, element.maxFontSize || 20);
        const textLen = (formattedText || '').length || 8;
        const availableWidthPx = Math.max(20, element.width * scale * 0.85);
        // Estimate max point size that fits available width
        const charWidthRatio = 0.55;
        const calculatedPt = Math.floor(availableWidthPx / (textLen * charWidthRatio * (scale / 2)));
        fSize = Math.max(minPt, Math.min(maxPt, calculatedPt));
      }

      options.textsize = Math.max(4, Math.min(36, Math.round(fSize)));

      const fontName = element.humanReadableFont || element.fontFamily;
      if (fontName) {
        const cleanFont = fontName.trim();
        if (/^(ocr-a|ocr-b|courier|helvetica|times)$/i.test(cleanFont)) {
          options.textfont = cleanFont;
        }
      }
      const textCol = element.humanReadableColor || element.color || element.foregroundColor;
      if (textCol) {
        const col = textCol.replace('#', '');
        if (/^[0-9A-Fa-f]{6}$/.test(col)) {
          options.textcolor = col;
        }
      }
      if (element.humanReadableOffsetV) {
        options.textgap = Math.max(0, Math.round(element.humanReadableOffsetV));
      }
      if (element.humanReadableCustomFormat) {
        // e.g. "(01) {0}" format template
        options.alttext = element.humanReadableCustomFormat.replace('{0}', formattedText);
      }
    }

    if (element.backgroundColor && element.backgroundColor !== 'transparent') {
      const bg = element.backgroundColor.replace('#', '');
      if (/^[0-9A-Fa-f]{6}$/.test(bg)) {
        options.backgroundcolor = bg;
      }
    }
    if (element.foregroundColor) {
      const fg = element.foregroundColor.replace('#', '');
      if (/^[0-9A-Fa-f]{6}$/.test(fg)) {
        options.barcolor = fg;
      }
    }

    if (element.errorCorrectionLevel && (element.symbology === 'qr' || element.symbology === 'aztec')) {
      options.eclevel = element.errorCorrectionLevel;
    }

    bwipjs.toCanvas(canvas, options);

    // If Bearer Bars are enabled (e.g. for ITF-14 or carton labels), draw top & bottom bearer borders
    if (element.bearerBars && !is2D) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = element.foregroundColor || '#000000';
        const barThick = (element.bearerBarThickness || 3) * scale;
        // Top bar
        ctx.fillRect(0, 0, canvas.width, barThick);
        // Bottom bar
        ctx.fillRect(0, canvas.height - barThick, canvas.width, barThick);
        if (element.bearerBarType === 'complete') {
          // Left & Right bars
          ctx.fillRect(0, 0, barThick, canvas.height);
          ctx.fillRect(canvas.width - barThick, 0, barThick, canvas.height);
        }
      }
    }
  } catch (err: any) {
    // Secondary fallback: Try clean standard rendering with the user's actual text without complex font/color modifiers
    try {
      const retryOpts: any = {
        bcid: meta.bwipBcId || 'code128',
        text: formattedText || '12345678',
        scale: Math.max(1, Math.round(scale * (element.barWidth || 1.8))),
      };
      if (!meta.is2D) {
        retryOpts.height = Math.max(8, Math.round((element.barHeight || 12) * 1.5));
        retryOpts.includetext = Boolean(element.includeText !== false);
        retryOpts.textxalign = 'center';
      }
      bwipjs.toCanvas(canvas, retryOpts);
      return;
    } catch {
      // If even standard rendering fails, then display invalid data warning
    }

    console.warn(`[BarcodeEngine] Failed to render ${meta.name} with value "${evaluatedValue}":`, err?.message || err);
    
    // Draw explicit, clear BarTender invalid barcode warning on canvas (Never silently draw a fake 12345678 sample barcode!)
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = Math.max(120, Math.round(element.width * scale * 2));
      canvas.height = Math.max(40, Math.round(element.height * scale * 2));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
      
      // Diagonal subtle stripes
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.lineWidth = 1;
      for (let x = -canvas.height; x < canvas.width + canvas.height; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + canvas.height, canvas.height);
        ctx.stroke();
      }

      ctx.fillStyle = '#b91c1c';
      ctx.font = `bold ${Math.max(10, Math.round(11 * scale))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚠ ${meta.name}: Invalid Data`, canvas.width / 2, canvas.height / 2 - 8);
      
      ctx.font = `${Math.max(8, Math.round(9 * scale))}px monospace`;
      ctx.fillStyle = '#4b5563';
      const dispText = String(evaluatedValue).length > 20 ? String(evaluatedValue).slice(0, 18) + '…' : String(evaluatedValue);
      ctx.fillText(`"${dispText}"`, canvas.width / 2, canvas.height / 2 + 8);
    }
  }
}

/**
 * Generates an SVG string representation of a barcode
 */
export function generateBarcodeSVG(element: BarcodeElement, ctxEval?: EvaluationContext): string {
  const meta = getSymbologyMetadata(element.symbology);
  const rawEvaluated = evaluateElementData(element, ctxEval);
  const cleanValue = (rawEvaluated !== undefined && rawEvaluated !== '')
    ? rawEvaluated
    : (element.value !== undefined && element.value !== '')
      ? element.value
      : meta.defaultSample;

  const formattedValue = formatValueForSymbology(element.symbology, cleanValue);

  try {
    const is2D = meta.is2D;
    const opts: any = {
      bcid: meta.bwipBcId || 'code128',
      text: formattedValue,
      scale: Math.max(1, Math.round(element.barWidth || 2)),
    };

    if (!is2D) {
      opts.height = Math.max(10, Math.round(element.barHeight * 2));
      opts.includetext = Boolean(element.includeText);
      opts.textxalign = 'center';
    }

    if (element.foregroundColor) {
      const fg = element.foregroundColor.replace('#', '');
      if (/^[0-9A-Fa-f]{6}$/.test(fg)) {
        opts.barcolor = fg;
      }
    }

    return bwipjs.toSVG(opts);
  } catch (e) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="100%" height="100%" fill="#fef2f2"/><text x="50%" y="50%" text-anchor="middle" fill="#dc2626" font-size="10">Invalid Barcode</text></svg>`;
  }
}
