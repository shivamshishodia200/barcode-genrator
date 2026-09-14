import { LabelTemplate, LabelElement, DpiOption } from '../types';

export interface BarTenderParseResult {
  template: LabelTemplate;
  printerName?: string;
  printerDpi?: number;
  appVersion?: string;
  hasEmbeddedPreview: boolean;
  rawTextCount: number;
}

/**
 * Universal BarTender (.btw) binary format parser.
 * Safely extracts:
 * 1. Embedded high-resolution label design preview (PNG stream).
 * 2. Printer target, model, and DPI from BarTender format headers.
 * 3. Text content, barcode strings, and metadata.
 * 4. Generates a fully compatible, interactive BarcodeFlow LabelTemplate.
 */
export function parseBarTenderDocument(
  rawData: Buffer | Uint8Array | ArrayBuffer | string | any,
  fileName: string = 'BarTender Document.btw'
): LabelTemplate {
  // If already a valid LabelTemplate object, return directly
  if (rawData && typeof rawData === 'object' && rawData.elements && rawData.dimensions) {
    return rawData as LabelTemplate;
  }

  // Convert rawData to Uint8Array safely across Node.js and Browser environments
  let bytes: Uint8Array;
  if (rawData instanceof Uint8Array) {
    bytes = rawData;
  } else if (rawData instanceof ArrayBuffer) {
    bytes = new Uint8Array(rawData);
  } else if (typeof rawData === 'string') {
    bytes = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      bytes[i] = rawData.charCodeAt(i) & 0xff;
    }
  } else if (rawData && typeof rawData === 'object' && rawData.data) {
    bytes = new Uint8Array(rawData.data);
  } else {
    bytes = new Uint8Array(0);
  }

  // 1. Extract Header Metadata from Latin-1 String
  let latinStr = '';
  const scanLen = Math.min(bytes.length, 32768);
  for (let i = 0; i < scanLen; i++) {
    latinStr += String.fromCharCode(bytes[i]);
  }

  let printerName: string | undefined = undefined;
  let printerDpi: DpiOption = 300;
  let appVersion = 'BarTender Enterprise';

  const printerMatch = latinStr.match(/Printer:\s*Name=([^;\r\n]+)/i);
  if (printerMatch && printerMatch[1]) {
    const raw = printerMatch[1].trim();
    if (raw && !raw.toLowerCase().includes('default windows printer')) {
      printerName = raw;
    }
  }

  const dpiMatch = latinStr.match(/(\d+)\s*dpi/i);
  if (dpiMatch && dpiMatch[1]) {
    const val = parseInt(dpiMatch[1], 10);
    if (val === 203 || val === 300 || val === 600) {
      printerDpi = val;
    }
  }

  const appMatch = latinStr.match(/Application:\s*Version=([^;\r\n]+)/i);
  if (appMatch && appMatch[1]) {
    appVersion = `BarTender v${appMatch[1].trim()}`;
  }

  // 2. Scan and Extract Embedded High-Resolution PNG Preview
  let previewDataUrl: string | null = null;
  let previewWidthPx = 800;
  let previewHeightPx = 600;
  let physWidthMm: number | null = null;
  let physHeightMm: number | null = null;

  // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  let pngStartIdx = -1;

  for (let i = 0; i <= bytes.length - 8; i++) {
    let match = true;
    for (let m = 0; m < 8; m++) {
      if (bytes[i + m] !== pngMagic[m]) {
        match = false;
        break;
      }
    }
    if (match) {
      pngStartIdx = i;
      break;
    }
  }

  if (pngStartIdx !== -1) {
    // Look for PNG IEND chunk: 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    const iendMagic = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
    let pngEndIdx = -1;

    for (let i = pngStartIdx; i <= bytes.length - 8; i++) {
      let match = true;
      for (let m = 0; m < 8; m++) {
        if (bytes[i + m] !== iendMagic[m]) {
          match = false;
          break;
        }
      }
      if (match) {
        pngEndIdx = i + 8;
        break;
      }
    }

    if (pngEndIdx !== -1 && pngEndIdx > pngStartIdx) {
      const pngBytes = bytes.subarray(pngStartIdx, pngEndIdx);
      if (pngBytes.length >= 24) {
        // Read width & height from IHDR chunk (big endian at offsets 16 and 20)
        const w = (pngBytes[16] << 24) | (pngBytes[17] << 16) | (pngBytes[18] << 8) | pngBytes[19];
        const h = (pngBytes[20] << 24) | (pngBytes[21] << 16) | (pngBytes[22] << 8) | pngBytes[23];
        if (w > 0 && h > 0) {
          previewWidthPx = w;
          previewHeightPx = h;
        }
      }

      // Check for PNG pHYs (Physical pixel dimensions) chunk
      for (let p = 8; p < pngBytes.length - 13; p++) {
        if (
          pngBytes[p] === 0x70 &&
          pngBytes[p + 1] === 0x48 &&
          pngBytes[p + 2] === 0x59 &&
          pngBytes[p + 3] === 0x73
        ) {
          const ppuX = ((pngBytes[p + 4] << 24) | (pngBytes[p + 5] << 16) | (pngBytes[p + 6] << 8) | pngBytes[p + 7]) >>> 0;
          const ppuY = ((pngBytes[p + 8] << 24) | (pngBytes[p + 9] << 16) | (pngBytes[p + 10] << 8) | pngBytes[p + 11]) >>> 0;
          const unit = pngBytes[p + 12]; // 1 = meters
          if (unit === 1 && ppuX > 1000 && ppuY > 1000 && previewWidthPx > 0 && previewHeightPx > 0) {
            const calcW = Math.round(((previewWidthPx / ppuX) * 1000) * 10) / 10;
            const calcH = Math.round(((previewHeightPx / ppuY) * 1000) * 10) / 10;
            if (calcW >= 15 && calcW <= 350 && calcH >= 10 && calcH <= 350) {
              physWidthMm = calcW;
              physHeightMm = calcH;
            }
          }
          break;
        }
      }

      // Convert to base64
      let binaryStr = '';
      const chunkLen = 8192;
      for (let i = 0; i < pngBytes.length; i += chunkLen) {
        const slice = pngBytes.subarray(i, Math.min(i + chunkLen, pngBytes.length));
        binaryStr += String.fromCharCode.apply(null, Array.from(slice));
      }
      const b64 = typeof window !== 'undefined' && typeof window.btoa === 'function'
        ? window.btoa(binaryStr)
        : Buffer.from(pngBytes).toString('base64');

      previewDataUrl = `data:image/png;base64,${b64}`;
    }
  }

  // 3. Compute Aspect Ratio and Physical Label Dimensions in Millimeters
  let widthMm = 100;
  let heightMm = 75;

  const dimMatch = fileName.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/);
  if (dimMatch) {
    const d1 = parseFloat(dimMatch[1]);
    const d2 = parseFloat(dimMatch[2]);
    if (d1 > 0 && d2 > 0) {
      if (d1 <= 15 && d2 <= 15) {
        // Likely specified in inches (e.g. 6.25x5, 4x6, 6x4)
        widthMm = Math.round(d1 * 25.4 * 10) / 10;
        heightMm = Math.round(d2 * 25.4 * 10) / 10;
      } else if (d1 <= 300 && d2 <= 300) {
        // Specified in millimeters (e.g. 100x150, 50x30)
        widthMm = Math.round(d1);
        heightMm = Math.round(d2);
      }
    }
  } else if (physWidthMm && physHeightMm) {
    widthMm = physWidthMm;
    heightMm = physHeightMm;
  } else if (previewWidthPx > 0 && previewHeightPx > 0) {
    const aspectRatio = previewWidthPx / previewHeightPx;
    if (Math.abs(aspectRatio - 1) > 0.05) {
      heightMm = Math.round(widthMm / aspectRatio);
    }
  }
  if (heightMm < 20) heightMm = 20;
  if (heightMm > 250) heightMm = 250;

  // 4. Extract Meaningful Text & Barcode Strings (UTF-16LE & ASCII)
  const meaningfulStrings: string[] = [];
  const seen = new Set<string>();
  const boilerplate = [
    'bar tender format file',
    'seagull scientific',
    'enterprise automation',
    'windows',
    'compatibleversion',
    'archiveversion',
    'ihdr',
    'idat',
    'phys',
    'time',
    'textauthor',
    'textdescription',
    'textcopyright',
  ];

  // UTF-16LE scan
  let curUtf16 = '';
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    if (b1 === 0 && b0 >= 32 && b0 <= 126) {
      curUtf16 += String.fromCharCode(b0);
    } else {
      if (curUtf16.trim().length >= 4) {
        const val = curUtf16.trim();
        const low = val.toLowerCase();
        if (!boilerplate.some((bp) => low.includes(bp)) && !seen.has(low)) {
          seen.add(low);
          meaningfulStrings.push(val);
        }
      }
      curUtf16 = '';
    }
  }

  // ASCII scan
  const asciiMatches: string[] = latinStr.match(/[\x20-\x7E]{4,}/g) || [];
  asciiMatches.forEach((s: string) => {
    const val = s.trim();
    const low = val.toLowerCase();
    if (!boilerplate.some((bp) => low.includes(bp)) && !seen.has(low)) {
      seen.add(low);
      meaningfulStrings.push(val);
    }
  });

  // 5. Construct Authentic BarcodeFlow Elements
  const elements: LabelElement[] = [];
  let zIndex = 1;

  // Layer 1: High-fidelity BarTender layout preview background
  if (previewDataUrl) {
    elements.push({
      id: `el-btw-preview-${Date.now()}`,
      type: 'image',
      name: 'BarTender Template Layout',
      x: 0,
      y: 0,
      width: widthMm,
      height: heightMm,
      rotation: 0,
      zIndex: zIndex++,
      visible: true,
      locked: false,
      opacity: 1,
      src: previewDataUrl,
      objectFit: 'contain',
      grayscale: false,
      invert: false,
      aspectRatioLocked: true,
    } as unknown as LabelElement);
  }

  // Layer 2: Extract barcodes or key data text
  meaningfulStrings.slice(0, 5).forEach((str, idx) => {
    const isBarcodeLike = /^\d{8,14}$/.test(str) || /^([A-Z0-9_-]{8,20})$/.test(str);
    if (isBarcodeLike && elements.length < 5) {
      elements.push({
        id: `el-btw-barcode-${Date.now()}-${idx}`,
        type: 'barcode',
        name: `BarTender Data (${str})`,
        x: 10,
        y: Math.min(heightMm - 22, 10 + idx * 16),
        width: Math.min(widthMm - 20, 60),
        height: 18,
        rotation: 0,
        zIndex: zIndex++,
        visible: true,
        locked: false,
        barcodeType: str.length === 12 ? 'UPCA' : str.length === 13 ? 'EAN13' : 'CODE128',
        data: str,
        humanReadable: true,
        fontSize: 10,
        color: '#000000',
        backgroundColor: 'transparent',
      } as any);
    }
  });

  // If no elements could be extracted, generate standard layout
  if (elements.length === 0) {
    elements.push({
      id: `el-btw-txt-${Date.now()}`,
      type: 'text',
      name: 'BarTender Document Title',
      x: 10,
      y: 10,
      width: widthMm - 20,
      height: 15,
      rotation: 0,
      zIndex: zIndex++,
      visible: true,
      locked: false,
      text: fileName.replace(/\.btw$/i, ''),
      fontSize: 14,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      color: '#000000',
      textAlign: 'center',
    } as any);
  }

  // 6. Build Final LabelTemplate
  const cleanName = fileName.endsWith('.btw') || fileName.endsWith('.BTW') ? fileName : `${fileName}.btw`;

  const template: LabelTemplate = {
    id: `tmpl-btw-${Date.now()}`,
    name: cleanName,
    description: `BarTender Label Template (${appVersion})`,
    category: 'Logistics',
    version: '1.0',
    status: 'draft',
    tags: ['BarTender', '.btw', 'Imported'],
    dimensions: {
      width: widthMm,
      height: heightMm,
      unit: 'mm',
      dpi: printerDpi,
      orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    },
    margins: { top: 2, right: 2, bottom: 2, left: 2, bleed: 0, safeZone: 2 },
    shape: 'rectangle',
    cornerRadius: 0,
    mediaType: 'gap',
    elements,
    variables: [],
    sampleRecords: [{}],
    printer: printerName
      ? {
          id: 'printer-btw',
          name: printerName,
          systemName: printerName,
          model: printerName,
          dpi: printerDpi,
        }
      : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'BarTender Format Engine',
  };

  return template;
}
