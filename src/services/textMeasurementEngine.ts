/**
 * BarcodeFlow Enterprise - Central Text Measurement Engine
 * 
 * Provides accurate, physical-dimension (mm) font measurement based on real browser/canvas font metrics.
 * Supports:
 * - Single-line tight auto-sizing
 * - Multi-line and paragraph text with word-wrapping reflow
 * - Font families, point sizes (pt), bold/italic weights, letter spacing, line heights
 * - HTML and Rich Text markup container strip/measurement
 * - Unicode special characters (©, ™, ₹, ±, ½, etc.)
 * - Subtle usability padding
 * - High performance LRU caching
 */

import { TextElement, BorderConfig } from '../types';

export interface TextMeasurementParams {
  text: string;
  fontFamily?: string;
  fontSize?: number; // In pt (standard points, 1 pt = 25.4 / 72 mm)
  fontWeight?: string | number; // 'normal' | 'bold' | '600' | '700' | '800'
  fontStyle?: string; // 'normal' | 'italic' | 'oblique'
  letterSpacing?: number; // In px or pt
  lineHeight?: number; // Multiplier, e.g. 1.15, 1.2
  fontWidthScale?: number; // Percentage, default 100%
  textType?: string;
  textFormatType?: 'single-line' | 'paragraph' | 'arc';
  multiline?: boolean;
  wrap?: boolean;
  containerWidthMm?: number; // For paragraph word-wrapping height calculation
  borderConfig?: BorderConfig;
}

export interface MeasuredDimensions {
  width: number; // In mm
  height: number; // In mm
  linesCount: number;
}

// 1 point (pt) = 25.4 / 72 mm ≈ 0.352778 mm
export const MM_PER_PT = 25.4 / 72;
// 1 mm in CSS pixels at standard 96 DPI = 96 / 25.4 ≈ 3.779528 px
export const PX_PER_MM = 96 / 25.4;
// 1 pt in CSS pixels = (96 / 72) = 1.333333 px
export const PX_PER_PT = 96 / 72;

// Usability padding in mm (~2-4 screen px at 100% zoom)
const HORIZONTAL_PADDING_MM = 0.8;
const VERTICAL_PADDING_MM = 0.6;

// Minimum selectable dimensions in mm so empty/single char text remains clickable
const MIN_WIDTH_MM = 5.0;
const MIN_HEIGHT_MM = 3.0;

// Singleton canvas & 2D context for high-performance measurement
let measurementCanvas: HTMLCanvasElement | null = null;
let measurementCtx: CanvasRenderingContext2D | null = null;

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas');
    measurementCanvas.width = 2000;
    measurementCanvas.height = 1000;
    measurementCtx = measurementCanvas.getContext('2d', { willReadFrequently: false });
  }
  return measurementCtx;
}

// Simple in-memory LRU cache
const measurementCache = new Map<string, MeasuredDimensions>();
const MAX_CACHE_SIZE = 1500;

function generateCacheKey(p: TextMeasurementParams): string {
  return [
    p.text || '',
    p.fontFamily || 'Arial',
    p.fontSize || 10,
    p.fontWeight || 'normal',
    p.fontStyle || 'normal',
    p.letterSpacing || 0,
    p.lineHeight || 1.15,
    p.fontWidthScale || 100,
    p.textType || 'single-line',
    p.textFormatType || 'single-line',
    p.multiline ? '1' : '0',
    p.wrap ? '1' : '0',
    p.containerWidthMm ? p.containerWidthMm.toFixed(1) : 'auto',
    p.borderConfig?.type || 'none',
    p.borderConfig?.thickness || 0,
    p.borderConfig?.marginLeft || 0,
    p.borderConfig?.marginRight || 0,
    p.borderConfig?.marginTop || 0,
    p.borderConfig?.marginBottom || 0,
  ].join('|');
}

/**
 * Strips HTML / RTF tags for accurate glyph measurement of rich text containers.
 */
export function stripMarkupToPlainText(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('{\\rtf')) {
    return raw
      .replace(/\{\\rtf1[^\\]*/g, '')
      .replace(/\\b\s*(.*?)\\b0/g, '$1')
      .replace(/\\i\s*(.*?)\\i0/g, '$1')
      .replace(/\\par/g, '\n')
      .replace(/[\{\}\\]/g, '')
      .trim();
  }
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }
  return raw;
}

