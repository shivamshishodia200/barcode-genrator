import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fork, ChildProcess } from 'child_process';
import { registerPrinterIpc } from './printer/printerIPC';
import { registerDatabaseIpc } from './database/databaseIPC';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV === 'development';

function startBackendServer() {
  const serverCjs = path.join(__dirname, '../dist/server.cjs');
  const serverJs = path.join(__dirname, '../dist/server.js');
  const serverPath = isDev
    ? path.join(__dirname, '../server.ts')
    : (fs.existsSync(serverCjs) ? serverCjs : serverJs);

  if (!fs.existsSync(serverPath)) {
    console.log(`[Electron Main] Server file not found at ${serverPath}, assuming external server is running.`);
    return;
  }

  try {
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: isDev ? 'development' : 'production' },
      silent: true,
    });

    serverProcess.on('error', (err) => {
      console.log('[Electron Main] Backend process error (server may already be running):', err.message);
    });

    console.log(`[Electron Main] Backend process configured on port ${PORT}`);
  } catch (err) {
    console.error('[Electron Main] Failed to spawn backend server process:', err);
  }
}

import * as XLSX from 'xlsx';

const activeFileWatchers = new Map<string, fs.FSWatcher>();
let fileChangeDebounceTimer: NodeJS.Timeout | null = null;

// --- Production-Grade Excel & Spreadsheet Provider Core ---

interface CellExtractionResult {
  rawValue: any;
  displayValue: string;
  formula?: string;
  dataType: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'empty' | 'error';
  numberFormat?: string;
  dateValue?: string;
}

function resolveFilePath(targetPath: string, projectDir?: string): { resolvedPath: string; exists: boolean } {
  if (!targetPath || !targetPath.trim()) return { resolvedPath: '', exists: false };
  const trimmed = targetPath.trim();
  const directPath = path.normalize(path.resolve(trimmed));
  if (fs.existsSync(directPath)) {
    return { resolvedPath: directPath, exists: true };
  }
  if (projectDir && fs.existsSync(projectDir)) {
    const relPath = path.normalize(path.resolve(projectDir, trimmed));
    if (fs.existsSync(relPath)) {
      return { resolvedPath: relPath, exists: true };
    }
  }
  return { resolvedPath: directPath, exists: false };
}

