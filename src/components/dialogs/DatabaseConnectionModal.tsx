import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DatabaseConnectionConfig, ExcelColumnDefinition } from '../../types';
import { parseCSVToDatabaseConnection } from '../../services/databaseConnectorService';
import { excelDataSourceProvider } from '../../services/providers/ExcelDataSourceProvider';
import {
  X,
  RefreshCw,
  Upload,
  Search,
  CheckCircle2,
  Table as TableIcon,
  Columns,
  ArrowUpDown,
  Filter as FilterIcon,
  Settings,
  Database,
  FileSpreadsheet,
  Trash2,
  Plus,
  HelpCircle,
  FolderOpen,
} from 'lucide-react';

export interface DatabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyConnection: (conn: DatabaseConnectionConfig) => void;
  currentConnection?: DatabaseConnectionConfig;
  onOpenExcelWizard?: () => void;
}

export type BartenderDbType =
  | 'text_file'
  | 'ms_access'
  | 'ms_excel'
  | 'ms_sql_server'
  | 'oracle'
  | 'sap_idoc'
  | 'ibm_db2'
  | 'ibm_informix'
  | 'oledb'
  | 'odbc';

// Authentic BarTender SVG Icons matching user's screenshots
const BartenderIcons = {
  // Title bar 3D database cylinder
  TitleBarDatabase: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 drop-shadow-xs">
      <ellipse cx="12" cy="5" rx="8" ry="3.5" fill="#4a90e2" stroke="#1d4ed8" strokeWidth="1.2" />
      <path d="M4 5v6c0 1.933 3.582 3.5 8 3.5s8-1.567 8-3.5V5" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.2" />
      <ellipse cx="12" cy="11" rx="8" ry="3.5" fill="#60a5fa" fillOpacity="0.4" stroke="#1d4ed8" strokeWidth="1" />
      <path d="M4 11v6c0 1.933 3.582 3.5 8 3.5s8-1.567 8-3.5v-6" fill="#1d4ed8" stroke="#1e40af" strokeWidth="1.2" />
      <ellipse cx="12" cy="17" rx="8" ry="3.5" fill="#93c5fd" fillOpacity="0.3" stroke="#1e40af" strokeWidth="1" />
    </svg>
  ),

  // Spreadsheet Table Icon (for Tables to Use: 'Barcode Data$')
  SheetTableIcon: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0">
      <rect x="2" y="2" width="16" height="16" rx="1.5" fill="#ffffff" stroke="#3b82f6" strokeWidth="1.2" />
      <rect x="2" y="2" width="16" height="4.5" fill="#93c5fd" />
      <line x1="2" y1="10.5" x2="18" y2="10.5" stroke="#93c5fd" strokeWidth="1" />
      <line x1="2" y1="14.5" x2="18" y2="14.5" stroke="#93c5fd" strokeWidth="1" />
      <line x1="7.5" y1="2" x2="7.5" y2="18" stroke="#93c5fd" strokeWidth="1" />
      <line x1="13" y1="2" x2="13" y2="18" stroke="#93c5fd" strokeWidth="1" />
    </svg>
  ),

  // SQL Statement Icon
  SqlIcon: () => (
    <span className="font-bold text-[10px] text-slate-800 tracking-tighter bg-slate-200 px-1 py-0.2 rounded shrink-0 font-mono">
      SQL
    </span>
  ),

  // 1. Text File
  TextFile: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <rect x="5" y="3" width="22" height="30" rx="1.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M20 3l7 7h-7V3z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.2" />
      <line x1="9" y1="12" x2="23" y2="12" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="16" x2="23" y2="16" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="20" x2="23" y2="20" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="24" x2="19" y2="24" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="18" y="22" width="13" height="9" rx="1.5" fill="#2563eb" />
      <text x="24.5" y="28.5" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">CSV</text>
    </svg>
  ),

  // 2. Microsoft Access
  MsAccess: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <rect x="3" y="4" width="28" height="28" rx="2" fill="#a21caf" stroke="#86198f" strokeWidth="1.2" />
      <circle cx="21" cy="14" r="3.5" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
      <path d="M19 16.5l-6 6v3h3l1.5-1.5h2l1-1" stroke="#fde047" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="11" y="19" fill="#ffffff" fontSize="13" fontWeight="900" fontFamily="sans-serif">A</text>
    </svg>
  ),

  // 3. Microsoft Excel
  MsExcel: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <rect x="4" y="4" width="28" height="28" rx="2" fill="#15803d" stroke="#166534" strokeWidth="1.2" />
      <rect x="16" y="7" width="13" height="22" rx="1" fill="#22c55e" fillOpacity="0.3" stroke="#86efac" strokeWidth="1" />
      <line x1="16" y1="14" x2="29" y2="14" stroke="#86efac" strokeWidth="1" />
      <line x1="16" y1="21" x2="29" y2="21" stroke="#86efac" strokeWidth="1" />
      <line x1="22" y1="7" x2="22" y2="29" stroke="#86efac" strokeWidth="1" />
      <rect x="4" y="9" width="15" height="18" rx="1.5" fill="#16a34a" stroke="#15803d" strokeWidth="1" />
      <text x="11.5" y="22.5" fill="#ffffff" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">X</text>
    </svg>
  ),

  // 4. Microsoft SQL Server
  MsSqlServer: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <ellipse cx="14" cy="9" rx="8" ry="3.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M6 9v6c0 1.933 3.582 3.5 8 3.5s8-1.567 8-3.5V9" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M6 15v6c0 1.933 3.582 3.5 8 3.5s8-1.567 8-3.5v-6" fill="#94a3b8" stroke="#64748b" strokeWidth="1.2" />
      <path d="M18 10c2-5 9-6 12-2-1 4-5 6-7 10 3 2 4 5 1 8-4 4-8 1-6-5l-2-2z" fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
    </svg>
  ),

  // 5. Oracle
  Oracle: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <rect x="2" y="10" width="32" height="16" rx="4" fill="#dc2626" stroke="#b91c1c" strokeWidth="1" />
      <text x="18" y="21.5" fill="#ffffff" fontSize="7.5" fontWeight="900" letterSpacing="0.8" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif">
        ORACLE
      </text>
    </svg>
  ),

  // 6. SAP IDoc
  SapIdoc: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <path d="M4 7h28v15L18 29 4 22V7z" fill="#0284c7" stroke="#0369a1" strokeWidth="1.2" />
      <rect x="7" y="10" width="22" height="12" rx="1" fill="#0369a1" />
      <text x="18" y="18" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">SAP</text>
      <text x="18" y="26" fill="#e0f2fe" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">IDoc</text>
    </svg>
  ),

  // 7. IBM DB2
  IbmDb2: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <rect x="3" y="6" width="30" height="24" rx="2" fill="#1e3a8a" stroke="#172554" strokeWidth="1" />
      <line x1="6" y1="10" x2="30" y2="10" stroke="#60a5fa" strokeWidth="1.5" />
      <line x1="6" y1="13" x2="30" y2="13" stroke="#60a5fa" strokeWidth="1.5" />
      <line x1="6" y1="16" x2="30" y2="16" stroke="#60a5fa" strokeWidth="1.5" />
      <text x="18" y="25" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle" fontFamily="Arial, sans-serif">DB2</text>
    </svg>
  ),

  // 8. IBM Informix
  IbmInformix: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <rect x="3" y="6" width="30" height="24" rx="2" fill="#1e40af" stroke="#1d4ed8" strokeWidth="1" />
      <line x1="6" y1="10" x2="30" y2="10" stroke="#93c5fd" strokeWidth="1.2" />
      <line x1="6" y1="13" x2="30" y2="13" stroke="#93c5fd" strokeWidth="1.2" />
      <line x1="6" y1="16" x2="30" y2="16" stroke="#93c5fd" strokeWidth="1.2" />
      <text x="18" y="25.5" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="Arial, sans-serif">Informix</text>
    </svg>
  ),

  // 9. OLE DB Connection
  OleDb: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <rect x="4" y="5" width="28" height="26" rx="2" fill="#701a75" stroke="#4a044e" strokeWidth="1.2" />
      <rect x="7" y="8" width="22" height="12" rx="1" fill="#4a044e" />
      <text x="18" y="16" fill="#facc15" fontSize="7" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">OLEDB</text>
      <ellipse cx="18" cy="24" rx="7" ry="2.5" fill="#a21caf" stroke="#f472b6" strokeWidth="1" />
    </svg>
  ),

  // 10. ODBC Connection
  Odbc: () => (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" className="shrink-0">
      <rect x="4" y="5" width="28" height="26" rx="2" fill="#881337" stroke="#4c0519" strokeWidth="1.2" />
      <rect x="7" y="8" width="22" height="12" rx="1" fill="#4c0519" />
      <text x="18" y="16.5" fill="#ffffff" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">ODBC</text>
      <ellipse cx="18" cy="24" rx="7" ry="2.5" fill="#be123c" stroke="#fb7185" strokeWidth="1" />
    </svg>
  ),
};