/**
 * Core text measurement function.
 * Measures text using actual browser font metrics and converts accurately to mm.
 */
export function measureTextObject(params: TextMeasurementParams): MeasuredDimensions {
  const rawText = params.text ?? '';
  const cleanText = stripMarkupToPlainText(rawText);
  const cacheKey = generateCacheKey({ ...params, text: cleanText });

  if (measurementCache.has(cacheKey)) {
    return measurementCache.get(cacheKey)!;
  }

  const fontFamily = params.fontFamily || 'Arial, sans-serif';
  const fontSizePt = Math.max(1, params.fontSize || 10);
  const fontWeight = params.fontWeight || 'normal';
  const fontStyle = params.fontStyle || 'normal';
  const letterSpacing = params.letterSpacing || 0;
  const lineHeightMult = params.lineHeight || 1.15;
  const fontWidthScale = (params.fontWidthScale || 100) / 100;

  const isParagraph =
    params.textFormatType === 'paragraph' ||
    params.textType === 'paragraph' ||
    (params.multiline && (params.wrap || (params.containerWidthMm !== undefined && params.containerWidthMm > 0)));

  const fontSizePx = fontSizePt * PX_PER_PT;
  const fontCss = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;

  const ctx = getMeasurementContext();
  let measuredWidthMm = MIN_WIDTH_MM;
  let measuredHeightMm = MIN_HEIGHT_MM;
  let totalLines = 1;

  const baseLineHeightMm = fontSizePt * MM_PER_PT * lineHeightMult;

  if (ctx) {
    ctx.font = fontCss;
    try {
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = `${letterSpacing}px`;
      }
    } catch {
      // Ignore if letterSpacing is not supported in the canvas context
    }

    if (!cleanText || cleanText.trim().length === 0) {
      // Empty text fallback
      const m = ctx.measureText('M');
      measuredWidthMm = Math.max(MIN_WIDTH_MM, (m.width * fontWidthScale) / PX_PER_MM + HORIZONTAL_PADDING_MM);
      measuredHeightMm = Math.max(MIN_HEIGHT_MM, baseLineHeightMm + VERTICAL_PADDING_MM);
      totalLines = 1;
    } else if (isParagraph && params.containerWidthMm && params.containerWidthMm > MIN_WIDTH_MM) {
      // Paragraph Word-Wrapping reflow calculation
      const availWidthPx = Math.max(20, (params.containerWidthMm - HORIZONTAL_PADDING_MM) * PX_PER_MM);
      const paragraphs = cleanText.split('\n');
      const wrappedLines: string[] = [];

      for (const para of paragraphs) {
        if (!para) {
          wrappedLines.push('');
          continue;
        }
        const words = para.split(' ');
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
          const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
          const testMetrics = ctx.measureText(testLine);
          const testWidth = testMetrics.width * fontWidthScale + (letterSpacing ? (testLine.length - 1) * letterSpacing : 0);

          if (testWidth > availWidthPx && currentLine) {
            wrappedLines.push(currentLine);
            currentLine = words[i];
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
      }

      totalLines = Math.max(1, wrappedLines.length);
      measuredWidthMm = params.containerWidthMm;
      measuredHeightMm = Math.max(MIN_HEIGHT_MM, totalLines * baseLineHeightMm + VERTICAL_PADDING_MM);
    } else {
      // Single-line or standard explicit multi-line (split by \n)
      const lines = cleanText.split('\n');
      totalLines = lines.length;
      let maxLineWidthPx = 0;

      for (const line of lines) {
        const lineStr = line || ' ';
        const metrics = ctx.measureText(lineStr);
        let lineWidth = metrics.width * fontWidthScale;
        if (letterSpacing && lineStr.length > 1) {
          lineWidth += (lineStr.length - 1) * letterSpacing;
        }
        if (lineWidth > maxLineWidthPx) {
          maxLineWidthPx = lineWidth;
        }
      }

      measuredWidthMm = Math.max(MIN_WIDTH_MM, (maxLineWidthPx / PX_PER_MM) + HORIZONTAL_PADDING_MM);
      measuredHeightMm = Math.max(MIN_HEIGHT_MM, (totalLines * baseLineHeightMm) + VERTICAL_PADDING_MM);
    }
  } else {
    // Fallback if canvas context is unavailable (e.g. unit tests / SSR)
    const weightMultiplier =
      fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900' ? 1.08 : 1.0;
    const approxCharWidthMm = fontSizePt * MM_PER_PT * 0.55 * fontWidthScale * weightMultiplier;

    if (isParagraph && params.containerWidthMm && params.containerWidthMm > MIN_WIDTH_MM) {
      const availCharsPerLine = Math.max(5, Math.floor((params.containerWidthMm - HORIZONTAL_PADDING_MM) / approxCharWidthMm));
      const words = cleanText ? cleanText.split(/\s+/) : ['M'];
      const wrappedLines: string[] = [];
      let currentLine = '';
      for (const w of words) {
        const test = currentLine ? `${currentLine} ${w}` : w;
        if (test.length > availCharsPerLine && currentLine) {
          wrappedLines.push(currentLine);
          currentLine = w;
        } else {
          currentLine = test;
        }
      }
      if (currentLine) wrappedLines.push(currentLine);
      totalLines = Math.max(1, wrappedLines.length);
      measuredWidthMm = params.containerWidthMm;
      measuredHeightMm = Math.max(MIN_HEIGHT_MM, (totalLines * baseLineHeightMm) + VERTICAL_PADDING_MM);
    } else {
      const lines = cleanText ? cleanText.split('\n') : ['M'];
      totalLines = lines.length;
      const maxChars = Math.max(1, ...lines.map((l) => l.length));
      measuredWidthMm = Math.max(MIN_WIDTH_MM, (maxChars * approxCharWidthMm) + HORIZONTAL_PADDING_MM);
      measuredHeightMm = Math.max(MIN_HEIGHT_MM, (totalLines * baseLineHeightMm) + VERTICAL_PADDING_MM);
    }
  }

  // Add border margins / border thickness if configured
  if (params.borderConfig && params.borderConfig.type && params.borderConfig.type !== 'none') {
    const b = params.borderConfig;
    const extraH = (b.marginLeft || 0) + (b.marginRight || 0) + (b.thickness ? b.thickness * MM_PER_PT * 2 : 0);
    const extraV = (b.marginTop || 0) + (b.marginBottom || 0) + (b.thickness ? b.thickness * MM_PER_PT * 2 : 0);
    measuredWidthMm += extraH;
    measuredHeightMm += extraV;
  }

  const result: MeasuredDimensions = {
    width: Math.round(measuredWidthMm * 10) / 10,
    height: Math.round(measuredHeightMm * 10) / 10,
    linesCount: totalLines,
  };

  if (measurementCache.size >= MAX_CACHE_SIZE) {
    const firstKey = measurementCache.keys().next().value;
    if (firstKey) measurementCache.delete(firstKey);
  }
  measurementCache.set(cacheKey, result);

  return result;
}

/**
 * Calculates updated dimensions for a TextElement based on its current properties and resolved display content.
 */
export function recalculateTextElementDimensions(
  element: TextElement,
  resolvedText?: string,
  targetContainerWidth?: number
): { width: number; height: number } {
  const textToMeasure = resolvedText !== undefined ? resolvedText : element.text || '';
  const isParagraph = element.textFormatType === 'paragraph' || element.textType === 'paragraph';

  const dims = measureTextObject({
    text: textToMeasure,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    letterSpacing: element.letterSpacing,
    lineHeight: element.lineHeight,
    fontWidthScale: element.fontWidthScale,
    textType: element.textType,
    textFormatType: element.textFormatType,
    multiline: element.multiline,
    wrap: element.wrap || element.wordWrap,
    containerWidthMm: isParagraph ? (targetContainerWidth || element.width) : undefined,
    borderConfig: element.borderConfig,
  });

  return {
    width: isParagraph && element.width > 0 ? (targetContainerWidth || element.width) : dims.width,
    height: dims.height,
  };
}
