/**
 * Enterprise Data Source Provider Architecture
 * BarcodeFlow Enterprise Suite
 */

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface ConnectionResult {
  success: boolean;
  connectionId?: string;
  metadata?: Record<string, any>;
  error?: string;
  errorCode?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  errorCode?: string;
  details?: {
    filePath?: string;
    fileName?: string;
    sizeBytes?: number;
    lastModified?: string;
    sheetCount?: number;
    sheets?: string[];
    selectedSheet?: string;
    totalRecords?: number;
    columns?: string[];
    [key: string]: any;
  };
}

export interface DataTableInfo {
  name: string;
  displayName: string;
  type?: 'sheet' | 'table' | 'view';
  rowCount?: number;
  columnCount?: number;
  isHidden?: boolean;
  isVeryHidden?: boolean;
}

export interface DataFieldInfo {
  name: string;
  displayName: string;
  dataType: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'barcode' | 'unknown';
  originalName?: string;
  columnIndex?: number;
  sampleValue?: string;
  numberFormat?: string;
  allowEmpty?: boolean;
  defaultValue?: string;
}

export interface ExcelCellValue {
  rawValue: unknown;
  displayValue: string;
  formula?: string;
  dataType: 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'empty' | 'error';
  numberFormat?: string;
  dateValue?: string; // ISO string if date
}

export interface FilterCondition {
  field: string;
  operator:
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | 'greaterThan'
    | 'greaterThanOrEqual'
    | 'lessThan'
    | 'lessThanOrEqual'
    | 'isEmpty'
    | 'isNotEmpty';
  value?: any;
  logic?: 'AND' | 'OR';
}

export interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchOptions {
  query: string;
  fields?: string[];
  mode?: 'contains' | 'startsWith' | 'exact';
}

export interface PreviewOptions {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
  sort?: SortCondition[];
  filters?: FilterCondition[];
  search?: SearchOptions;
}

export interface RecordQuery {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
  sort?: SortCondition[];
  filters?: FilterCondition[];
  search?: SearchOptions;
  table?: string;
}

export interface DataPage {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  columns: string[];
  fields?: DataFieldInfo[];
  rows: Record<string, string>[];
  normalizedCells?: Record<string, ExcelCellValue>[];
}

export interface WorkbookMetadata {
  fileName: string;
  fullPath: string;
  fileSize: number;
  lastModified: string;
  sheetNames: string[];
  sheets: DataTableInfo[];
  selectedSheet?: string;
  estimatedRowCount?: number;
  columnCount?: number;
  isReadOnly?: boolean;
}

export type ExcelImportMode = 'import' | 'link' | 'imported' | 'linked';

export interface ExcelProviderConfig {
  id: string;
  name: string;
  providerType: 'excel';
  mode: ExcelImportMode;
  filePath: string;
  relativeFilePath?: string;
  sheetName: string;
  headerRow?: number;
  hasHeaders?: boolean;
  quantityColumn?: string;
  sort?: SortCondition[];
  filters?: FilterCondition[];
  search?: SearchOptions;
  autoRefresh?: boolean;
  debounceMs?: number;
  encoding?: string;
  projectDirectory?: string;
}

export type ProviderErrorCode =
  | 'EXCEL_FILE_NOT_FOUND'
  | 'EXCEL_ACCESS_DENIED'
  | 'EXCEL_FILE_BUSY'
  | 'EXCEL_INVALID_WORKBOOK'
  | 'EXCEL_UNSUPPORTED_FORMAT'
  | 'EXCEL_SHEET_NOT_FOUND'
  | 'EXCEL_EMPTY_SHEET'
  | 'EXCEL_FORMULA_NOT_CALCULATED'
  | 'EXCEL_PARSE_FAILED'
  | 'EXCEL_LINK_BROKEN'
  | 'EXCEL_UNKNOWN_ERROR';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly details?: Record<string, any>;

  constructor(code: ProviderErrorCode, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.details = details;
  }
}

export interface IDataSourceProvider {
  readonly type: string;

  validate(config: unknown): Promise<ValidationResult>;

  connect(config: unknown): Promise<ConnectionResult>;

  testConnection(config: unknown): Promise<TestConnectionResult>;

  getTables(config: unknown): Promise<DataTableInfo[]>;

  getFields(config: unknown, table: string): Promise<DataFieldInfo[]>;

  getPreview(config: unknown, table: string, options?: PreviewOptions): Promise<DataPage>;

  getRecords(config: unknown, query: RecordQuery): Promise<DataPage>;

  refresh(connectionId: string): Promise<void>;

  disconnect(connectionId: string): Promise<void>;
}
