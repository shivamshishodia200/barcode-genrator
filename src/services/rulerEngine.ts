import { UnitType } from '../types';

/**
 * Standard Physical Constants
 * Standard screen reference: 96 CSS DPI (1 inch = 96 CSS pixels, 1 inch = 25.4 mm)
 * Base Scale: 96 / 25.4 = 3.779527559055118 CSS pixels per mm
 */
export const MM_PER_INCH = 25.4;
export const BASE_DPI = 96;
export const BASE_PX_PER_MM = BASE_DPI / MM_PER_INCH; // ~3.779527559
export const BASE_PX_PER_INCH = BASE_DPI; // 96

export interface RulerTick {
  unitValue: number;
  screenPos: number;
  type: 'major' | 'medium' | 'minor';
  label?: string;
  isOrigin: boolean;
  isInDocument: boolean;
}

export interface TickIntervalConfig {
  majorStep: number;
  mediumStep?: number;
  minorStep: number;
  decimals: number;
}

/**
 * Convert physical mm to screen pixels relative to workspace origin (0)
 */
export function mmToScreenPx(mm: number, zoom: number, panOffset: number = 0): number {
  return mm * (BASE_PX_PER_MM * zoom) + panOffset;
}

/**
 * Convert screen pixels relative to workspace origin (0) to physical mm
 */
export function screenPxToMm(screenPx: number, zoom: number, panOffset: number = 0): number {
  const scale = BASE_PX_PER_MM * zoom;
  if (scale === 0) return 0;
  return (screenPx - panOffset) / scale;
}

/**
 * Convert physical inch to screen pixels relative to workspace origin (0)
 */
export function inchToScreenPx(inch: number, zoom: number, panOffset: number = 0): number {
  return inch * (BASE_PX_PER_INCH * zoom) + panOffset;
}

/**
 * Convert screen pixels to physical inch
 */
export function screenPxToInch(screenPx: number, zoom: number, panOffset: number = 0): number {
  const scale = BASE_PX_PER_INCH * zoom;
  if (scale === 0) return 0;
  return (screenPx - panOffset) / scale;
}

/**
 * Convert any supported unit to screen pixels
 */
export function unitToScreenPx(val: number, unit: UnitType, zoom: number, panOffset: number = 0): number {
  if (unit === 'inch') {
    return inchToScreenPx(val, zoom, panOffset);
  }
  if (unit === 'px') {
    return val * zoom + panOffset;
  }
  return mmToScreenPx(val, zoom, panOffset);
}

/**
 * Convert screen pixels to specified unit
 */
export function screenPxToUnit(screenPx: number, unit: UnitType, zoom: number, panOffset: number = 0): number {
  if (unit === 'inch') {
    return screenPxToInch(screenPx, zoom, panOffset);
  }
  if (unit === 'px') {
    if (zoom === 0) return 0;
    return (screenPx - panOffset) / zoom;
  }
  return screenPxToMm(screenPx, zoom, panOffset);
}

/**
 * Determine dynamic tick intervals based on zoom level and unit.
 * Ensures major ticks stay comfortably spaced (approx 45px - 120px apart).
 */
export function getTickIntervalConfig(unit: UnitType, zoom: number): TickIntervalConfig {
  if (unit === 'inch') {
    const pxPerInch = BASE_PX_PER_INCH * zoom;
    // Standard inch major steps
    const inchSteps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20];
    
    for (const step of inchSteps) {
      if (step * pxPerInch >= 45) {
        let minorStep = step / 4;
        let mediumStep = step / 2;
        let decimals = step < 0.1 ? 2 : step < 1 ? 1 : 0;
        
        if (step <= 0.1) {
          minorStep = step / 2;
          mediumStep = undefined;
        } else if (step >= 2) {
          minorStep = 0.5;
          mediumStep = 1;
        }
        
        return { majorStep: step, mediumStep, minorStep, decimals };
      }
    }
    return { majorStep: 20, mediumStep: 10, minorStep: 5, decimals: 0 };
  }

  // MM Mode: Standard mm candidate intervals
  const pxPerMm = (unit === 'px' ? 1 : BASE_PX_PER_MM) * zoom;
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

  for (const step of steps) {
    if (step * pxPerMm >= 45) {
      let minorStep = step / 10;
      let mediumStep: number | undefined = step / 2;
      let decimals = step < 1 ? 1 : 0;

      if (step === 0.1 || step === 0.2) {
        minorStep = step / 2;
        mediumStep = undefined;
        decimals = 2;
      } else if (step === 0.5) {
        minorStep = 0.1;
        mediumStep = undefined;
        decimals = 1;
      } else if (step === 1) {
        minorStep = 0.2;
        mediumStep = 0.5;
        decimals = 0;
      } else if (step === 2) {
        minorStep = 0.5;
        mediumStep = 1;
        decimals = 0;
      } else if (step === 5) {
        minorStep = 1;
        mediumStep = undefined;
        decimals = 0;
      } else if (step === 10) {
        minorStep = 1;
        mediumStep = 5;
        decimals = 0;
      } else if (step === 20) {
        minorStep = 2;
        mediumStep = 10;
        decimals = 0;
      } else if (step >= 50) {
        minorStep = 10;
        mediumStep = step / 2;
        decimals = 0;
      }

      return { majorStep: step, mediumStep, minorStep, decimals };
    }
  }

  return { majorStep: 500, mediumStep: 250, minorStep: 50, decimals: 0 };
}

