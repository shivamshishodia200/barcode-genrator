import { LabelTemplate, LabelElement, ObjectPrintMethodSettings, TextPrintMethod, BarcodePrintMethod, ShapePrintMethod } from '../types';
import { PrinterModel } from '../printer/types';

export const GLOBAL_PRINT_METHOD_STORAGE_KEY = 'barcodeflow_global_object_print_method';

export const DEFAULT_OBJECT_PRINT_METHOD_SETTINGS: ObjectPrintMethodSettings = {
  scope: 'global',
  trueTypeText: 'auto',
  unsupported1D: 'auto',
  unsupported2D: 'auto',
  lines: 'auto',
  boxes: 'auto',
  ellipses: 'auto',
};

export interface ObjectMethodDiagnostic {
  objectId: string;
  objectType: string;
  requestedMethod: string;
  resolvedMethod: 'text-output' | 'native' | 'vector' | 'raster';
  reason: string;
  printer: string;
  protocol: string;
  timestamp: string;
}

/**
 * Loads the global object print method settings from localStorage.
 */
export function getGlobalObjectPrintMethodSettings(): ObjectPrintMethodSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_OBJECT_PRINT_METHOD_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(GLOBAL_PRINT_METHOD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_OBJECT_PRINT_METHOD_SETTINGS,
        ...parsed,
        scope: 'global',
      };
    }
  } catch (err) {
    console.warn('[ObjectPrintMethodService] Failed to load global settings:', err);
  }
  return { ...DEFAULT_OBJECT_PRINT_METHOD_SETTINGS };
}

/**
 * Persists global object print method settings to localStorage.
 */
export function saveGlobalObjectPrintMethodSettings(settings: ObjectPrintMethodSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const toSave = { ...settings, scope: 'global' as const };
    localStorage.setItem(GLOBAL_PRINT_METHOD_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn('[ObjectPrintMethodService] Failed to save global settings:', err);
  }
}

/**
 * Resolves the effective settings according to resolution order:
 * Document Override (if template.objectPrintMethodSettings?.scope === 'document') -> Global Setting -> Default
 */
export function getEffectiveObjectPrintMethodSettings(template?: LabelTemplate): ObjectPrintMethodSettings {
  if (template?.objectPrintMethodSettings && template.objectPrintMethodSettings.scope === 'document') {
    return {
      ...DEFAULT_OBJECT_PRINT_METHOD_SETTINGS,
      ...template.objectPrintMethodSettings,
      scope: 'document',
    };
  }
  return getGlobalObjectPrintMethodSettings();
}

/**
 * Native symbology capability lookup tables for thermal protocols
 */
const ZPL_NATIVE_1D = new Set(['code128', 'code39', 'code93', 'ean13', 'ean8', 'upca', 'upce', 'itf14', 'interleaved2of5', 'codabar', 'msi', 'gs1-128']);
const ZPL_NATIVE_2D = new Set(['qr', 'datamatrix', 'pdf417', 'aztec', 'maxicode', 'micro-qr', 'gs1-qr', 'gs1-datamatrix']);

const TSPL_NATIVE_1D = new Set(['code128', 'code39', 'code93', 'ean13', 'ean8', 'upca', 'upce', 'itf14', 'interleaved2of5', 'codabar', 'msi']);
const TSPL_NATIVE_2D = new Set(['qr', 'datamatrix', 'pdf417', 'aztec']);

export interface ResolvePrintMethodParams {
  element: LabelElement;
  printer?: PrinterModel | null;
  outputProtocol?: 'pdf' | 'windows-driver' | 'zpl' | 'tspl' | 'epl' | 'cpcl' | 'sbpl';
  settings?: ObjectPrintMethodSettings;
}

export interface ResolvedPrintMethodResult {
  resolvedMethod: 'text-output' | 'native' | 'vector' | 'raster';
  reason: string;
  diagnostics: ObjectMethodDiagnostic;
}

/**
 * Deterministic Print Method Resolver
 * Computes exact rendering mode (text-output, native, vector, raster) and logs diagnostic trace.
 */
