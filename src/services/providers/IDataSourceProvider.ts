/**
 * Enterprise Data Source Provider Architecture
 * BarcodeFlow Enterprise Suite
 * Unified Contracts for SQL Server, Oracle, SAP IDoc, IBM DB2, IBM Informix, OLE DB, ODBC, Excel & CSV
 */

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface DependencyStatus {
  available: boolean;
  driverName?: string;
  driverVersion?: string;
  architecture?: 'x64' | 'x86' | 'both';
  requiredArchitecture?: 'x64' | 'x86';
  status: 'AVAILABLE' | 'DRIVER_REQUIRED' | 'DRIVER_MISSING' | 'ARCHITECTURE_MISMATCH';
  message: string;
  downloadUrl?: string;
  installationGuide?: string;
  instructions?: string;
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
  status:
    | 'CONNECTED'
    | 'AUTHENTICATION_FAILED'
    | 'SERVER_UNREACHABLE'
    | 'DATABASE_NOT_FOUND'
    | 'TLS_ERROR'
    | 'DRIVER_MISSING'
    | 'TIMEOUT'
    | 'INVALID_CONFIG'
    | 'ERROR';
  message?: string;
  error?: string;
  errorCode?: string;
  serverVersion?: string;
  databaseName?: string;
  details?: {
    server?: string;
    port?: number;
    database?: string;
    driver?: string;
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

export interface DatabaseInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
  sizeMb?: number;
  collation?: string;
}

export interface SchemaInfo {
  name: string;
  displayName?: string;
  owner?: string;
}

export interface DataTableInfo {
  name: string;
  displayName: string;
  schema?: string;
  type?: 'sheet' | 'table' | 'view' | 'segment';
  rowCount?: number;
  columnCount?: number;
  isHidden?: boolean;
  isVeryHidden?: boolean;
}

export interface DataFieldInfo {
  name: string;
  displayName: string;
  table?: string;
  schema?: string;
  dataType:
    | 'text'
    | 'number'
    | 'integer'
    | 'decimal'
    | 'date'
    | 'time'
    | 'datetime'
    | 'boolean'
    | 'binary'
    | 'formula'
    | 'barcode'
    | 'unknown';
  nativeDataType?: string;
  originalName?: string;
  columnIndex?: number;
  sampleValue?: string;
  numberFormat?: string;
  allowEmpty?: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  length?: number;
  precision?: number;
  scale?: number;
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
    | 'isNotEmpty'
    | 'isNull'
    | 'isNotNull'
    | 'between';
  value?: any;
  value2?: any;
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
  customSql?: string;
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
  customSql?: string;
  params?: Record<string, any>;
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

// --- Enterprise Connection Configurations ---

export interface SqlServerProviderConfig {
  id: string;
  name: string;
  providerType: 'sqlserver';
  server: string; // e.g. "localhost", "SERVER\\INSTANCE", "192.168.1.20,1433"
  authType: 'windows' | 'sql';
  username?: string;
  password?: string;
  credentialPolicy: 'store' | 'prompt';
  credentialId?: string;
  database?: string;
  schema?: string;
  table?: string;
  tables?: string[];
  customSql?: string;
  timeoutMs?: number;
  trustServerCertificate?: boolean;
  encrypt?: boolean;
  sort?: SortCondition[];
  filters?: FilterCondition[];
}

export interface OracleProviderConfig {
  id: string;
  name: string;
  providerType: 'oracle';
  host: string;
  port: number; // default 1521
  serviceName?: string;
  sid?: string;
  tnsAlias?: string;
  connectionString?: string;
  username?: string;
  password?: string;
  credentialPolicy: 'store' | 'prompt';
  credentialId?: string;
  schema?: string;
  table?: string;
  tables?: string[];
  customSql?: string;
  timeoutMs?: number;
  sort?: SortCondition[];
  filters?: FilterCondition[];
}

export interface SapIdocSegmentField {
  name: string;
  description?: string;
  dataType?: string;
  length?: number;
  value?: string;
}

export interface SapIdocSegment {
  id: string;
  name: string; // e.g. "EDI_DC40", "E1EDL20", "E1EDL24"
  description?: string;
  level: number;
  parentSegmentId?: string;
  fields: Record<string, string>;
  children?: SapIdocSegment[];
  isRepeated?: boolean;
}

export interface SapIdocConfig {
  id: string;
  name: string;
  providerType: 'sap-idoc';
  filePath: string;
  fileName?: string;
  idocType: string; // e.g. "DELVRY03", "ORDERS05"
  missingFieldRule: 'search_master' | 'use_empty';
  selectedSegments?: string[];
  selectedFields?: string[];
  sort?: SortCondition[];
  filters?: FilterCondition[];
}

export interface Db2ProviderConfig {
  id: string;
  name: string;
  providerType: 'db2';
  host: string;
  port: number; // default 50000
  database: string;
  username?: string;
  password?: string;
  credentialPolicy: 'store' | 'prompt';
  credentialId?: string;
  schema?: string;
  table?: string;
  tables?: string[];
  customSql?: string;
  timeoutMs?: number;
  sort?: SortCondition[];
  filters?: FilterCondition[];
}

export interface InformixProviderConfig {
  id?: string;
  name?: string;
  providerType?: 'informix';
  host?: string;
  port?: number; // default 9088
  servicePort?: number;
  server?: string;
  serverName?: string; // INFORMIXSERVER
  database?: string;
  username?: string;
  password?: string;
  credentialPolicy?: 'store' | 'prompt';
  credentialId?: string;
  table?: string;
  tables?: string[];
  customSql?: string;
  timeoutMs?: number;
  sort?: SortCondition[];
  filters?: FilterCondition[];
}

export interface OleDbProviderInfo {
  progId: string;
  displayName: string;
  description?: string;
  clsid?: string;
  architecture?: 'x64' | 'x86' | 'both';
  isInstalled: boolean;
}

export interface OleDbProviderConfig {
  id?: string;
  name?: string;
  providerType?: 'oledb';
  provider?: string;
  providerProgId?: string; // e.g. "Microsoft.ACE.OLEDB.12.0", "MSOLEDBSQL"
  dataSource?: string;
  connectionString?: string;
  username?: string;
  password?: string;
  authType?: 'integrated' | 'sql' | string;
  credentialPolicy?: 'store' | 'prompt';
  credentialId?: string;
  catalog?: string;
  initialCatalog?: string;
  schema?: string;
  table?: string;
  tables?: string[];
  customSql?: string;
  sort?: SortCondition[];
  filters?: FilterCondition[];
}

export interface OdbcDsnInfo {
  name: string;
  driver: string;
  scope: 'User' | 'System';
  description?: string;
}

export interface OdbcDriverInfo {
  name: string;
  version?: string;
  company?: string;
  driverFile?: string;
  architecture?: 'x64' | 'x86' | 'both';
}

export interface OdbcProviderConfig {
  id?: string;
  name?: string;
  providerType?: 'odbc';
  mode?: 'dsn' | 'connection_string' | 'driver' | 'connStr';
  dsn?: string;
  dsnName?: string;
  driver?: string;
  driverName?: string;
  connectionString?: string;
  username?: string;
  password?: string;
  credentialPolicy?: 'store' | 'prompt';
  credentialId?: string;
  catalog?: string;
  schema?: string;
  table?: string;
  tables?: string[];
  customSql?: string;
  sort?: SortCondition[];
  filters?: FilterCondition[];
}

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

export type AnyProviderConfig =
  | SqlServerProviderConfig
  | OracleProviderConfig
  | SapIdocConfig
  | Db2ProviderConfig
  | InformixProviderConfig
  | OleDbProviderConfig
  | OdbcProviderConfig
  | ExcelProviderConfig;

export type ProviderErrorCode =
  | 'DRIVER_MISSING'
  | 'ARCHITECTURE_MISMATCH'
  | 'INVALID_CONFIG'
  | 'AUTH_FAILED'
  | 'SERVER_UNREACHABLE'
  | 'DATABASE_NOT_FOUND'
  | 'SCHEMA_ERROR'
  | 'QUERY_ERROR'
  | 'QUERY_TIMEOUT'
  | 'FILE_NOT_FOUND'
  | 'INVALID_IDOC'
  | 'CONNECTION_CLOSED'
  | 'EXCEL_FILE_NOT_FOUND'
  | 'EXCEL_ACCESS_DENIED'
  | 'EXCEL_FILE_BUSY'
  | 'EXCEL_INVALID_WORKBOOK'
  | 'EXCEL_UNSUPPORTED_FORMAT'
  | 'EXCEL_SHEET_NOT_FOUND'
  | 'EXCEL_EMPTY_SHEET'
  | 'EXCEL_PARSE_FAILED'
  | 'UNKNOWN';

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
  readonly displayName: string;

  detectDependencies?(): Promise<DependencyStatus>;

  validate(config: unknown): Promise<ValidationResult>;

  connect(config: unknown): Promise<ConnectionResult>;

  testConnection(config: unknown): Promise<TestConnectionResult>;

  listDatabases?(config: unknown): Promise<DatabaseInfo[]>;

  listSchemas?(config: unknown): Promise<SchemaInfo[]>;

  getTables(config: unknown): Promise<DataTableInfo[]>;

  getFields(config: unknown, table: string): Promise<DataFieldInfo[]>;

  getPreview(config: unknown, table: string, options?: PreviewOptions): Promise<DataPage>;

  getRecords(config: unknown, query: RecordQuery): Promise<DataPage>;

  getRecordCount?(config: unknown, query?: RecordQuery): Promise<number>;

  refresh?(connectionId: string): Promise<void>;

  disconnect?(connectionId: string): Promise<void>;
}