async function safelyReadFileWithRetry(filePath: string, maxRetries = 3): Promise<Buffer> {
  const backoffs = [0, 300, 800];
  let lastErr: any = null;
  for (let i = 0; i < maxRetries; i++) {
    if (backoffs[i] > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoffs[i]));
    }
    try {
      const fd = fs.openSync(filePath, 'r');
      fs.closeSync(fd);
      return await fs.promises.readFile(filePath);
    } catch (err: any) {
      lastErr = err;
      if (err.code === 'EBUSY' || err.code === 'EACCES' || err.code === 'EPERM') {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function formatExcelDateSerial(serial: number, formatMask: string = 'YYYY-MM-DD'): string {
  try {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    if (isNaN(date.getTime())) return String(serial);

    const yyyy = date.getUTCFullYear().toString();
    const yy = yyyy.slice(-2);
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = date.getUTCDate().toString().padStart(2, '0');
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mmm = monthNamesShort[date.getUTCMonth()];

    return formatMask
      .replace(/YYYY/g, yyyy)
      .replace(/YY/g, yy)
      .replace(/MMM/g, mmm)
      .replace(/MM/g, mm)
      .replace(/DD/g, dd);
  } catch {
    return String(serial);
  }
}

function extractNormalizedCell(cell: XLSX.CellObject | undefined): CellExtractionResult {
  if (!cell || cell.v === undefined || cell.v === null) {
    if (cell && cell.f) {
      return {
        rawValue: null,
        displayValue: '#VALUE_NOT_CALCULATED#',
        formula: cell.f,
        dataType: 'formula',
      };
    }
    return {
      rawValue: null,
      displayValue: '',
      dataType: 'empty',
    };
  }

  const formula = cell.f ? String(cell.f) : undefined;
  const numFmt = cell.z ? String(cell.z) : undefined;

  // Formula cell with cached value
  if (formula) {
    const disp = cell.w !== undefined ? String(cell.w) : String(cell.v);
    return {
      rawValue: cell.v,
      displayValue: disp,
      formula,
      dataType: 'formula',
      numberFormat: numFmt,
    };
  }

  // Error cell
  if (cell.t === 'e') {
    return {
      rawValue: cell.v,
      displayValue: cell.w ? String(cell.w) : '#ERROR!',
      dataType: 'error',
    };
  }

  // Boolean cell
  if (cell.t === 'b' || typeof cell.v === 'boolean') {
    return {
      rawValue: cell.v,
      displayValue: cell.v ? 'TRUE' : 'FALSE',
      dataType: 'boolean',
    };
  }

  // Date cell
  if (cell.t === 'd' || cell.v instanceof Date) {
    const d = cell.v instanceof Date ? cell.v : new Date(cell.v);
    const iso = !isNaN(d.getTime()) ? d.toISOString() : undefined;
    const disp = cell.w ? String(cell.w) : iso ? iso.slice(0, 10) : String(cell.v);
    return {
      rawValue: cell.v,
      displayValue: disp,
      dateValue: iso,
      dataType: 'date',
      numberFormat: numFmt,
    };
  }

  // String cell (CRITICAL: Preserves leading zeros like '001234567890' exactly!)
  if (cell.t === 's' || typeof cell.v === 'string') {
    const str = String(cell.v);
    return {
      rawValue: str,
      displayValue: cell.w !== undefined ? String(cell.w) : str,
      dataType: 'text',
      numberFormat: numFmt,
    };
  }

  // Number cell
  if (cell.t === 'n' || typeof cell.v === 'number') {
    const num = Number(cell.v);
    // Check if number format indicates an Excel date serial
    const isDateFormat = numFmt && /([ymdhs]|AM\/PM)/i.test(numFmt) && !/[#0]/.test(numFmt);
    if (isDateFormat && num > 30000 && num < 70000) {
      const dateStr = formatExcelDateSerial(num);
      return {
        rawValue: num,
        displayValue: cell.w ? String(cell.w) : dateStr,
        dateValue: dateStr,
        dataType: 'date',
        numberFormat: numFmt,
      };
    }

    // Number with leading zeros format (e.g. 0000000000) -> cell.w has formatted string
    const disp = cell.w !== undefined ? String(cell.w) : String(num);
    return {
      rawValue: num,
      displayValue: disp,
      dataType: 'number',
      numberFormat: numFmt,
    };
  }

  return {
    rawValue: cell.v,
    displayValue: String(cell.w ?? cell.v ?? ''),
    dataType: 'text',
  };
}

interface ParsedWorkbookSheetData {
  columns: { name: string; originalName: string; index: number }[];
  fieldInfos: {
    name: string;
    displayName: string;
    dataType: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'barcode';
    originalName: string;
    sampleValue: string;
  }[];
  allRows: Record<string, string>[];
  normalizedCells: Record<string, CellExtractionResult>[];
}

function parseWorksheetData(
  sheet: XLSX.WorkSheet,
  headerRow: number = 1,
  hasHeaders: boolean = true
): ParsedWorkbookSheetData {
  if (!sheet || !sheet['!ref']) {
    return { columns: [], fieldInfos: [], allRows: [], normalizedCells: [] };
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const maxCol = range.e.c;
  const maxRow = range.e.r;

  const headerRowIdx = hasHeaders ? Math.max(0, headerRow - 1) : -1;
  const headerCounts: Record<string, number> = {};
  const columns: { name: string; originalName: string; index: number }[] = [];

  for (let c = range.s.c; c <= maxCol; c++) {
    let orig = `Column_${c + 1}`;
    if (hasHeaders && headerRowIdx >= 0) {
      const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })];
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        orig = String(cell.w || cell.v).trim();
      }
    }
    headerCounts[orig] = (headerCounts[orig] || 0) + 1;
    const uniqueName = headerCounts[orig] === 1 ? orig : `${orig}_${headerCounts[orig]}`;
    columns.push({ name: uniqueName, originalName: orig, index: c });
  }

  const startDataRow = hasHeaders ? headerRowIdx + 1 : range.s.r;
  const allRows: Record<string, string>[] = [];
  const normalizedCells: Record<string, CellExtractionResult>[] = [];

  for (let r = startDataRow; r <= maxRow; r++) {
    let hasAnyData = false;
    const rowObj: Record<string, string> = {};
    const normObj: Record<string, CellExtractionResult> = {};

    for (const col of columns) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: col.index })];
      const extracted = extractNormalizedCell(cell);
      rowObj[col.name] = extracted.displayValue;
      normObj[col.name] = extracted;
      if (extracted.dataType !== 'empty' && extracted.displayValue !== '') {
        hasAnyData = true;
      }
    }

    if (hasAnyData) {
      allRows.push(rowObj);
      normalizedCells.push(normObj);
    }
  }

  // Infer field types
  const fieldInfos = columns.map((col) => {
    let textCount = 0;
    let numCount = 0;
    let dateCount = 0;
    let boolCount = 0;
    let formulaCount = 0;
    let sampleVal = '';

    const sampleLimit = Math.min(normalizedCells.length, 50);
    for (let i = 0; i < sampleLimit; i++) {
      const cell = normalizedCells[i][col.name];
      if (!cell || cell.dataType === 'empty') continue;
      if (!sampleVal) sampleVal = cell.displayValue;

      if (cell.dataType === 'formula') formulaCount++;
      else if (cell.dataType === 'date') dateCount++;
      else if (cell.dataType === 'boolean') boolCount++;
      else if (cell.dataType === 'number') numCount++;
      else textCount++;
    }

    let detectedType: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'barcode' = 'text';
    if (formulaCount > dateCount && formulaCount > numCount) detectedType = 'formula';
    else if (dateCount > numCount && dateCount > textCount) detectedType = 'date';
    else if (numCount > textCount && numCount > dateCount) detectedType = 'number';
    else if (boolCount > textCount && boolCount > numCount) detectedType = 'boolean';

    // Barcode detection heuristic: all numeric text with 8, 12, 13, 14 digits or typical SKU
    if (detectedType === 'text' && sampleVal && /^\d{8,14}$/.test(sampleVal)) {
      detectedType = 'barcode';
    }

    return {
      name: col.name,
      displayName: col.originalName,
      dataType: detectedType,
      originalName: col.originalName,
      sampleValue: sampleVal,
    };
  });

  return { columns, fieldInfos, allRows, normalizedCells };
}