/**
 * Format numeric value for ruler labels cleanly without floating point artifacts
 */
export function formatRulerLabel(value: number, decimals: number): string {
  if (Math.abs(value) < 1e-7) return '0';
  
  if (decimals === 0) {
    return Math.round(value).toString();
  }
  const formatted = value.toFixed(decimals);
  return formatted.replace(/\.?0+$/, '');
}

export interface VisibleTicksOptions {
  viewportLengthPx: number;
  panOffset: number; // document origin screen pixel position
  zoom: number;
  unit: UnitType;
  docDimensionMm: number; // width or height in mm
}

/**
 * Computes all visible ruler ticks and labels efficiently for a given viewport span.
 */
export function getVisibleRulerTicks(options: VisibleTicksOptions): RulerTick[] {
  const { viewportLengthPx, panOffset, zoom, unit, docDimensionMm } = options;
  if (viewportLengthPx <= 0) return [];

  const intervalConfig = getTickIntervalConfig(unit, zoom);
  const { majorStep, mediumStep, minorStep, decimals } = intervalConfig;

  // Physical range visible in the viewport
  const minUnit = screenPxToUnit(0, unit, zoom, panOffset);
  const maxUnit = screenPxToUnit(viewportLengthPx, unit, zoom, panOffset);

  const docDimensionUnit = unit === 'inch' ? docDimensionMm / MM_PER_INCH : unit === 'px' ? docDimensionMm * (BASE_DPI / MM_PER_INCH) : docDimensionMm;

  // Buffer 1 major step to the left and right
  const startMajor = Math.floor(minUnit / majorStep) * majorStep - majorStep;
  const endMajor = Math.ceil(maxUnit / majorStep) * majorStep + majorStep;

  const ticks: RulerTick[] = [];
  const epsilon = minorStep * 0.01;

  // Generate minor and major ticks
  for (let u = startMajor; u <= endMajor + epsilon; u += minorStep) {
    const roundedU = Math.round(u / (minorStep / 100)) * (minorStep / 100);
    const screenPos = Math.round(unitToScreenPx(roundedU, unit, zoom, panOffset) * 10) / 10;

    // Skip ticks outside the visible viewport buffer
    if (screenPos < -40 || screenPos > viewportLengthPx + 40) {
      continue;
    }

    const isOrigin = Math.abs(roundedU) < 1e-5;
    const isInDocument = roundedU >= -1e-5 && roundedU <= docDimensionUnit + 1e-5;

    // Check if this is a major tick
    const majorMod = Math.abs(roundedU % majorStep);
    const isMajor = majorMod < epsilon || Math.abs(majorMod - majorStep) < epsilon;

    let isMedium = false;
    if (!isMajor && mediumStep) {
      const mediumMod = Math.abs(roundedU % mediumStep);
      isMedium = mediumMod < epsilon || Math.abs(mediumMod - mediumStep) < epsilon;
    }

    const type: 'major' | 'medium' | 'minor' = isMajor ? 'major' : isMedium ? 'medium' : 'minor';
    const label = isMajor ? formatRulerLabel(roundedU, decimals) : undefined;

    ticks.push({
      unitValue: roundedU,
      screenPos,
      type,
      label,
      isOrigin,
      isInDocument,
    });
  }

  return ticks;
}