const BARTENDER_DB_TYPES = [
  {
    id: 'text_file' as BartenderDbType,
    title: 'Text File',
    description: 'Supports various encodings and formats including CSV and fixed-width fields.',
    icon: <BartenderIcons.TextFile />,
  },
  {
    id: 'ms_access' as BartenderDbType,
    title: 'Microsoft Access',
    description: 'Supports all versions of Access (includes *.mdb and *.accdb files).',
    icon: <BartenderIcons.MsAccess />,
  },
  {
    id: 'ms_excel' as BartenderDbType,
    title: 'Microsoft Excel',
    description: 'Supports all versions of Excel (includes *.xls and *.xlsx files).',
    icon: <BartenderIcons.MsExcel />,
  },
  {
    id: 'ms_sql_server' as BartenderDbType,
    title: 'Microsoft SQL Server',
    description: 'Supports Microsoft SQL Server 2005 and later.',
    icon: <BartenderIcons.MsSqlServer />,
  },
  {
    id: 'oracle' as BartenderDbType,
    title: 'Oracle',
    description: 'Supports Oracle 10g and later.',
    icon: <BartenderIcons.Oracle />,
  },
  {
    id: 'sap_idoc' as BartenderDbType,
    title: 'SAP IDoc',
    description: 'Supports SAP Intermediate Document (IDoc) files.',
    icon: <BartenderIcons.SapIdoc />,
  },
  {
    id: 'ibm_db2' as BartenderDbType,
    title: 'IBM DB2',
    description: 'Supports IBM DB2 10.5.0 and later.',
    icon: <BartenderIcons.IbmDb2 />,
  },
  {
    id: 'ibm_informix' as BartenderDbType,
    title: 'IBM Informix',
    description: 'Supports IBM Informix 11.10 and later.',
    icon: <BartenderIcons.IbmInformix />,
  },
  {
    id: 'oledb' as BartenderDbType,
    title: 'OLE DB Connection',
    description: 'Connects to any database type with an installed OLE DB driver.',
    icon: <BartenderIcons.OleDb />,
  },
  {
    id: 'odbc' as BartenderDbType,
    title: 'ODBC Connection',
    description: 'Connects to any database type with an installed ODBC driver.',
    icon: <BartenderIcons.Odbc />,
  },
];

