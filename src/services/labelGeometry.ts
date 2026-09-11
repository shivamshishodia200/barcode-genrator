import { LabelTemplate, LabelElement } from '../types';

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns the physical printable bounding rectangle for a label template in mm
 */
export function getLabelBounds(template: Pick<LabelTemplate, 'dimensions'>): RectBounds {
  return {
    x: 0,
    y: 0,
    width: template.dimensions.width,
    height: template.dimensions.height,
  };
}

/**
 * Returns the bounding rectangle for any canvas object in mm
 */
export function getObjectBounds(element: Pick<LabelElement, 'x' | 'y' | 'width' | 'height'>): RectBounds {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

/**
 * Checks if any portion of the object extends outside the printable label boundary (0,0 to width,height)
 */
export function isObjectOutOfBounds(
  element: Pick<LabelElement, 'x' | 'y' | 'width' | 'height'>,
  template: Pick<LabelTemplate, 'dimensions'>
): boolean {
  const label = getLabelBounds(template);
  const obj = getObjectBounds(element);

  return (
    obj.x < label.x ||
    obj.y < label.y ||
    obj.x + obj.width > label.width ||
    obj.y + obj.height > label.height
  );
}

/**
 * Checks if the object lies completely outside the printable label boundary
 */
export function isObjectCompletelyOutOfBounds(
  element: Pick<LabelElement, 'x' | 'y' | 'width' | 'height'>,
  template: Pick<LabelTemplate, 'dimensions'>
): boolean {
  const label = getLabelBounds(template);
  const obj = getObjectBounds(element);

  return (
    obj.x + obj.width <= label.x ||
    obj.y + obj.height <= label.y ||
    obj.x >= label.width ||
    obj.y >= label.height
  );
}

/**
 * Computes intersection rectangle between two bounding boxes
 */
export function getIntersectionRect(r1: RectBounds, r2: RectBounds): RectBounds | null {
  const x = Math.max(r1.x, r2.x);
  const y = Math.max(r1.y, r2.y);
  const right = Math.min(r1.x + r1.width, r2.x + r2.width);
  const bottom = Math.min(r1.y + r1.height, r2.y + r2.height);

  if (right <= x || bottom <= y) {
    return null;
  }

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

/**
 * Resolves printable clipped geometry for an element against the label rectangle
 */
export function resolvePrintableGeometry(
  element: Pick<LabelElement, 'x' | 'y' | 'width' | 'height'>,
  template: Pick<LabelTemplate, 'dimensions'>
): {
  isFullyInside: boolean;
  isPartiallyOutside: boolean;
  isCompletelyOutside: boolean;
  intersection: RectBounds | null;
  clippedWidth: number;
  clippedHeight: number;
} {
  const label = getLabelBounds(template);
  const obj = getObjectBounds(element);
  const intersection = getIntersectionRect(label, obj);

  const isPartiallyOutside = isObjectOutOfBounds(element, template);
  const isCompletelyOutside = isObjectCompletelyOutOfBounds(element, template);
  const isFullyInside = !isPartiallyOutside;

  return {
    isFullyInside,
    isPartiallyOutside,
    isCompletelyOutside,
    intersection,
    clippedWidth: intersection ? intersection.width : 0,
    clippedHeight: intersection ? intersection.height : 0,
  };
}

/**
 * Generates user-facing warning if object extends outside printable area
 */
export function getOutOfBoundsWarning(
  element: LabelElement,
  template: LabelTemplate
): string | null {
  if (!isObjectOutOfBounds(element, template)) {
    return null;
  }

  if (element.type === 'barcode') {
    return 'Barcode extends outside printable area and may not scan correctly.';
  }

  return 'Object extends outside printable label area.';
}
