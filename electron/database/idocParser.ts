/**
 * Production-Grade SAP IDoc Parser
 * BarcodeFlow Enterprise Suite
 * Parses SAP IDoc XML and Flat Text files with hierarchy preservation, repeating segment resolution,
 * and missing field strategies.
 */
import fs from 'fs';
import path from 'path';

export interface ParsedIdocSegment {
  id: string;
  name: string;
  level: number;
  parentSegmentId?: string;
  fields: Record<string, string>;
  children: ParsedIdocSegment[];
  isRepeated?: boolean;
}

export interface ParsedIdocDocument {
  idocType: string;
  docNum?: string;
  controlRecord: Record<string, string>;
  rootSegments: ParsedIdocSegment[];
  allSegmentNames: string[];
  allFieldNames: string[];
  records: Record<string, string>[];
  totalRecords: number;
}

/**
 * Parses simple XML into clean element hierarchy without external native dependencies
 */
function parseSimpleXml(xmlText: string): any {
  // Strip XML declaration, doctype, and comments
  const clean = xmlText
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  const tagRegex = /<(\/)?([a-zA-Z0-9_\-:]+)((?:\s+[a-zA-Z0-9_\-:]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/)?>|([^<]+)/g;
  let match: RegExpExecArray | null;

  interface XmlNode {
    tag: string;
    attributes: Record<string, string>;
    children: XmlNode[];
    text: string;
    parent?: XmlNode;
  }

  const root: XmlNode = { tag: '__ROOT__', attributes: {}, children: [], text: '' };
  let current: XmlNode = root;

  while ((match = tagRegex.exec(clean)) !== null) {
    const isClosing = !!match[1];
    const tagName = match[2];
    const attrString = match[3];
    const isSelfClosing = !!match[4];
    const rawText = match[5];

    if (rawText && rawText.trim()) {
      current.text += (current.text ? ' ' : '') + rawText.trim();
    } else if (tagName) {
      if (isClosing) {
        if (current.parent) {
          current = current.parent;
        }
      } else {
        const attributes: Record<string, string> = {};
        if (attrString) {
          const attrRegex = /([a-zA-Z0-9_\-:]+)=["']([^"']*)["']/g;
          let aMatch: RegExpExecArray | null;
          while ((aMatch = attrRegex.exec(attrString)) !== null) {
            attributes[aMatch[1]] = aMatch[2];
          }
        }

        const newNode: XmlNode = {
          tag: tagName,
          attributes,
          children: [],
          text: '',
          parent: current,
        };
        current.children.push(newNode);

        if (!isSelfClosing) {
          current = newNode;
        }
      }
    }
  }

  return root.children[0] || root;
}

/**
 * Recursively extracts SAP segments from XML DOM
 */
function extractXmlSegments(node: any, level: number = 1, parentId?: string): ParsedIdocSegment[] {
  const segments: ParsedIdocSegment[] = [];
  if (!node || !node.children) return segments;

  let segCounter = 1;
  for (const child of node.children) {
    // A segment typically contains leaf fields (text children) or nested child segments
    const hasComplexChildren = child.children && child.children.some((c: any) => c.children && c.children.length > 0);
    const leafFields: Record<string, string> = {};

    for (const attrKey of Object.keys(child.attributes || {})) {
      leafFields[attrKey] = child.attributes[attrKey];
    }

    const childSegments: any[] = [];
    for (const sub of child.children || []) {
      if (sub.children && sub.children.length > 0) {
        childSegments.push(sub);
      } else {
        leafFields[sub.tag] = sub.text || '';
      }
    }

    const segId = `${child.tag}_${level}_${segCounter++}`;
    const parsedSeg: ParsedIdocSegment = {
      id: segId,
      name: child.tag,
      level,
      parentSegmentId: parentId,
      fields: leafFields,
      children: [],
    };

    if (childSegments.length > 0) {
      for (const cs of childSegments) {
        parsedSeg.children.push(...extractXmlSegments(cs, level + 1, segId));
      }
    }

    segments.push(parsedSeg);
  }

  return segments;
}

/**
 * Parses Flat text structured IDoc format (SAP Standard Flat IDoc format)
 */
function parseFlatIdocText(rawText: string): ParsedIdocDocument {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const controlRecord: Record<string, string> = {};
  const rootSegments: ParsedIdocSegment[] = [];
  let idocType = 'DELVRY03';
  const allSegmentNames = new Set<string>();
  const allFieldNames = new Set<string>();

  let counter = 1;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('EDI_DC40') || trimmed.startsWith('EDI_DC')) {
      const parts = line.split(/\s+/);
      controlRecord['SEGMENT'] = 'EDI_DC40';
      if (parts[1]) controlRecord['IDOCTYP'] = parts[1];
      if (parts[2]) controlRecord['DOCNUM'] = parts[2];
      if (parts[3]) controlRecord['STATUS'] = parts[3];
      if (parts[1]) idocType = parts[1];
      allSegmentNames.add('EDI_DC40');
      Object.keys(controlRecord).forEach((k) => allFieldNames.add(`EDI_DC40.${k}`));
    } else {
      const segNameMatch = line.match(/^([A-Z0-9_]{6,10})/);
      const segName = segNameMatch ? segNameMatch[1] : `SEG_${counter}`;
      allSegmentNames.add(segName);

      const fields: Record<string, string> = { RAW: line };
      const tokens = line.slice(segName.length).trim().split(/\s{2,}|\t/);
      tokens.forEach((tok, idx) => {
        const fKey = `FIELD_${idx + 1}`;
        fields[fKey] = tok.trim();
        allFieldNames.add(`${segName}.${fKey}`);
      });

      rootSegments.push({
        id: `${segName}_${counter++}`,
        name: segName,
        level: 1,
        fields,
        children: [],
      });
    }
  }

  const records = flattenIdocSegments(rootSegments, controlRecord, 'search_master');

  return {
    idocType,
    docNum: controlRecord['DOCNUM'] || '1000000001',
    controlRecord,
    rootSegments,
    allSegmentNames: Array.from(allSegmentNames),
    allFieldNames: Array.from(allFieldNames),
    records,
    totalRecords: records.length,
  };
}

