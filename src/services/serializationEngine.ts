import { SerializationConfig } from '../types';

/**
 * Utility to increment/decrement alphabetic sequence:
 * A -> B ... Z -> AA -> AB
 * z -> aa -> ab
 */
export function stepAlphabetic(str: string, step: number, isLower = false): string {
  if (!str) return isLower ? 'a' : 'A';
  
  // Convert alphabetic string to base-26 numeric value (1-indexed)
  let val = 0;
  const baseCode = isLower ? 97 : 65;
  const upper = str.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    val = val * 26 + (upper.charCodeAt(i) - 64);
  }

  val += step;
  if (val < 1) val = 1;

  // Convert back to base-26 letters
  let res = '';
  while (val > 0) {
    const rem = (val - 1) % 26;
    res = String.fromCharCode(baseCode + rem) + res;
    val = Math.floor((val - 1) / 26);
  }

  return res;
}

/**
 * Increment/decrement numeric string with padding preservation
 */
export function stepNumeric(str: string, step: number, preserveLength = false): string {
  const match = str.match(/^([+-]?\d+)$/);
  if (!match) {
    // If string has trailing digits (e.g. "ITEM-001"), increment only the numeric suffix
    const trailingMatch = str.match(/^(.*?)(\d+)$/);
    if (trailingMatch) {
      const pfx = trailingMatch[1];
      const digits = trailingMatch[2];
      return `${pfx}${stepNumeric(digits, step, preserveLength)}`;
    }
    const num = parseInt(str, 10) || 0;
    const resNum = Math.max(0, num + step);
    return String(resNum);
  }

  const rawDigits = match[1];
  const originalLen = rawDigits.length;
  const isPadded = rawDigits.startsWith('0') && originalLen > 1;
  const num = parseInt(rawDigits, 10);
  const nextNum = Math.max(0, num + step);

  if (preserveLength || isPadded) {
    const nextStr = String(nextNum);
    if (nextStr.length < originalLen) {
      return nextStr.padStart(originalLen, '0');
    }
    return nextStr;
  }

  return String(nextNum);
}

/**
 * Increment/decrement alphanumeric string (e.g. A009 -> A010, SN-001 -> SN-002, A999 -> B000)
 */
export function stepAlphanumeric(str: string, step: number, preserveLength = true): string {
  if (!str) return stepNumeric('1', step - 1, preserveLength);

  // Match trailing digits if any: e.g. "A009" => prefix "A", digits "009"
  const trailingDigitsMatch = str.match(/^(.*?)(\d+)$/);
  if (trailingDigitsMatch) {
    const prefix = trailingDigitsMatch[1];
    const digits = trailingDigitsMatch[2];
    const digitLen = digits.length;
    const num = parseInt(digits, 10);
    const maxVal = Math.pow(10, digitLen);
    const nextNum = num + step;

    if (nextNum >= 0 && nextNum < maxVal) {
      // Normal within-digit range
      const padded = String(nextNum).padStart(digitLen, '0');
      return `${prefix}${padded}`;
    }

    if (nextNum >= maxVal && prefix.length > 0) {
      // Overflow into alphabetic prefix
      const overflowCount = Math.floor(nextNum / maxVal);
      const remainderNum = nextNum % maxVal;
      const nextPrefix = stepAlphabetic(prefix, overflowCount, prefix === prefix.toLowerCase());
      const padded = String(remainderNum).padStart(digitLen, '0');
      return `${nextPrefix}${padded}`;
    }

    // No alphabetic prefix to overflow into, expand digits
    const padded = String(Math.max(0, nextNum)).padStart(digitLen, '0');
    return `${prefix}${padded}`;
  }

  // Pure letters: e.g. "ABC"
  const isAllLetters = /^[a-zA-Z]+$/.test(str);
  if (isAllLetters) {
    return stepAlphabetic(str, step, str === str.toLowerCase());
  }

  // Fallback to numeric
  return stepNumeric(str, step, preserveLength);
}

/**
 * Evaluates serialized value based on config and item/record/copy indices
 */
export function evaluateSerializedValue(
  initialValue: string,
  config?: SerializationConfig,
  context?: {
    printIndex?: number;
    recordIndex?: number;
    copyIndex?: number;
    copiesPerRecord?: number;
  }
): string {
  if (!config || config.action === 'none') {
    return initialValue || '';
  }

  const action = config.action;
  const method = config.method || 'alphanumeric';
  const rawInc = config.incrementBy !== undefined ? config.incrementBy : (config as any).step;
  const incrementBy = rawInc !== undefined && rawInc !== 0 ? rawInc : 1;
  const preserveLength = config.preserveCharacters !== false && (config as any).preserveLength !== false;
  const rawEvent = (config.event as string) || 'standard';
  const interval = Math.max(1, config.eventInterval || (config as any).interval || 1);
  const copiesPerSerial = Math.max(1, config.copies || (config as any).copiesPerValue || 1);

  const printIndex = context?.printIndex ?? 0;
  const recordIndex = context?.recordIndex ?? 0;
  const copyIndex = context?.copyIndex ?? 0;

  // Calculate effective step multiplier
  let stepMultiplier = 0;
  if (rawEvent === 'item' || rawEvent === 'standard' || rawEvent === 'every_label') {
    stepMultiplier = Math.floor(printIndex / (interval * copiesPerSerial));
  } else if (rawEvent === 'record') {
    stepMultiplier = Math.floor(recordIndex / interval);
  } else if (rawEvent === 'interval') {
    stepMultiplier = Math.floor(printIndex / (interval * copiesPerSerial));
  }

  const effectiveStep = (action === 'decrement' ? -1 : 1) * incrementBy * stepMultiplier;
  if (effectiveStep === 0) {
    return initialValue;
  }

  let result = initialValue;
  if (method === 'numeric') {
    result = stepNumeric(initialValue, effectiveStep, preserveLength);
  } else if (method === 'alphabetic') {
    const isLower = config.letterCase === 'lowercase' || initialValue === initialValue.toLowerCase();
    result = stepAlphabetic(initialValue, effectiveStep, isLower);
  } else {
    // Alphanumeric
    result = stepAlphanumeric(initialValue, effectiveStep, preserveLength);
  }

  return result;
}