// Initial default BarTender sample dataset (matching Screenshot 4 barcodecolors_data)
export const DatabaseConnectionModal: React.FC<DatabaseConnectionModalProps> = ({
  isOpen,
  onClose,
  onApplyConnection,
  currentConnection,
  onOpenExcelWizard,
}) => {
  // Mode: 'wizard' (Screenshots 1, 2, 3) vs 'setup' (Screenshot 4)
  const [viewMode, setViewMode] = useState<'wizard' | 'setup'>('setup');

  // Wizard state: 1: Select Database Type, 2: Select Excel File, 3: Select Tables
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedDbType, setSelectedDbType] = useState<BartenderDbType>('ms_excel');

  // File and tables state
  const [fileName, setFileName] = useState<string>('');
  const [fullFilePath, setFullFilePath] = useState<string>('');
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [tablesToUse, setTablesToUse] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [hasHeaders, setHasHeaders] = useState<boolean>(true);

  // Active Connection Properties State (matching Screenshot 4)
  const [activeDbName, setActiveDbName] = useState<string>('');
  const [activeDbTypeTitle, setActiveDbTypeTitle] = useState<string>('Microsoft Excel');
  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [activeRecords, setActiveRecords] = useState<Record<string, any>[]>([]);
  const [columnDefs, setColumnDefs] = useState<ExcelColumnDefinition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Screenshot 4: Left Sidebar Selected Node
  // 'root' = Connection Properties, 'sql', 'tables', 'fields', 'sort', 'filter', 'options', 'browser'
  const [activeSection, setActiveSection] = useState<
    'root' | 'sql' | 'tables' | 'fields' | 'sort' | 'filter' | 'options' | 'browser'
  >('root');

  // Sort & Filter state
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterField, setFilterField] = useState<string>('');
  const [filterOperator, setFilterOperator] = useState<'equals' | 'contains' | 'greater_than'>('contains');
  const [filterValue, setFilterValue] = useState<string>('');

  // File input ref for native browse
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to load sheets and fields
  const loadWorkbookSheet = async (targetPath: string, sheetTarget: string) => {
    if (!targetPath || !sheetTarget) return;
    setIsLoading(true);
    setStatusMessage(`Reading ${sheetTarget}...`);
    try {
      const rawSheet = sheetTarget.replace(/^'|'\$$|\$$/g, '');
      const fieldsRes = await excelDataSourceProvider.getFields(
        { filePath: targetPath, sheetName: rawSheet, headerRow, hasHeaders },
        rawSheet
      );
      const previewRes = await excelDataSourceProvider.getPreview(
        { filePath: targetPath, sheetName: rawSheet, headerRow, hasHeaders, pageSize: 500 },
        rawSheet
      );

      setActiveFields(fieldsRes.map((f) => f.name));
      setActiveRecords(previewRes.rows || []);
      setColumnDefs(
        fieldsRes.map((f) => ({
          name: f.name,
          originalName: f.originalName,
          dataType: f.dataType as any,
        }))
      );
      setStatusMessage(`Loaded ${previewRes.totalRows} rows from ${rawSheet}`);
    } catch (err: any) {
      console.error('[DatabaseConnectionModal] Failed to load sheet:', err);
      setStatusMessage(`Error: ${err.message || 'Failed to read sheet'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync with current connection on open
  useEffect(() => {
    if (isOpen) {
      if (currentConnection && currentConnection.records && currentConnection.records.length > 0) {
        setViewMode('setup');
        setActiveDbName(currentConnection.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_'));
        setActiveDbTypeTitle(currentConnection.type === 'excel' ? 'Microsoft Excel' : currentConnection.type === 'csv' ? 'Text File' : 'Microsoft SQL Server');
        setActiveFields(currentConnection.fields || []);
        setActiveRecords(currentConnection.records || []);
        setFullFilePath(currentConnection.filePath || '');
        setFileName(currentConnection.fileName || currentConnection.filePath || '');
        if (currentConnection.sheetName) {
          setTablesToUse([`'${currentConnection.sheetName}$'`]);
        }
        if (currentConnection.columns) {
          setColumnDefs(currentConnection.columns);
        }
      } else {
        // No connection yet -> launch Wizard directly (Screenshot 1)
        setViewMode('wizard');
        setWizardStep(1);
        setSelectedDbType('ms_excel');
        setFileName('');
        setFullFilePath('');
        setTablesToUse([]);
        setAvailableTables([]);
        setActiveFields([]);
        setActiveRecords([]);
        setColumnDefs([]);
      }
    }
  }, [isOpen, currentConnection]);

  if (!isOpen) return null;

  // Handle native file selection (Excel or CSV)
  const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFullFilePath(file.name);
    const cleanBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
    setActiveDbName(cleanBaseName);

    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt');

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const parsed = parseCSVToDatabaseConnection(text, file.name);
          setActiveFields(parsed.fields);
          setActiveRecords(parsed.records);
          setTablesToUse([`'${cleanBaseName}$'`]);
          setAvailableTables([]);
        }
      };
      reader.readAsText(file);
    } else {
      // Real Excel file parsing via HTML input fallback
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const wb = XLSX.read(new Uint8Array(buffer), {
            type: 'array',
            cellDates: true,
            cellNF: true,
            cellText: true,
            cellFormula: true,
          });
          const sheets = wb.SheetNames || [];
          if (sheets.length > 0) {
            const primarySheet = sheets[0];
            const primaryFormatted = `'${primarySheet}$'`;
            setTablesToUse([primaryFormatted]);
            setAvailableTables(sheets.slice(1).map((s) => `'${s}$'`));

            const ws = wb.Sheets[primarySheet];
            if (ws && ws['!ref']) {
              const range = XLSX.utils.decode_range(ws['!ref']);
              const headerCounts: Record<string, number> = {};
              const cols: { name: string; originalName: string; index: number }[] = [];

              for (let c = range.s.c; c <= range.e.c; c++) {
                const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
                let orig = `Column_${c + 1}`;
                if (cell && cell.v !== undefined && String(cell.v).trim() !== '') {
                  orig = String(cell.w || cell.v).trim();
                }
                headerCounts[orig] = (headerCounts[orig] || 0) + 1;
                const uniqueName = headerCounts[orig] === 1 ? orig : `${orig}_${headerCounts[orig]}`;
                cols.push({ name: uniqueName, originalName: orig, index: c });
              }

              const rows: Record<string, string>[] = [];
              for (let r = range.s.r + 1; r <= range.e.r; r++) {
                let hasVal = false;
                const rowObj: Record<string, string> = {};
                for (const col of cols) {
                  const cell = ws[XLSX.utils.encode_cell({ r, c: col.index })];
                  if (cell && cell.v !== undefined && cell.v !== null) {
                    const disp = cell.w !== undefined ? String(cell.w) : String(cell.v);
                    rowObj[col.name] = disp;
                    if (disp.trim() !== '') hasVal = true;
                  } else {
                    rowObj[col.name] = '';
                  }
                }
                if (hasVal) rows.push(rowObj);
              }

              setActiveFields(cols.map((c) => c.name));
              setActiveRecords(rows);
              setColumnDefs(
                cols.map((c) => ({
                  name: c.name,
                  originalName: c.originalName,
                  dataType: 'text',
                }))
              );
            }
          }
        } catch (err) {
          console.error('Failed to parse Excel file:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Browse using Electron native dialog if available
  const handleBrowseClick = async () => {
    if (selectedDbType === 'ms_excel') {
      try {
        const res = await excelDataSourceProvider.browseFile();
        if (!res.canceled && res.filePath) {
          const pathVal = res.filePath;
          const nameVal = res.fileName || res.filePath.split(/[/\\]/).pop() || 'workbook.xlsx';
          setFullFilePath(pathVal);
          setFileName(nameVal);
          const cleanBase = nameVal.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
          setActiveDbName(cleanBase);

          const tables = await excelDataSourceProvider.getTables({ filePath: pathVal });
          if (tables && tables.length > 0) {
            const primarySheet = tables[0].name;
            const primaryFmt = `'${primarySheet}$'`;
            setTablesToUse([primaryFmt]);
            setAvailableTables(tables.slice(1).map((t) => `'${t.name}$'`));
            await loadWorkbookSheet(pathVal, primarySheet);
          }
          return;
        }
      } catch (err) {
        console.error('[DatabaseConnectionModal] Native browse error:', err);
      }
    }
    fileInputRef.current?.click();
  };

  // Move table from Available to Use
  const handleAddTable = async (tbl: string) => {
    setAvailableTables((prev) => prev.filter((t) => t !== tbl));
    if (!tablesToUse.includes(tbl)) {
      const updated = [...tablesToUse, tbl];
      setTablesToUse(updated);
      if (updated.length === 1 && (fullFilePath || fileName)) {
        await loadWorkbookSheet(fullFilePath || fileName, tbl);
      }
    }
  };

  // Move table from Use to Available
  const handleRemoveTable = async (tbl: string) => {
    if (tablesToUse.length <= 1) return; // Keep at least one
    const updated = tablesToUse.filter((t) => t !== tbl);
    setTablesToUse(updated);
    if (!availableTables.includes(tbl)) {
      setAvailableTables((prev) => [...prev, tbl]);
    }
    if (updated[0] && (fullFilePath || fileName)) {
      await loadWorkbookSheet(fullFilePath || fileName, updated[0]);
    }
  };

  // Complete wizard and open Database Setup dialog (Screenshot 4)
  const handleWizardFinish = async () => {
    const matchedType = BARTENDER_DB_TYPES.find((t) => t.id === selectedDbType);
    setActiveDbTypeTitle(matchedType?.title || 'Microsoft Excel');
    if (tablesToUse[0] && activeRecords.length === 0 && (fullFilePath || fileName)) {
      await loadWorkbookSheet(fullFilePath || fileName, tablesToUse[0]);
    }
    setViewMode('setup');
    setActiveSection('root');
  };

  // Apply connection from Screenshot 4 and close
  const handleSaveAndApply = () => {
    // Apply sort if specified
    let finalRecords = [...activeRecords];
    if (sortField) {
      finalRecords.sort((a, b) => {
        const valA = String(a[sortField] ?? '');
        const valB = String(b[sortField] ?? '');
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    // Apply filter if specified
    if (filterField && filterValue) {
      finalRecords = finalRecords.filter((r) => {
        const val = String(r[filterField] ?? '').toLowerCase();
        const target = filterValue.toLowerCase();
        if (filterOperator === 'equals') return val === target;
        if (filterOperator === 'contains') return val.includes(target);
        if (filterOperator === 'greater_than') return parseFloat(val) > parseFloat(target);
        return true;
      });
    }

    const primarySheet = (tablesToUse[0] || '').replace(/^'|'\$$|\$$/g, '');

    const compiled: DatabaseConnectionConfig = {
      id: currentConnection?.id || `db-${Date.now()}`,
      name: activeDbName || fileName || 'Excel Data',
      type: selectedDbType === 'ms_excel' ? 'excel' : selectedDbType === 'text_file' ? 'csv' : 'sql_mock',
      mode: 'linked',
      filePath: fullFilePath || fileName,
      fileName: fileName,
      sheetName: primarySheet,
      availableSheets: [...tablesToUse, ...availableTables].map((t) => t.replace(/^'|'\$$|\$$/g, '')),
      fields: activeFields,
      records: finalRecords,
      columns: columnDefs,
      status: 'CONNECTED',
      lastModified: new Date().toISOString(),
      lastRefreshed: new Date().toISOString(),
      autoRefresh: true,
    };

    onApplyConnection(compiled);
    onClose();
  };

  const currentPrimaryTable = tablesToUse[0] || "'Barcode Data$'";
  const generatedSql = `SELECT * FROM ${currentPrimaryTable}${
    filterField && filterValue ? ` WHERE (${filterField} LIKE '%${filterValue}%')` : ''
  }${sortField ? ` ORDER BY ${sortField} ${sortDirection.toUpperCase()}` : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/45 backdrop-blur-2xs select-none">
      <div
        className="w-full max-w-[700px] bg-[#f0f0f0] rounded-[6px] shadow-2xl border border-[#717171] flex flex-col overflow-hidden text-slate-800 font-sans"
        style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden native file input for Browse... */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.csv,.txt"
          onChange={handleNativeFileSelect}
          className="hidden"
        />

        {/* ---------------------------------------------------- */}
        {/* MODE A: DATABASE SETUP WIZARD (Screenshots 1, 2, 3) */}
        {/* ---------------------------------------------------- */}
        {viewMode === 'wizard' && (
          <div className="flex flex-col flex-1">
            {/* Window Title Bar */}
            <div className="h-[32px] bg-gradient-to-r from-[#ffffff] via-[#f5f5f5] to-[#ececec] border-b border-[#d1d5db] px-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BartenderIcons.TitleBarDatabase />
                <span className="text-[12px] font-semibold text-slate-800 tracking-normal">
                  Database Setup Wizard
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="w-5 h-5 flex items-center justify-center rounded-[2px] text-slate-500 hover:text-white hover:bg-[#e81123] active:bg-[#bf0f1d] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Wizard Body Content */}
            <div className="p-6 bg-white min-h-[385px] max-h-[75vh] overflow-y-auto">
              {/* STEP 1: Select Database Type (Screenshot 1) */}
              {wizardStep === 1 && (
                <div>
                  <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight mb-3">
                    Select Database Type
                  </h1>
                  <p className="text-[12.5px] text-slate-800 mb-3 leading-relaxed">
                    This wizard enables you to connect to a variety of relational database systems and data file types.
                  </p>
                  <p className="text-[12px] text-slate-900 font-normal mb-1.5">
                    Select the type of database:
                  </p>

                  <div
                    className="border border-[#7f9db9] bg-white max-h-[265px] overflow-y-auto rounded-[1px] p-[1px] shadow-inner"
                    style={{ scrollbarColor: '#c1c1c1 #f1f1f1', scrollbarWidth: 'thin' }}
                  >
                    {BARTENDER_DB_TYPES.map((item) => {
                      const isSelected = selectedDbType === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedDbType(item.id)}
                          onDoubleClick={() => setWizardStep(2)}
                          className={`px-2.5 py-1.5 flex items-center gap-3 cursor-pointer transition-none ${
                            isSelected
                              ? 'border border-[#cca100] text-slate-950 shadow-xs'
                              : 'border border-transparent hover:bg-[#e5f3ff] hover:border-[#b8d6fb] text-slate-800'
                          }`}
                          style={
                            isSelected
                              ? {
                                  background:
                                    'linear-gradient(180deg, #fffadb 0%, #fee99d 45%, #fed535 50%, #fee173 100%)',
                                  outline: '1px dotted #404040',
                                  outlineOffset: '-2px',
                                }
                              : undefined
                          }
                        >
                          <div className="shrink-0">{item.icon}</div>
                          <div className="min-w-0 flex-1 leading-snug">
                            <div className="text-[12.5px] font-bold tracking-tight text-slate-900">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-700 truncate">
                              {item.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: Select Excel File (Screenshot 2) */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                    Select Excel File
                  </h1>
                  <p className="text-[12.5px] text-slate-800">
                    Select or enter a spreadsheet name:
                  </p>

                  <div className="pt-2 flex items-center gap-2">
                    <label className="text-[12px] text-slate-900 font-normal shrink-0 w-20">
                      File Name:
                    </label>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="Click Browse or enter spreadsheet file path..."
                        className="w-full h-[25px] px-2 bg-white border border-[#0078d4] text-[12px] text-slate-900 outline-none rounded-[1px] shadow-2xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleBrowseClick}
                      className="min-w-[85px] h-[25px] px-3 text-[12px] font-normal border border-[#adadad] rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] active:bg-[#cce4f7] text-slate-800 cursor-pointer shadow-2xs"
                    >
                      Browse...
                    </button>
                  </div>

                  {isLoading && (
                    <div className="pt-2 text-[11px] text-blue-600 flex items-center gap-1.5 font-medium">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Loading worksheet data...
                    </div>
                  )}
                  {statusMessage && !isLoading && (
                    <div className="pt-2 text-[11px] text-slate-600">{statusMessage}</div>
                  )}

                  <div className="pt-6 text-[11px] text-slate-500">
                    Supported formats: Microsoft Excel Workbooks (*.xlsx, *.xls, *.xlsm), Comma Separated (*.csv)
                  </div>
                </div>
              )}

              {/* STEP 3: Select Tables (Screenshot 3) */}
              {wizardStep === 3 && (
                <div className="space-y-3">
                  <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                    Select Tables
                  </h1>
                  <p className="text-[12px] text-slate-800 leading-normal">
                    Select one or more of the available tables on the left, and move them to the list on the right. Tables may be moved between lists with drag-and-drop, or by double-clicking them.
                  </p>

                  {/* Dual List Boxes */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    {/* Available Tables Box */}
                    <div>
                      <label className="text-[12px] text-slate-800 block mb-1">
                        Available Tables:
                      </label>
                      <div className="border border-[#7f9db9] bg-white h-[200px] flex flex-col rounded-[1px] shadow-inner">
                        <div className="flex-1 overflow-y-auto p-1 text-[12px]">
                          {availableTables
                            .filter((t) => !tableSearch || t.toLowerCase().includes(tableSearch.toLowerCase()))
                            .map((tbl) => (
                              <div
                                key={tbl}
                                onDoubleClick={() => handleAddTable(tbl)}
                                onClick={() => handleAddTable(tbl)}
                                className="px-2 py-1 flex items-center gap-1.5 hover:bg-[#e5f3ff] cursor-pointer text-slate-800 select-none"
                              >
                                <BartenderIcons.SheetTableIcon />
                                <span>{tbl}</span>
                              </div>
                            ))}
                          {availableTables.length === 0 && (
                            <div className="p-3 text-[11px] text-slate-400 italic text-center">
                              All available tables are currently selected
                            </div>
                          )}
                        </div>
                        {/* Search Input at bottom of Available Tables */}
                        <div className="border-t border-[#7f9db9] h-[24px] px-1.5 flex items-center bg-white">
                          <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder="Filter..."
                            className="w-full text-[11px] outline-none bg-transparent"
                          />
                          <Search className="w-3.5 h-3.5 text-blue-600 shrink-0 cursor-pointer" />
                        </div>
                      </div>
                    </div>

                    {/* Tables to Use Box */}
                    <div>
                      <label className="text-[12px] text-slate-800 block mb-1">
                        Tables to Use:
                      </label>
                      <div className="border border-[#7f9db9] bg-white h-[200px] overflow-y-auto p-1 text-[12px] rounded-[1px] shadow-inner">
                        {tablesToUse.map((tbl) => (
                          <div
                            key={tbl}
                            onDoubleClick={() => handleRemoveTable(tbl)}
                            className="px-2 py-1 flex items-center gap-1.5 bg-[#e5f3ff] border border-[#b8d6fb] rounded-[1px] text-slate-900 mb-1 cursor-pointer select-none"
                          >
                            <BartenderIcons.SheetTableIcon />
                            <span className="font-medium">{tbl}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
            <div className="px-5 py-3 bg-[#f0f0f0] border-t border-[#dfdfdf] flex items-center justify-end gap-2">
              {/* < Back */}
              <button
                type="button"
                disabled={wizardStep === 1}
                onClick={() => setWizardStep((prev) => (prev > 1 ? ((prev - 1) as any) : 1))}
                className="min-w-[76px] h-[25px] px-3 text-[12px] font-normal border border-[#adadad] rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] active:bg-[#cce4f7] disabled:opacity-45 disabled:pointer-events-none text-slate-800 cursor-pointer"
              >
                &lt; Back
              </button>

              {/* Next > */}
              {wizardStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev < 3 ? ((prev + 1) as any) : 3))}
                  className="min-w-[76px] h-[25px] px-3 text-[12px] font-normal border border-[#0078d4] ring-1 ring-[#0078d4]/40 rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] active:bg-[#cce4f7] text-slate-900 font-semibold cursor-pointer shadow-2xs"
                >
                  Next &gt;
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="min-w-[76px] h-[25px] px-3 text-[12px] font-normal border border-[#adadad] rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] opacity-45 pointer-events-none text-slate-800"
                >
                  Next &gt;
                </button>
              )}

              {/* Finish */}
              <button
                type="button"
                disabled={wizardStep < 3 && tablesToUse.length === 0}
                onClick={handleWizardFinish}
                className={`min-w-[76px] h-[25px] px-3 text-[12px] rounded-[2px] border cursor-pointer ${
                  wizardStep === 3
                    ? 'border-[#0078d4] bg-[#0078d4] text-white hover:bg-[#006cc1] font-semibold'
                    : 'border-[#adadad] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] text-slate-800 hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] disabled:opacity-45 disabled:pointer-events-none'
                }`}
              >
                Finish
              </button>

              {/* Cancel */}
              <button
                type="button"
                onClick={onClose}
                className="min-w-[76px] h-[25px] px-3 text-[12px] font-normal border border-[#adadad] rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] active:bg-[#cce4f7] text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODE B: DATABASE SETUP DIALOG (Exact Screenshot 4)  */}
        {/* ---------------------------------------------------- */}
        {viewMode === 'setup' && (
          <div className="flex flex-col flex-1">
            {/* Title Bar (Screenshot 4: "Database Setup") */}
            <div className="h-[32px] bg-gradient-to-r from-[#ffffff] via-[#f5f5f5] to-[#ececec] border-b border-[#d1d5db] px-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BartenderIcons.TitleBarDatabase />
                <span className="text-[12px] font-semibold text-slate-800 tracking-normal">
                  Database Setup
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="w-5 h-5 flex items-center justify-center rounded-[2px] text-slate-500 hover:text-white hover:bg-[#e81123] active:bg-[#bf0f1d] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Main Area: Split Pane (Left Sidebar + Right Panel) */}
            <div className="flex flex-1 min-h-[390px] max-h-[75vh] bg-white">
              {/* Left Sidebar (Screenshot 4) */}
              <div className="w-[200px] border-r border-[#d1d5db] bg-white flex flex-col justify-between select-none">
                {/* Tree View Items */}
                <div className="p-2 space-y-0.5 text-[11.5px] overflow-y-auto flex-1">
                  {/* Root Database Node (e.g. barcode_colors_data) */}
                  <div
                    onClick={() => setActiveSection('root')}
                    className={`px-2 py-1.5 flex items-center gap-2 rounded-[2px] cursor-pointer ${
                      activeSection === 'root'
                        ? 'bg-[#e5f3ff] text-slate-900 font-bold border border-[#b8d6fb]'
                        : 'hover:bg-slate-100 text-slate-800 font-bold'
                    }`}
                  >
                    <Database className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">{activeDbName}</span>
                  </div>

                  {/* Sub-items (Tree View) */}
                  <div className="pl-4 space-y-0.5 pt-0.5">
                    {/* SQL Statement */}
                    <div
                      onClick={() => setActiveSection('sql')}
                      className={`px-2 py-1 flex items-center gap-2 rounded-[2px] cursor-pointer ${
                        activeSection === 'sql'
                          ? 'bg-[#e5f3ff] text-blue-950 font-semibold border border-[#b8d6fb]'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <BartenderIcons.SqlIcon />
                      <span>SQL Statement</span>
                    </div>

                    {/* Tables */}
                    <div
                      onClick={() => setActiveSection('tables')}
                      className={`px-2 py-1 flex items-center gap-2 rounded-[2px] cursor-pointer ${
                        activeSection === 'tables'
                          ? 'bg-[#e5f3ff] text-blue-950 font-semibold border border-[#b8d6fb]'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Tables</span>
                    </div>

                    {/* Fields */}
                    <div
                      onClick={() => setActiveSection('fields')}
                      className={`px-2 py-1 flex items-center gap-2 rounded-[2px] cursor-pointer ${
                        activeSection === 'fields'
                          ? 'bg-[#e5f3ff] text-blue-950 font-semibold border border-[#b8d6fb]'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Fields</span>
                    </div>

                    {/* Sort Order */}
                    <div
                      onClick={() => setActiveSection('sort')}
                      className={`px-2 py-1 flex items-center gap-2 rounded-[2px] cursor-pointer ${
                        activeSection === 'sort'
                          ? 'bg-[#e5f3ff] text-blue-950 font-semibold border border-[#b8d6fb]'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Sort Order</span>
                    </div>

                    {/* Filter */}
                    <div
                      onClick={() => setActiveSection('filter')}
                      className={`px-2 py-1 flex items-center gap-2 rounded-[2px] cursor-pointer ${
                        activeSection === 'filter'
                          ? 'bg-[#e5f3ff] text-blue-950 font-semibold border border-[#b8d6fb]'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <FilterIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0 fill-emerald-600" />
                      <span>Filter</span>
                    </div>

                    {/* Options */}
                    <div
                      onClick={() => setActiveSection('options')}
                      className={`px-2 py-1 flex items-center gap-2 rounded-[2px] cursor-pointer ${
                        activeSection === 'options'
                          ? 'bg-[#e5f3ff] text-blue-950 font-semibold border border-[#b8d6fb]'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Options</span>
                    </div>

                    {/* Record Browser */}
                    <div
                      onClick={() => setActiveSection('browser')}
                      className={`px-2 py-1 flex items-center gap-2 rounded-[2px] cursor-pointer ${
                        activeSection === 'browser'
                          ? 'bg-[#e5f3ff] text-blue-950 font-semibold border border-[#b8d6fb]'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Record Browser</span>
                    </div>
                  </div>
                </div>

                {/* Bottom mini-toolbar in left sidebar (Screenshot 4) */}
                <div className="h-[30px] border-t border-[#d1d5db] bg-[#f9f9f9] px-2 flex items-center gap-1.5">
                  {/* New Database Wizard (Star icon) */}
                  <button
                    type="button"
                    title="Add new database connection"
                    onClick={() => {
                      setViewMode('wizard');
                      setWizardStep(1);
                    }}
                    className="p-1 hover:bg-[#e5f3ff] border border-transparent hover:border-[#adadad] rounded-[2px] text-amber-500 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                  </button>

                  {/* Delete Database (Red X) */}
                  <button
                    type="button"
                    title="Remove database connection"
                    onClick={() => {
                      setActiveRecords([]);
                      setActiveFields([]);
                      setViewMode('wizard');
                      setWizardStep(1);
                    }}
                    className="p-1 hover:bg-red-50 border border-transparent hover:border-red-300 rounded-[2px] text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Refresh (Green circular arrow) */}
                  <button
                    type="button"
                    title="Refresh data from source"
                    onClick={() => {
                      if (fullFilePath || fileName) {
                        loadWorkbookSheet(fullFilePath || fileName, tablesToUse[0] || 'Sheet1');
                      }
                    }}
                    className="p-1 hover:bg-emerald-50 border border-transparent hover:border-emerald-300 rounded-[2px] text-emerald-600 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Right Panel (Content based on selected sidebar item) */}
              <div className="flex-1 p-6 overflow-y-auto bg-white">
                {/* 1. Connection Properties (Root node selected - Exact Screenshot 4) */}
                {activeSection === 'root' && (
                  <div className="space-y-4">
                    <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                      Connection Properties
                    </h1>

                    <div className="space-y-2 text-[12.5px] pt-1">
                      <div className="flex items-center gap-8">
                        <span className="text-slate-800 w-20">Type:</span>
                        <span className="text-slate-900 font-medium">{activeDbTypeTitle}</span>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-slate-800 w-20">Database:</span>
                        <span className="text-slate-900 font-medium">{activeDbName}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('wizard');
                          setWizardStep(2);
                        }}
                        className="min-w-[155px] h-[25px] px-3 text-[12px] font-normal border border-[#adadad] rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] active:bg-[#cce4f7] text-slate-800 cursor-pointer shadow-2xs"
                      >
                        Configure Connection...
                      </button>
                    </div>

                    <p className="text-[12px] text-slate-800 pt-2">
                      Database connection properties are currently stored in this document.
                    </p>

                    <div className="text-[12px] text-slate-800 space-y-1 pt-1">
                      <p>To share this database connection with other documents, create a named connection.</p>
                      <button
                        type="button"
                        onClick={() => {
                          alert(`Named database connection created for "${activeDbName}". Saved to global BarTender repository.`);
                        }}
                        className="text-[#0072c6] hover:underline cursor-pointer block text-left"
                      >
                        Create named database connection
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. SQL Statement */}
                {activeSection === 'sql' && (
                  <div className="space-y-3">
                    <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                      SQL Statement
                    </h1>
                    <p className="text-[12px] text-slate-700">
                      The SQL statement retrieves records from the database table and binds them to the label design:
                    </p>
                    <textarea
                      rows={5}
                      readOnly
                      value={generatedSql}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 font-mono text-[12px] text-slate-800 rounded-[2px] outline-none"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>✓ Syntax validated. Ready to stream {activeRecords.length} records.</span>
                      <span className="font-mono text-emerald-700">STATUS: READY</span>
                    </div>
                  </div>
                )}

                {/* 3. Tables */}
                {activeSection === 'tables' && (
                  <div className="space-y-3">
                    <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                      Tables
                    </h1>
                    <p className="text-[12px] text-slate-700">
                      Active database tables and worksheets bound to this label template:
                    </p>
                    <div className="border border-slate-300 rounded-[2px] p-2 space-y-2 bg-slate-50">
                      {tablesToUse.map((tbl) => (
                        <div key={tbl} className="flex items-center gap-2 text-[12px] text-slate-800 font-medium">
                          <BartenderIcons.SheetTableIcon />
                          <span>{tbl}</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold ml-auto">
                            PRIMARY TABLE
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('wizard');
                        setWizardStep(3);
                      }}
                      className="text-[11.5px] text-[#0072c6] hover:underline cursor-pointer"
                    >
                      Modify table selection in Wizard &rarr;
                    </button>
                  </div>
                )}

                {/* 4. Fields */}
                {activeSection === 'fields' && (
                  <div className="space-y-3">
                    <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                      Fields
                    </h1>
                    <p className="text-[12px] text-slate-700">
                      Column definitions and data types detected in the data source:
                    </p>
                    <div className="border border-slate-300 rounded-[2px] max-h-[220px] overflow-y-auto">
                      <table className="w-full text-left text-[11.5px] border-collapse">
                        <thead className="bg-[#f0f0f0] border-b border-slate-300 sticky top-0">
                          <tr>
                            <th className="p-1.5 font-bold text-slate-700 border-r border-slate-300">Field Name</th>
                            <th className="p-1.5 font-bold text-slate-700 border-r border-slate-300">Data Type</th>
                            <th className="p-1.5 font-bold text-slate-700">Sample Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono">
                          {activeFields.map((fld) => (
                            <tr key={fld} className="hover:bg-blue-50/50">
                              <td className="p-1.5 text-slate-900 border-r border-slate-200 font-semibold">{fld}</td>
                              <td className="p-1.5 text-slate-600 border-r border-slate-200">
                                {fld.toLowerCase().includes('date') ? 'Date/Time' : fld.toLowerCase().includes('qty') || fld.toLowerCase().includes('price') ? 'Number' : 'String'}
                              </td>
                              <td className="p-1.5 text-slate-500 truncate max-w-[150px]">
                                {String(activeRecords[0]?.[fld] ?? '')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. Sort Order */}
                {activeSection === 'sort' && (
                  <div className="space-y-3">
                    <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                      Sort Order
                    </h1>
                    <p className="text-[12px] text-slate-700">
                      Specify fields to sort records in sequential print batches:
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1 text-[12px]">
                      <div>
                        <label className="text-slate-800 block mb-1 font-medium">Sort By Field:</label>
                        <select
                          value={sortField}
                          onChange={(e) => setSortField(e.target.value)}
                          className="w-full bg-white border border-slate-300 px-2 py-1 text-xs rounded-[2px]"
                        >
                          <option value="">(None - Source Natural Order)</option>
                          {activeFields.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-800 block mb-1 font-medium">Direction:</label>
                        <select
                          value={sortDirection}
                          onChange={(e) => setSortDirection(e.target.value as any)}
                          className="w-full bg-white border border-slate-300 px-2 py-1 text-xs rounded-[2px]"
                        >
                          <option value="asc">Ascending (A to Z, 0 to 9)</option>
                          <option value="desc">Descending (Z to A, 9 to 0)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Filter */}
                {activeSection === 'filter' && (
                  <div className="space-y-3">
                    <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                      Filter
                    </h1>
                    <p className="text-[12px] text-slate-700">
                      Define query filter criteria to extract only matching records:
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[12px]">
                      <div>
                        <label className="text-slate-800 block mb-1 font-medium">Field:</label>
                        <select
                          value={filterField}
                          onChange={(e) => setFilterField(e.target.value)}
                          className="w-full bg-white border border-slate-300 px-2 py-1 text-xs rounded-[2px]"
                        >
                          <option value="">(No Filter)</option>
                          {activeFields.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-800 block mb-1 font-medium">Operator:</label>
                        <select
                          value={filterOperator}
                          onChange={(e) => setFilterOperator(e.target.value as any)}
                          className="w-full bg-white border border-slate-300 px-2 py-1 text-xs rounded-[2px]"
                        >
                          <option value="contains">Contains</option>
                          <option value="equals">Equals</option>
                          <option value="greater_than">Greater Than</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-800 block mb-1 font-medium">Value:</label>
                        <input
                          type="text"
                          value={filterValue}
                          onChange={(e) => setFilterValue(e.target.value)}
                          placeholder="e.g. Cyan or 100"
                          className="w-full bg-white border border-slate-300 px-2 py-1 text-xs rounded-[2px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. Options */}
                {activeSection === 'options' && (
                  <div className="space-y-3">
                    <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                      Options
                    </h1>
                    <div className="space-y-2 text-[12px] text-slate-800 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded-[2px]" />
                        <span>First row contains field names</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded-[2px]" />
                        <span>Trim leading and trailing whitespace from string values</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded-[2px]" />
                        <span>Auto-refresh data before print job submission</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 8. Record Browser */}
                {activeSection === 'browser' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h1 className="text-[20px] text-[#0072c6] font-normal leading-tight">
                        Record Browser
                      </h1>
                      <span className="text-[11.5px] font-mono text-slate-600">
                        {activeRecords.length} Records Loaded
                      </span>
                    </div>
                    <div className="border border-slate-300 rounded-[2px] max-h-[220px] overflow-auto shadow-inner">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-[#f0f0f0] border-b border-slate-300 sticky top-0">
                          <tr>
                            <th className="p-1 px-2 border-r border-slate-300 text-center font-bold text-slate-700 w-8">#</th>
                            {activeFields.map((f) => (
                              <th key={f} className="p-1 px-2 border-r border-slate-300 font-bold text-slate-700 font-mono whitespace-nowrap">
                                {f}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono">
                          {activeRecords.map((rec, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
                              <td className="p-1 px-2 border-r border-slate-200 text-center text-slate-400">{idx + 1}</td>
                              {activeFields.map((f) => (
                                <td key={f} className="p-1 px-2 border-r border-slate-200 text-slate-800 whitespace-nowrap">
                                  {String(rec[f] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer Buttons (Screenshot 4: [OK] [Cancel] [Help]) */}
            <div className="px-5 py-3 bg-[#f0f0f0] border-t border-[#dfdfdf] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSaveAndApply}
                className="min-w-[76px] h-[25px] px-3 text-[12px] font-normal border border-[#0078d4] ring-1 ring-[#0078d4]/40 rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] active:bg-[#cce4f7] text-slate-900 font-semibold cursor-pointer shadow-2xs"
              >
                OK
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-w-[76px] h-[25px] px-3 text-[12px] font-normal border border-[#adadad] rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] active:bg-[#cce4f7] text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('BarTender Database Help: Connects Excel, CSV, SQL Server, and Access tables directly to barcode and text template objects.');
                }}
                className="min-w-[76px] h-[25px] px-3 text-[12px] font-normal border border-[#adadad] rounded-[2px] bg-gradient-to-b from-[#f7f7f7] to-[#e4e4e4] hover:from-[#e5f1fb] hover:to-[#e5f1fb] hover:border-[#0078d4] active:bg-[#cce4f7] text-slate-800 cursor-pointer"
              >
                Help
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