export function resolveObjectPrintMethod({
  element,
  printer,
  outputProtocol = 'pdf',
  settings = DEFAULT_OBJECT_PRINT_METHOD_SETTINGS,
}: ResolvePrintMethodParams): ResolvedPrintMethodResult {
  const printerName = printer?.name || 'Generic Printer';
  const protocol = outputProtocol || (printer?.preferredRenderer?.toLowerCase() as any) || 'pdf';

  let requestedMethod: string = 'auto';
  let resolvedMethod: 'text-output' | 'native' | 'vector' | 'raster' = 'vector';
  let reason = '';

  const isZpl = protocol === 'zpl';
  const isTspl = protocol === 'tspl';
  const isThermal = isZpl || isTspl || protocol === 'epl' || protocol === 'cpcl' || protocol === 'sbpl';

  if (element.type === 'text') {
    requestedMethod = settings.trueTypeText || 'auto';
    if (requestedMethod === 'raster') {
      resolvedMethod = 'raster';
      reason = 'Operator configured raster output for TrueType text.';
    } else if (requestedMethod === 'vector') {
      resolvedMethod = 'vector';
      reason = 'Operator configured vector output for TrueType text.';
    } else if (requestedMethod === 'text-output') {
      if (isThermal) {
        resolvedMethod = 'native';
        reason = `Native thermal printer text stream selected for ${protocol.toUpperCase()}.`;
      } else {
        resolvedMethod = 'text-output';
        reason = 'Standard text stream selected for Windows Driver / PDF pipeline.';
      }
    } else {
      // Auto Mode
      if (isThermal) {
        resolvedMethod = 'native';
        reason = `Auto resolved to native printer font for ${protocol.toUpperCase()}.`;
      } else {
        resolvedMethod = 'vector';
        reason = 'Auto resolved to high-precision vector text rendering.';
      }
    }
  } else if (element.type === 'barcode') {
    const symbology = (element.symbology || 'code128').toLowerCase();
    const is2D = ['qr', 'datamatrix', 'pdf417', 'aztec', 'maxicode', 'micro-qr', 'gs1-qr', 'gs1-datamatrix', 'hibc-datamatrix'].includes(symbology);
    requestedMethod = is2D ? settings.unsupported2D || 'auto' : settings.unsupported1D || 'auto';

    const isNativeSupported = isZpl
      ? (is2D ? ZPL_NATIVE_2D.has(symbology) : ZPL_NATIVE_1D.has(symbology))
      : isTspl
      ? (is2D ? TSPL_NATIVE_2D.has(symbology) : TSPL_NATIVE_1D.has(symbology))
      : false;

    if (requestedMethod === 'raster') {
      resolvedMethod = 'raster';
      reason = 'Operator explicitly selected raster mode for barcode.';
    } else if (requestedMethod === 'vector') {
      resolvedMethod = 'vector';
      reason = 'Operator explicitly selected vector mode for barcode.';
    } else if (requestedMethod === 'native') {
      if (isNativeSupported) {
        resolvedMethod = 'native';
        reason = `Native barcode supported on ${protocol.toUpperCase()} (${symbology}).`;
      } else {
        // Fallback chain: Native -> Vector
        resolvedMethod = 'vector';
        reason = `Native barcode not supported for "${symbology}" on ${printerName}; falling back to vector.`;
      }
    } else {
      // Auto Mode
      if (isThermal && isNativeSupported) {
        resolvedMethod = 'native';
        reason = `Auto selected native barcode commands for ${protocol.toUpperCase()} (${symbology}).`;
      } else {
        resolvedMethod = 'vector';
        reason = `Auto selected vector SVG barcode rendering.`;
      }
    }
  } else if (element.type === 'shape') {
    const shapeType = element.shapeType || 'rectangle';
    if (shapeType === 'line') {
      requestedMethod = settings.lines || 'auto';
    } else if (shapeType === 'circle' || shapeType === 'ellipse') {
      requestedMethod = settings.ellipses || 'auto';
    } else {
      requestedMethod = settings.boxes || 'auto';
    }

    if (requestedMethod === 'raster') {
      resolvedMethod = 'raster';
      reason = `Operator selected raster mode for ${shapeType}.`;
    } else if (requestedMethod === 'vector') {
      resolvedMethod = 'vector';
      reason = `Operator selected vector mode for ${shapeType}.`;
    } else if (requestedMethod === 'native') {
      if (isThermal && (shapeType === 'rectangle' || shapeType === 'line')) {
        resolvedMethod = 'native';
        reason = `Native shape commands supported on ${protocol.toUpperCase()}.`;
      } else {
        resolvedMethod = 'vector';
        reason = `Native shape rendering not available for ${shapeType} on ${printerName}; falling back to vector.`;
      }
    } else {
      // Auto Mode
      if (isThermal && (shapeType === 'rectangle' || shapeType === 'line')) {
        resolvedMethod = 'native';
        reason = `Auto selected native shape commands on ${protocol.toUpperCase()}.`;
      } else {
        resolvedMethod = 'vector';
        reason = `Auto selected vector rendering for ${shapeType}.`;
      }
    }
  } else {
    // Image or Container
    resolvedMethod = 'raster';
    requestedMethod = 'raster';
    reason = 'Bitmap raster image output.';
  }

  const diagnostics: ObjectMethodDiagnostic = {
    objectId: element.id,
    objectType: element.type,
    requestedMethod,
    resolvedMethod,
    reason,
    printer: printerName,
    protocol,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    console.debug(`[PrintMethodResolver] Object "${element.id}" (${element.type}) -> Requested: ${requestedMethod} | Resolved: ${resolvedMethod} | Reason: ${reason}`);
  }

  return {
    resolvedMethod,
    reason,
    diagnostics,
  };
}