export interface PreviewSequenceItem {
  printIndex: number;
  recordIndex: number;
  copyIndex: number;
  serializedValue: string;
  finalValue: string;
}

/**
 * Non-destructive preview sequence generator
 */
export function generatePreviewSequence(
  initialValue: string,
  config: SerializationConfig,
  options: {
    recordCount?: number;
    copies?: number;
    prefix?: string;
    suffix?: string;
    maxItems?: number;
  } = {}
): PreviewSequenceItem[] {
  const maxItems = Math.min(100, Math.max(1, options.maxItems ?? 10));
  const copies = Math.max(1, options.copies ?? config.copies ?? 1);
  const prefix = options.prefix ?? '';
  const suffix = options.suffix ?? '';

  // If recordCount is specified and > 1, use recordCount * copies up to maxItems
  // Otherwise preview sequence up to maxItems so the operator can inspect the progression
  const targetCount = options.recordCount && options.recordCount > 1
    ? Math.min(maxItems, options.recordCount * copies)
    : maxItems;

  const sequence: PreviewSequenceItem[] = [];

  for (let printIdx = 0; printIdx < targetCount; printIdx++) {
    const r = Math.floor(printIdx / copies);
    const c = printIdx % copies;

    const serializedVal = evaluateSerializedValue(initialValue, config, {
      printIndex: printIdx,
      recordIndex: r,
      copyIndex: c,
      copiesPerRecord: copies,
    });

    const finalVal = `${prefix}${serializedVal}${suffix}`;
    sequence.push({
      printIndex: printIdx + 1,
      recordIndex: r + 1,
      copyIndex: c + 1,
      serializedValue: serializedVal,
      finalValue: finalVal,
    });
  }

  return sequence;
}

export interface SerialReservation {
  id: string;
  documentId: string;
  elementId: string;
  startSerial: string;
  endSerial: string;
  count: number;
  status: 'reserved' | 'submitted' | 'completed' | 'failed' | 'cancelled';
  reservedAt: string;
  updatedAt: string;
}

const RESERVATION_STORAGE_KEY = 'barcodeflow_serial_reservations';

export class AtomicSerialReservationService {
  private static getReservations(): SerialReservation[] {
    try {
      const raw = localStorage.getItem(RESERVATION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static saveReservations(list: SerialReservation[]): void {
    try {
      localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to persist serial reservations:', err);
    }
  }

  public static reserve(
    documentId: string,
    elementId: string,
    startValue: string,
    config: SerializationConfig,
    count: number
  ): SerialReservation {
    const list = this.getReservations();
    const endValue = evaluateSerializedValue(startValue, config, { printIndex: count - 1 });
    
    const reservation: SerialReservation = {
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      documentId,
      elementId,
      startSerial: startValue,
      endSerial: endValue,
      count,
      status: 'reserved',
      reservedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    list.push(reservation);
    this.saveReservations(list);
    return reservation;
  }

  public static updateStatus(
    reservationId: string,
    status: 'submitted' | 'completed' | 'failed' | 'cancelled'
  ): void {
    const list = this.getReservations();
    const target = list.find((r) => r.id === reservationId);
    if (target) {
      target.status = status;
      target.updatedAt = new Date().toISOString();
      this.saveReservations(list);
    }
  }
}

/**
 * Computes what the next value will be after printing `count` items
 */
export function computeNextSerialValue(
  startValue: string,
  config?: SerializationConfig,
  count: number = 1
): string {
  if (!config || config.action === 'none' || count <= 0) return startValue;
  return evaluateSerializedValue(startValue, config, { printIndex: count });
}

/**
 * Commits a completed print job by advancing serial counter states on template elements.
 * This is only called after a successful confirmed print job dispatch.
 */
export function advanceTemplateSerialState(template: any, printedCount: number): any {
  if (printedCount <= 0 || !template?.elements) return template;

  const updatedElements = template.elements.map((el: any) => {
    let hasChanged = false;
    let updatedDsList: any[] | undefined = undefined;

    if (el.dataSources && el.dataSources.length > 0) {
      updatedDsList = el.dataSources.map((ds: any) => {
        const serialConfig = ds.serialization || ds.transformConfig?.serialization;
        if (serialConfig && serialConfig.action !== 'none') {
          const currentBase = serialConfig.currentValue || ds.value || '000001';
          const nextVal = computeNextSerialValue(currentBase, serialConfig, printedCount);
          hasChanged = true;
          return {
            ...ds,
            value: nextVal,
            serialization: {
              ...serialConfig,
              currentValue: nextVal,
            },
            ...(ds.transformConfig
              ? {
                  transformConfig: {
                    ...ds.transformConfig,
                    serialization: {
                      ...serialConfig,
                      currentValue: nextVal,
                    },
                  },
                }
              : {}),
          };
        }
        return ds;
      });
    }

    if (hasChanged && updatedDsList) {
      return {
        ...el,
        dataSources: updatedDsList,
        ...(el.type === 'barcode' ? { value: updatedDsList[0]?.value || el.value } : {}),
        ...(el.type === 'text' ? { text: updatedDsList[0]?.value || el.text } : {}),
      };
    }

    return el;
  });

  return {
    ...template,
    elements: updatedElements,
    updatedAt: new Date().toISOString(),
  };
}