/**
 * Flattens IDoc hierarchy into relational rows for BarcodeFlow label printing
 */
function flattenIdocSegments(
  segments: ParsedIdocSegment[],
  controlRecord: Record<string, string>,
  missingFieldRule: 'search_master' | 'use_empty'
): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const baseControl: Record<string, string> = {};

  for (const [k, v] of Object.entries(controlRecord)) {
    baseControl[k] = v;
    baseControl[`EDI_DC40.${k}`] = v;
  }

  // Find lowest-level repeating item segments (e.g. E1EDL24, E1EDP01, etc.)
  function collectLeafPaths(
    seg: ParsedIdocSegment,
    currentAccum: Record<string, string>,
    results: Record<string, string>[]
  ) {
    const combined = { ...currentAccum };
    for (const [fName, fVal] of Object.entries(seg.fields)) {
      combined[fName] = fVal;
      combined[`${seg.name}.${fName}`] = fVal;
    }

    if (!seg.children || seg.children.length === 0) {
      results.push(combined);
    } else {
      for (const child of seg.children) {
        collectLeafPaths(child, combined, results);
      }
    }
  }

  for (const root of segments) {
    const segmentRows: Record<string, string>[] = [];
    collectLeafPaths(root, baseControl, segmentRows);
    rows.push(...segmentRows);
  }

  if (rows.length === 0) {
    rows.push({ ...baseControl });
  }

  // Apply missing field rules
  if (missingFieldRule === 'search_master') {
    // Master values already cascaded down through hierarchy in collectLeafPaths
    return rows;
  }

  return rows;
}

/**
 * Parse an IDoc string (XML or flat text)
 */
export function parseIdocContent(
  content: string,
  options: { missingFieldRule?: 'search_master' | 'use_empty'; selectedType?: string } = {}
): ParsedIdocDocument {
  const missingFieldRule = options.missingFieldRule || 'search_master';
  const trimmed = content.trim();

  // 1. XML IDoc
  if (trimmed.startsWith('<')) {
    const xmlRoot = parseSimpleXml(trimmed);
    let idocType = options.selectedType || xmlRoot.tag || 'DELVRY03';
    let idocNode = xmlRoot;

    // Drill down to IDOC container if nested
    if (xmlRoot.tag.toUpperCase() !== 'IDOC' && xmlRoot.children && xmlRoot.children.length > 0) {
      const foundIdoc = xmlRoot.children.find((c: any) => c.tag.toUpperCase() === 'IDOC');
      if (foundIdoc) {
        idocNode = foundIdoc;
      }
    }

    const controlRecord: Record<string, string> = {};
    const rootSegments: ParsedIdocSegment[] = [];
    const allSegmentNames = new Set<string>();
    const allFieldNames = new Set<string>();

    for (const child of idocNode.children || []) {
      const upperTag = child.tag.toUpperCase();
      if (upperTag === 'EDI_DC40' || upperTag === 'EDI_DC' || upperTag === 'CONTROL') {
        for (const sub of child.children || []) {
          controlRecord[sub.tag] = sub.text || '';
          allFieldNames.add(`EDI_DC40.${sub.tag}`);
          allFieldNames.add(sub.tag);
        }
        allSegmentNames.add('EDI_DC40');
        if (controlRecord['IDOCTYP']) {
          idocType = controlRecord['IDOCTYP'];
        }
      } else {
        const segs = extractXmlSegments({ children: [child] }, 1);
        for (const s of segs) {
          rootSegments.push(s);
          allSegmentNames.add(s.name);
          for (const f of Object.keys(s.fields)) {
            allFieldNames.add(`${s.name}.${f}`);
            allFieldNames.add(f);
          }
          function walk(cs: ParsedIdocSegment) {
            allSegmentNames.add(cs.name);
            for (const f of Object.keys(cs.fields)) {
              allFieldNames.add(`${cs.name}.${f}`);
              allFieldNames.add(f);
            }
            cs.children.forEach(walk);
          }
          s.children.forEach(walk);
        }
      }
    }

    const records = flattenIdocSegments(rootSegments, controlRecord, missingFieldRule);

    return {
      idocType,
      docNum: controlRecord['DOCNUM'] || controlRecord['IDOCNUM'] || '1000000001',
      controlRecord,
      rootSegments,
      allSegmentNames: Array.from(allSegmentNames),
      allFieldNames: Array.from(allFieldNames),
      records,
      totalRecords: records.length,
    };
  }

  // 2. Flat Text IDoc
  return parseFlatIdocText(trimmed);
}

/**
 * Reads and parses an IDoc file from disk
 */
export async function parseIdocFile(
  filePath: string,
  options: { missingFieldRule?: 'search_master' | 'use_empty'; selectedType?: string } = {}
): Promise<{ success: boolean; data?: ParsedIdocDocument; error?: string; errorCode?: string }> {
  try {
    const resolvedPath = path.normalize(path.resolve(filePath));
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, errorCode: 'FILE_NOT_FOUND', error: `IDoc file not found: "${filePath}"` };
    }

    const content = await fs.promises.readFile(resolvedPath, 'utf-8');
    const parsed = parseIdocContent(content, options);

    return {
      success: true,
      data: parsed,
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'INVALID_IDOC',
      error: `Failed to parse SAP IDoc file: ${err.message}`,
    };
  }
}