function applyFiltersAndSorts(
  rows: Record<string, string>[],
  normalized: Record<string, CellExtractionResult>[],
  sort?: { field: string; direction: 'asc' | 'desc' }[],
  filters?: { field: string; operator: string; value?: any; logic?: 'AND' | 'OR' }[],
  search?: { query: string; fields?: string[]; mode?: 'contains' | 'startsWith' | 'exact' }
): { rows: Record<string, string>[]; normalized: Record<string, CellExtractionResult>[] } {
  let paired = rows.map((r, i) => ({ row: r, norm: normalized[i] }));

  // 1. Search
  if (search && search.query && search.query.trim()) {
    const q = search.query.trim().toLowerCase();
    const mode = search.mode || 'contains';
    const fieldsToSearch = search.fields && search.fields.length > 0 ? search.fields : null;

    paired = paired.filter(({ row }) => {
      const targetFields = fieldsToSearch || Object.keys(row);
      return targetFields.some((f) => {
        const val = String(row[f] ?? '').toLowerCase();
        if (mode === 'exact') return val === q;
        if (mode === 'startsWith') return val.startsWith(q);
        return val.includes(q);
      });
    });
  }

  // 2. Filters
  if (filters && filters.length > 0) {
    paired = paired.filter(({ row }) => {
      let isMatch = true;
      for (let i = 0; i < filters.length; i++) {
        const cond = filters[i];
        const rawVal = String(row[cond.field] ?? '').toLowerCase();
        const targetVal = String(cond.value ?? '').toLowerCase();
        let pass = false;

        switch (cond.operator) {
          case 'equals':
            pass = rawVal === targetVal;
            break;
          case 'notEquals':
            pass = rawVal !== targetVal;
            break;
          case 'contains':
            pass = rawVal.includes(targetVal);
            break;
          case 'notContains':
            pass = !rawVal.includes(targetVal);
            break;
          case 'startsWith':
            pass = rawVal.startsWith(targetVal);
            break;
          case 'endsWith':
            pass = rawVal.endsWith(targetVal);
            break;
          case 'greaterThan':
            pass = parseFloat(rawVal) > parseFloat(targetVal);
            break;
          case 'greaterThanOrEqual':
            pass = parseFloat(rawVal) >= parseFloat(targetVal);
            break;
          case 'lessThan':
            pass = parseFloat(rawVal) < parseFloat(targetVal);
            break;
          case 'lessThanOrEqual':
            pass = parseFloat(rawVal) <= parseFloat(targetVal);
            break;
          case 'isEmpty':
            pass = rawVal.trim() === '';
            break;
          case 'isNotEmpty':
            pass = rawVal.trim() !== '';
            break;
          default:
            pass = rawVal.includes(targetVal);
        }

        if (i === 0) {
          isMatch = pass;
        } else {
          const logic = cond.logic || 'AND';
          isMatch = logic === 'AND' ? isMatch && pass : isMatch || pass;
        }
      }
      return isMatch;
    });
  }

  // 3. Multi-column Sort
  if (sort && sort.length > 0) {
    paired.sort((a, b) => {
      for (const s of sort) {
        const valA = String(a.row[s.field] ?? '');
        const valB = String(b.row[s.field] ?? '');
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);

        let cmp = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (cmp !== 0) {
          return s.direction === 'desc' ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  return {
    rows: paired.map((p) => p.row),
    normalized: paired.map((p) => p.norm),
  };
}

async function selectExcelFileInternal() {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Microsoft Excel Spreadsheet',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.xlsm)', extensions: ['xlsx', 'xls', 'xlsm'] },
      { name: 'All Files (*.*)', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const resolvedPath = path.normalize(path.resolve(result.filePaths[0]));
  try {
    const stats = fs.statSync(resolvedPath);
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      sizeBytes: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  } catch {
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      sizeBytes: 0,
      lastModified: new Date().toISOString(),
    };
  }
}

async function inspectWorkbookInternal(filePath: string, projectDir?: string) {
  try {
    const { resolvedPath, exists } = resolveFilePath(filePath, projectDir);
    if (!exists) {
      return {
        success: false,
        errorCode: 'EXCEL_FILE_NOT_FOUND',
        error: `File not found on disk: "${filePath}".`,
        pathChecked: resolvedPath,
      };
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    if (!['.xlsx', '.xls', '.xlsm'].includes(ext)) {
      return {
        success: false,
        errorCode: 'EXCEL_UNSUPPORTED_FORMAT',
        error: `Unsupported file extension "${ext}". BarcodeFlow supports .xlsx, .xls, and .xlsm workbooks.`,
        pathChecked: resolvedPath,
      };
    }

    const stat = await fs.promises.stat(resolvedPath);
    let buffer: Buffer;
    try {
      buffer = await safelyReadFileWithRetry(resolvedPath, 3);
    } catch (err: any) {
      if (err.code === 'EBUSY' || err.code === 'EACCES') {
        return {
          success: false,
          errorCode: 'EXCEL_FILE_BUSY',
          error: 'Excel file is currently locked by another application. Please save and close Excel or allow shared reading.',
          pathChecked: resolvedPath,
        };
      }
      return {
        success: false,
        errorCode: 'EXCEL_ACCESS_DENIED',
        error: `File access error: ${err.message}`,
        pathChecked: resolvedPath,
      };
    }

    const wb = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellText: true,
      cellFormula: true,
    });

    const sheetNames = wb.SheetNames || [];
    if (sheetNames.length === 0) {
      return {
        success: false,
        errorCode: 'EXCEL_INVALID_WORKBOOK',
        error: 'Workbook contains no readable sheets.',
        pathChecked: resolvedPath,
      };
    }

    const workbookSheetsMeta = (wb.Workbook && wb.Workbook.Sheets) || [];
    const sheets = sheetNames.map((name, idx) => {
      const meta = workbookSheetsMeta[idx] || {};
      const isHidden = meta.Hidden === 1;
      const isVeryHidden = meta.Hidden === 2;
      const ws = wb.Sheets[name];
      let rowCount = 0;
      let colCount = 0;
      if (ws && ws['!ref']) {
        const r = XLSX.utils.decode_range(ws['!ref']);
        rowCount = Math.max(0, r.e.r - r.s.r);
        colCount = Math.max(0, r.e.c - r.s.c + 1);
      }
      return {
        name,
        displayName: name,
        type: 'sheet' as const,
        rowCount,
        columnCount: colCount,
        isHidden,
        isVeryHidden,
      };
    });

    return {
      success: true,
      metadata: {
        fileName: path.basename(resolvedPath),
        fullPath: resolvedPath,
        fileSize: stat.size,
        lastModified: stat.mtime.toISOString(),
        sheetNames,
        sheets,
        selectedSheet: sheetNames[0],
        estimatedRowCount: sheets[0]?.rowCount || 0,
        columnCount: sheets[0]?.columnCount || 0,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'EXCEL_PARSE_FAILED',
      error: err.message || 'Failed to inspect workbook.',
      pathChecked: filePath,
    };
  }
}

function findWorksheet(wb: XLSX.WorkBook, requestedName?: string): { name: string; sheet: XLSX.WorkSheet } | null {
  if (!wb.SheetNames || wb.SheetNames.length === 0) return null;
  if (!requestedName || !requestedName.trim()) {
    const first = wb.SheetNames[0];
    return { name: first, sheet: wb.Sheets[first] };
  }

  // 1. Exact match
  if (wb.Sheets[requestedName]) {
    return { name: requestedName, sheet: wb.Sheets[requestedName] };
  }

  // 2. Normalized match (strip surrounding quotes and trailing $)
  const clean = requestedName.replace(/^['"]|['"]$/g, '').replace(/\$$/, '').trim().toLowerCase();
  for (const name of wb.SheetNames) {
    const candidateClean = name.replace(/^['"]|['"]$/g, '').replace(/\$$/, '').trim().toLowerCase();
    if (candidateClean === clean) {
      return { name, sheet: wb.Sheets[name] };
    }
  }

  // 3. Fallback to first sheet
  const first = wb.SheetNames[0];
  return { name: first, sheet: wb.Sheets[first] };
}

async function getPreviewInternal(params: {
  filePath: string;
  sheetName: string;
  headerRow?: number;
  hasHeaders?: boolean;
  page?: number;
  pageSize?: number;
  projectDir?: string;
  sort?: any[];
  filters?: any[];
  search?: any;
}) {
  try {
    const { filePath, sheetName, headerRow = 1, hasHeaders = true, page = 1, pageSize = 200, projectDir, sort, filters, search } = params;
    const { resolvedPath, exists } = resolveFilePath(filePath, projectDir);
    if (!exists) {
      return { success: false, errorCode: 'EXCEL_FILE_NOT_FOUND', error: `File not found: ${filePath}` };
    }

    const buffer = await safelyReadFileWithRetry(resolvedPath, 3);
    const wb = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellText: true,
      cellFormula: true,
    });

    const found = findWorksheet(wb, sheetName);
    if (!found || !found.sheet) {
      return { success: false, errorCode: 'EXCEL_SHEET_NOT_FOUND', error: `Sheet "${sheetName}" not found in workbook.` };
    }

    const sheet = found.sheet;
    const parsed = parseWorksheetData(sheet, headerRow, hasHeaders);
    const filtered = applyFiltersAndSorts(parsed.allRows, parsed.normalizedCells, sort, filters, search);

    const totalRows = filtered.rows.length;
    const totalPages = Math.ceil(totalRows / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const offset = (currentPage - 1) * pageSize;

    const pagedRows = filtered.rows.slice(offset, offset + pageSize);
    const pagedNormalized = filtered.normalized.slice(offset, offset + pageSize);

    return {
      success: true,
      page: currentPage,
      pageSize,
      totalRows,
      totalPages,
      columns: parsed.columns.map((c) => c.name),
      fields: parsed.fieldInfos,
      rows: pagedRows,
      normalizedCells: pagedNormalized,
    };
  } catch (err: any) {
    return { success: false, errorCode: 'EXCEL_PARSE_FAILED', error: err.message };
  }
}

async function watchExcelInternal(filePath: string, connectionId: string, projectDir?: string) {
  try {
    if (activeFileWatchers.has(connectionId)) {
      activeFileWatchers.get(connectionId)?.close();
      activeFileWatchers.delete(connectionId);
    }

    const { resolvedPath, exists } = resolveFilePath(filePath, projectDir);
    if (!exists) return false;

    const watcher = fs.watch(resolvedPath, (eventType) => {
      if (eventType === 'change' || eventType === 'rename') {
        if (fileChangeDebounceTimer) clearTimeout(fileChangeDebounceTimer);
        fileChangeDebounceTimer = setTimeout(async () => {
          let ready = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const fd = fs.openSync(resolvedPath, 'r');
              fs.closeSync(fd);
              ready = true;
              break;
            } catch {
              await new Promise((r) => setTimeout(r, 250));
            }
          }

          if (ready) {
            console.log(`[Electron Watcher] Stabilized file change: ${resolvedPath} (${connectionId})`);
            mainWindow?.webContents.send('barcodeFlow:excel:file-changed', {
              filePath: resolvedPath,
              connectionId,
            });
            mainWindow?.webContents.send('excel:file-changed', {
              filePath: resolvedPath,
              datasetId: connectionId,
            });
          }
        }, 1000);
      }
    });

    activeFileWatchers.set(connectionId, watcher);
    return true;
  } catch (err) {
    console.warn(`[Electron Watcher] Failed to watch ${filePath}:`, err);
    return false;
  }
}

async function unwatchExcelInternal(connectionId: string) {
  if (activeFileWatchers.has(connectionId)) {
    activeFileWatchers.get(connectionId)?.close();
    activeFileWatchers.delete(connectionId);
    return true;
  }
  return false;
}

function registerExcelIpc() {
  // 1. Native File Dialog for Excel
  ipcMain.handle('barcodeFlow:excel:select-file', async () => {
    return selectExcelFileInternal();
  });

  ipcMain.handle('excel:select-file', async () => {
    return selectExcelFileInternal();
  });

  // 2. Locate Missing File
  ipcMain.handle('barcodeFlow:excel:locate-file', async (_event, oldPath?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultDir = oldPath ? path.dirname(oldPath) : undefined;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Locate Missing Excel File',
      defaultPath: defaultDir && fs.existsSync(defaultDir) ? defaultDir : undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.xlsm)', extensions: ['xlsx', 'xls', 'xlsm'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const resolvedPath = path.normalize(path.resolve(result.filePaths[0]));
    const stats = fs.statSync(resolvedPath);
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      sizeBytes: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  });

  ipcMain.handle('excel:locate-file', async (_event, oldPath?: string) => {
    return (await dialog.showOpenDialog(mainWindow!, {
      title: 'Locate Missing Excel File',
      defaultPath: oldPath && fs.existsSync(path.dirname(oldPath)) ? path.dirname(oldPath) : undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.xlsm)', extensions: ['xlsx', 'xls', 'xlsm'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    })).canceled ? { canceled: true } : { canceled: false };
  });

  // 3. Inspect Workbook Metadata
  ipcMain.handle('barcodeFlow:excel:inspect-workbook', async (_event, { filePath, projectDir }: { filePath: string; projectDir?: string }) => {
    return inspectWorkbookInternal(filePath, projectDir);
  });

  // 4. Get Sheets
  ipcMain.handle('barcodeFlow:excel:get-sheets', async (_event, payload: { filePath: string; projectDir?: string }) => {
    const res = await inspectWorkbookInternal(payload.filePath, payload.projectDir);
    if (!res.success) return res;
    return {
      success: true,
      sheets: res.metadata.sheets,
      sheetNames: res.metadata.sheetNames,
    };
  });

  // 5. Get Fields
  ipcMain.handle(
    'barcodeFlow:excel:get-fields',
    async (
      _event,
      {
        filePath,
        sheetName,
        headerRow = 1,
        hasHeaders = true,
        projectDir,
      }: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        projectDir?: string;
      }
    ) => {
      try {
        const { resolvedPath, exists } = resolveFilePath(filePath, projectDir);
        if (!exists) {
          return { success: false, errorCode: 'EXCEL_FILE_NOT_FOUND', error: `File not found: ${filePath}` };
        }

        const buffer = await safelyReadFileWithRetry(resolvedPath, 3);
        const wb = XLSX.read(buffer, {
          type: 'buffer',
          cellDates: true,
          cellNF: true,
          cellText: true,
          cellFormula: true,
        });

        const found = findWorksheet(wb, sheetName);
        if (!found || !found.sheet) {
          return { success: false, errorCode: 'EXCEL_SHEET_NOT_FOUND', error: `Sheet "${sheetName}" not found in workbook.` };
        }

        const sheet = found.sheet;

        const parsed = parseWorksheetData(sheet, headerRow, hasHeaders);
        return {
          success: true,
          fields: parsed.fieldInfos,
          columns: parsed.columns.map((c) => c.name),
        };
      } catch (err: any) {
        return { success: false, errorCode: 'EXCEL_PARSE_FAILED', error: err.message };
      }
    }
  );

  // 6. Get Preview / Records (Paginated)
  ipcMain.handle(
    'barcodeFlow:excel:get-preview',
    async (
      _event,
      payload: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        page?: number;
        pageSize?: number;
        projectDir?: string;
        sort?: any[];
        filters?: any[];
        search?: any;
      }
    ) => {
      return getPreviewInternal(payload);
    }
  );

  ipcMain.handle('barcodeFlow:excel:get-records', async (_event, payload) => {
    return getPreviewInternal({
      filePath: payload.filePath,
      sheetName: payload.sheetName,
      headerRow: payload.headerRow,
      hasHeaders: payload.hasHeaders,
      page: payload.query?.page || 1,
      pageSize: payload.query?.pageSize || 200,
      projectDir: payload.projectDir,
      sort: payload.query?.sort,
      filters: payload.query?.filters,
      search: payload.query?.search,
    });
  });

  // 7. Stabilized Debounced File Watcher
  ipcMain.handle(
    'barcodeFlow:excel:watch',
    async (_event, { filePath, connectionId, projectDir }: { filePath: string; connectionId: string; projectDir?: string }) => {
      return watchExcelInternal(filePath, connectionId, projectDir);
    }
  );

  ipcMain.handle('barcodeFlow:excel:unwatch', async (_event, connectionId: string) => {
    return unwatchExcelInternal(connectionId);
  });

  // Backward compatibility handlers for existing frontend calls
  ipcMain.handle('excel:test-connection', async (_event, { filePath, sheetName }: { filePath: string; sheetName?: string }) => {
    const res = await inspectWorkbookInternal(filePath);
    if (!res.success) return res;
    const meta = res.metadata;
    return {
      success: true,
      filePath: meta.fullPath,
      fileName: meta.fileName,
      sheets: meta.sheetNames,
      sheetCount: meta.sheetNames.length,
      selectedSheet: sheetName || meta.selectedSheet,
      totalRecords: meta.estimatedRowCount,
      lastModified: meta.lastModified,
      sizeBytes: meta.fileSize,
      pathChecked: meta.fullPath,
    };
  });

  ipcMain.handle(
    'excel:read-workbook',
    async (_event, { filePath, sheetName, headerRow = 1 }: { filePath: string; sheetName?: string; headerRow?: number }) => {
      const res = await getPreviewInternal({
        filePath,
        sheetName: sheetName || '',
        headerRow,
        page: 1,
        pageSize: 100000,
      });
      if (!res.success) return res;
      return {
        success: true,
        sheetNames: [sheetName || 'Sheet1'],
        selectedSheet: sheetName,
        columns: res.columns,
        records: res.rows,
        previewRows: res.rows.slice(0, 20),
        totalRecords: res.totalRows,
      };
    }
  );

  ipcMain.handle('excel:open-location', async (_event, filePath: string) => {
    try {
      if (!filePath) return false;
      const resolved = path.normalize(path.resolve(filePath));
      if (fs.existsSync(resolved)) {
        shell.showItemInFolder(resolved);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  ipcMain.handle('excel:open-file', async (_event, filePath: string) => {
    try {
      if (!filePath) return false;
      const resolved = path.normalize(path.resolve(filePath));
      if (fs.existsSync(resolved)) {
        await shell.openPath(resolved);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  ipcMain.handle('excel:watch-file', async (_event, { filePath, datasetId }: { filePath: string; datasetId: string }) => {
    return watchExcelInternal(filePath, datasetId);
  });

  ipcMain.handle('excel:unwatch-file', async (_event, datasetId: string) => {
    return unwatchExcelInternal(datasetId);
  });
}


function registerDocumentIpc() {
  // 1. Show Native Windows Save As Dialog
  ipcMain.handle('document:show-save-dialog', async (_event, defaultFileName?: string, defaultDir?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultName = (defaultFileName || 'Document1').replace(/[\/\\:*?"<>|]/g, '_');
    const safeName = defaultName.endsWith('.bfl') || defaultName.endsWith('.btw') ? defaultName : `${defaultName}.bfl`;
    const defaultPath = defaultDir && fs.existsSync(defaultDir)
      ? path.join(defaultDir, safeName)
      : path.join(app.getPath('documents'), safeName);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save As - BarcodeFlow Document',
      defaultPath,
      filters: [
        { name: 'BarcodeFlow Document (*.bfl)', extensions: ['bfl'] },
        { name: 'BarTender Document (*.btw)', extensions: ['btw'] },
        { name: 'JSON Document (*.json)', extensions: ['json'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const resolvedPath = path.normalize(path.resolve(result.filePath));
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
    };
  });

  // 2. Safe Atomic File Save
  ipcMain.handle('document:save-file', async (_event, { filePath, documentData }: { filePath: string; documentData: any }) => {
    if (!filePath) {
      return { success: false, error: 'File path cannot be empty' };
    }
    const resolvedPath = path.normalize(path.resolve(filePath));
    const targetDir = path.dirname(resolvedPath);
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch (err: any) {
        return { success: false, error: `Failed to create directory: ${err.message}` };
      }
    }

    const tempPath = `${resolvedPath}.tmp-${Date.now()}`;
    const payload = typeof documentData === 'string' ? documentData : JSON.stringify(documentData, null, 2);

    try {
      await fs.promises.writeFile(tempPath, payload, 'utf-8');
      await fs.promises.rename(tempPath, resolvedPath);
      const stats = await fs.promises.stat(resolvedPath);
      return {
        success: true,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    } catch (err: any) {
      try {
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
      } catch { }
      return { success: false, error: err.message || 'Disk write failed' };
    }
  });

  // 3. Show Native Windows Open Dialog
  ipcMain.handle('document:show-open-dialog', async (_event, defaultDir?: string) => {
    if (!mainWindow) return { canceled: true };
    const defaultPath = defaultDir && fs.existsSync(defaultDir) ? defaultDir : app.getPath('documents');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Document - BarcodeFlow',
      defaultPath,
      properties: ['openFile'],
      filters: [
        { name: 'BarcodeFlow & BarTender Documents (*.bfl, *.btw, *.json)', extensions: ['bfl', 'btw', 'json'] },
        { name: 'BarcodeFlow Document (*.bfl)', extensions: ['bfl'] },
        { name: 'BarTender Document (*.btw)', extensions: ['btw'] },
        { name: 'JSON Document (*.json)', extensions: ['json'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const resolvedPath = path.normalize(path.resolve(result.filePaths[0]));
    return {
      canceled: false,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
    };
  });

  // 4. Read Document File
  ipcMain.handle('document:read-file', async (_event, filePath: string) => {
    if (!filePath) {
      return { success: false, error: 'File path cannot be empty' };
    }
    const resolvedPath = path.normalize(path.resolve(filePath));
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `File not found: ${resolvedPath}` };
    }

    try {
      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(content);
      const stats = await fs.promises.stat(resolvedPath);
      return {
        success: true,
        document: parsed,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    } catch (err: any) {
      return { success: false, error: `Failed to read document: ${err.message}` };
    }
  });

  // 5. Check if File Exists
  ipcMain.handle('document:check-file-exists', async (_event, filePath: string) => {
    if (!filePath) return false;
    try {
      return fs.existsSync(path.normalize(path.resolve(filePath)));
    } catch {
      return false;
    }
  });

  // 6. Open Document Folder in Windows Explorer
  ipcMain.handle('document:open-location', async (_event, filePath: string) => {
    if (!filePath) return false;
    try {
      const resolvedPath = path.normalize(path.resolve(filePath));
      if (fs.existsSync(resolvedPath)) {
        shell.showItemInFolder(resolvedPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // 6. Native App Exit
  ipcMain.handle('app:exit', async () => {
    app.quit();
    return true;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'BarcodeFlow Enterprise Suite',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  const distIndex = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadURL('http://localhost:5180').catch(() => {
      mainWindow?.loadURL(`http://localhost:${PORT}`);
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

let cachedSystemFonts: string[] | null = null;

function registerFontIpc() {
  ipcMain.handle('fonts:list', async () => {
    if (cachedSystemFonts && cachedSystemFonts.length > 0) {
      return cachedSystemFonts;
    }

    const standardFallbackFonts = [
      'Arial',
      'Arial Black',
      'Arial Narrow',
      'Arial Rounded MT Bold',
      'Bahnschrift',
      'Bahnschrift Condensed',
      'Calibri',
      'Calibri Light',
      'Cambria',
      'Candara',
      'Century Gothic',
      'Comic Sans MS',
      'Consolas',
      'Constantia',
      'Corbel',
      'Courier New',
      'Ebrima',
      'Franklin Gothic Medium',
      'Gabriola',
      'Gadugi',
      'Georgia',
      'Impact',
      'Ink Free',
      'Javanese Text',
      'Leelawadee UI',
      'Lucida Console',
      'Lucida Sans Unicode',
      'Malgun Gothic',
      'Marlett',
      'Microsoft Himalaya',
      'Microsoft JhengHei',
      'Microsoft New Tai Lue',
      'Microsoft PhagsPa',
      'Microsoft Sans Serif',
      'Microsoft Tai Le',
      'Microsoft YaHei',
      'Microsoft Yi Baiti',
      'MingLiU-ExtB',
      'Mongolian Baiti',
      'MS Gothic',
      'MS PGothic',
      'MS UI Gothic',
      'MV Boli',
      'Myanmar Text',
      'Nirmala UI',
      'OCR A Extended',
      'OCR-B 10 BT',
      'Palatino Linotype',
      'Segoe Print',
      'Segoe Script',
      'Segoe UI',
      'Segoe UI Historic',
      'Segoe UI Symbol',
      'SimSun',
      'Sitka Small',
      'Sitka Text',
      'Sitka Heading',
      'Sitka Display',
      'Sylfaen',
      'Symbol',
      'Tahoma',
      'Times New Roman',
      'Trebuchet MS',
      'Verdana',
      'Webdings',
      'Wingdings',
      'Yu Gothic'
    ];

    if (process.platform === 'win32') {
      try {
        const { exec } = await import('child_process');
        const fontList: string[] = await new Promise((resolve) => {
          const cmd = `powershell -NoProfile -NonInteractive -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null; [System.Drawing.FontFamily]::Families | Select-Object -ExpandProperty Name"`;
          exec(cmd, { timeout: 3500 }, (error, stdout) => {
            if (error || !stdout) {
              resolve(standardFallbackFonts);
              return;
            }
            const lines = stdout
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter((l) => l.length > 0 && !l.startsWith('Exception'));
            if (lines.length > 5) {
              const unique = Array.from(new Set([...lines, ...standardFallbackFonts])).sort((a, b) =>
                a.localeCompare(b)
              );
              resolve(unique);
            } else {
              resolve(standardFallbackFonts);
            }
          });
        });

        cachedSystemFonts = fontList;
        return fontList;
      } catch {
        cachedSystemFonts = standardFallbackFonts;
        return standardFallbackFonts;
      }
    }

    cachedSystemFonts = standardFallbackFonts;
    return standardFallbackFonts;
  });
}

app.whenReady().then(() => {
  registerDocumentIpc();
  registerExcelIpc();
  registerFontIpc();
  registerPrinterIpc(() => mainWindow);
  registerDatabaseIpc(() => mainWindow);
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

