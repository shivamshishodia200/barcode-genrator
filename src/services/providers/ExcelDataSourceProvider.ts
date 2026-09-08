/**
 * Enterprise Microsoft Excel Data Source Provider
 * BarcodeFlow Enterprise Suite
 */
import * as XLSX from 'xlsx';
import {
  IDataSourceProvider,
  ValidationResult,
  ConnectionResult,
  TestConnectionResult,
  DataTableInfo,
  DataFieldInfo,
  DataPage,
  PreviewOptions,
  RecordQuery,
  ExcelProviderConfig,
  WorkbookMetadata,
  ProviderError,
  ExcelCellValue,
} from './IDataSourceProvider';



export class ExcelDataSourceProvider implements IDataSourceProvider {
  public readonly type = 'excel';
  public readonly displayName = 'Microsoft Excel';

  public async detectDependencies() {
    return {
      available: true,
      driverName: 'Excel Native Parser Subsystem',
      architecture: 'x64' as const,
      status: 'AVAILABLE' as const,
      message: 'Excel spreadsheet provider is ready.',
    };
  }

  private activeWatchers = new Map<string, () => void>();
  private cache = new Map<string, { timestamp: number; data: DataPage }>();
  private changeListeners = new Set<(connectionId: string, filePath: string) => void>();

  constructor() {
    // Listen for file changes from Electron main process
    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.onFileChanged) {
      window.barcodeFlow.dataSources.excel.onFileChanged(({ filePath, connectionId }) => {
        console.log(`[ExcelProvider] Detected file change notification for ${connectionId}: ${filePath}`);
        // Invalidate cache
        this.invalidateCache(connectionId);
        // Notify subscribers
        this.changeListeners.forEach((listener) => {
          try {
            listener(connectionId, filePath);
          } catch (e) {
            console.error('[ExcelProvider] Error in change listener:', e);
          }
        });
      });
    }
  }

  /**
   * Subscribe to live file change events for linked workbooks
   */
  public onWorkbookChanged(callback: (connectionId: string, filePath: string) => void): () => void {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  /**
   * Clears internal cache for a connection or all connections
   */
  public invalidateCache(connectionId?: string): void {
    if (connectionId) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(connectionId)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Shows native OS open file dialog
   */
  public async browseFile(): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> {
    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.selectFile) {
      return await window.barcodeFlow.dataSources.excel.selectFile();
    }
    return { canceled: true };
  }

  /**
   * Validates Excel file path and parameters
   */
  public async validate(config: unknown): Promise<ValidationResult> {
    const cfg = config as Partial<ExcelProviderConfig>;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!cfg.filePath || !cfg.filePath.trim()) {
      errors.push('Workbook file path is required.');
    } else {
      const ext = cfg.filePath.slice(cfg.filePath.lastIndexOf('.')).toLowerCase();
      if (!['.xlsx', '.xls', '.xlsm'].includes(ext)) {
        errors.push(`Unsupported file extension "${ext}". BarcodeFlow supports .xlsx, .xls, and .xlsm.`);
      }
    }

    if (cfg.headerRow !== undefined && (isNaN(cfg.headerRow) || cfg.headerRow < 1)) {
      errors.push('Header row must be a positive integer greater than or equal to 1.');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  public async inspectWorkbook(filePath: string): Promise<{ success: boolean; sheetNames?: string[]; metadata?: any; error?: string }> {
    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.inspectWorkbook) {
      const res = await window.barcodeFlow.dataSources.excel.inspectWorkbook({ filePath });
      if (res.success && res.metadata) {
        return { success: true, sheetNames: res.metadata.sheetNames, metadata: res.metadata };
      }
    }
    return { success: false, error: 'Could not inspect workbook' };
  }

  /**
   * Tests connection to the Excel workbook and inspects real metadata
   */
  public async testConnection(config: unknown): Promise<TestConnectionResult> {
    const cfg = config as ExcelProviderConfig;
    const val = await this.validate(cfg);
    if (!val.valid) {
      return {
        success: false,
        status: 'ERROR',
        errorCode: 'EXCEL_INVALID_WORKBOOK',
        error: val.errors?.join(' ') || 'Invalid configuration.',
      };
    }

    // Electron environment
    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.inspectWorkbook) {
      const res = await window.barcodeFlow.dataSources.excel.inspectWorkbook({
        filePath: cfg.filePath,
        projectDir: cfg.projectDirectory,
      });

      if (!res.success) {
        return {
          success: false,
          status: 'ERROR',
          errorCode: res.errorCode || 'EXCEL_PARSE_FAILED',
          error: res.error || 'Failed to inspect Excel workbook.',
          details: { filePath: cfg.filePath },
        };
      }

      const meta = res.metadata as WorkbookMetadata;
      return {
        success: true,
        status: 'CONNECTED',
        message: `Successfully connected to ${meta.fileName} (${meta.sheetNames.length} sheets, ~${meta.estimatedRowCount} rows).`,
        details: {
          filePath: meta.fullPath,
          fileName: meta.fileName,
          sizeBytes: meta.fileSize,
          lastModified: meta.lastModified,
          sheetCount: meta.sheetNames.length,
          sheets: meta.sheetNames,
          selectedSheet: cfg.sheetName || meta.sheetNames[0],
          totalRecords: meta.estimatedRowCount,
        },
      };
    }

    // Pure Browser Fallback (e.g. Unit tests or Web UI)
    return {
      success: true,
      status: 'CONNECTED',
      message: 'Workbook validation successful.',
      details: { filePath: cfg.filePath },
    };
  }

  /**
   * Establishes connection and optionally initializes file watcher for linked mode
   */
  public async connect(config: unknown): Promise<ConnectionResult> {
    const cfg = config as ExcelProviderConfig;
    const test = await this.testConnection(cfg);
    if (!test.success) {
      return {
        success: false,
        errorCode: test.errorCode || 'EXCEL_PARSE_FAILED',
        error: test.error || 'Failed to establish Excel connection.',
      };
    }

    const connectionId = cfg.id || `excel-${Date.now()}`;

    // If Linked mode is requested, start file watcher
    if (cfg.mode === 'linked' || cfg.mode === 'link') {
      await this.startWatcher(connectionId, cfg.filePath, cfg.projectDirectory);
    }

    return {
      success: true,
      connectionId,
      metadata: test.details,
    };
  }

  /**
   * Retrieves all actual sheets in the workbook, including visibility flags
   */
  public async getTables(config: unknown): Promise<DataTableInfo[]> {
    const cfg = config as ExcelProviderConfig;
    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.getSheets) {
      const res = await window.barcodeFlow.dataSources.excel.getSheets({
        filePath: cfg.filePath,
        projectDir: cfg.projectDirectory,
      });

      if (!res.success) {
        throw new ProviderError(res.errorCode || 'EXCEL_PARSE_FAILED', res.error || 'Failed to retrieve sheets.');
      }
      return res.sheets as DataTableInfo[];
    }

    return [{ name: cfg.sheetName || 'Sheet1', displayName: cfg.sheetName || 'Sheet1', type: 'sheet' }];
  }

  /**
   * Retrieves fields with types, sample values, and deduplicated column names
   */
  public async getFields(config: unknown, table: string): Promise<DataFieldInfo[]> {
    const cfg = config as ExcelProviderConfig;
    const sheetName = table || cfg.sheetName;

    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.getFields) {
      const res = await window.barcodeFlow.dataSources.excel.getFields({
        filePath: cfg.filePath,
        sheetName,
        headerRow: cfg.headerRow ?? 1,
        hasHeaders: cfg.hasHeaders ?? true,
        projectDir: cfg.projectDirectory,
      });

      if (!res.success) {
        throw new ProviderError(res.errorCode || 'EXCEL_PARSE_FAILED', res.error || 'Failed to extract fields.');
      }

      return res.fields as DataFieldInfo[];
    }

    return [];
  }

  /**
   * Retrieves paginated preview data
   */
  public async getPreview(config: unknown, table: string, options?: PreviewOptions): Promise<DataPage> {
    const cfg = config as ExcelProviderConfig;
    const sheetName = table || cfg.sheetName;
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 200;

    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.getPreview) {
      const res = await window.barcodeFlow.dataSources.excel.getPreview({
        filePath: cfg.filePath,
        sheetName,
        headerRow: cfg.headerRow ?? 1,
        hasHeaders: cfg.hasHeaders ?? true,
        page,
        pageSize,
        projectDir: cfg.projectDirectory,
        sort: options?.sort || cfg.sort,
        filters: options?.filters || cfg.filters,
        search: options?.search || cfg.search,
      });

      if (!res.success) {
        throw new ProviderError(res.errorCode || 'EXCEL_PARSE_FAILED', res.error || 'Failed to read preview rows.');
      }

      return {
        page: res.page,
        pageSize: res.pageSize,
        totalRows: res.totalRows,
        totalPages: res.totalPages,
        columns: res.columns,
        fields: res.fields,
        rows: res.rows,
        normalizedCells: res.normalizedCells,
      };
    }

    return {
      page: 1,
      pageSize,
      totalRows: 0,
      totalPages: 1,
      columns: [],
      rows: [],
    };
  }

  /**
   * Queries records with pagination, sorting, filters, and search
   */
  public async getRecords(config: unknown, query: RecordQuery): Promise<DataPage> {
    const cfg = config as ExcelProviderConfig;
    const sheetName = query.table || cfg.sheetName;

    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.getRecords) {
      const res = await window.barcodeFlow.dataSources.excel.getRecords({
        filePath: cfg.filePath,
        sheetName,
        headerRow: cfg.headerRow ?? 1,
        hasHeaders: cfg.hasHeaders ?? true,
        query,
        projectDir: cfg.projectDirectory,
      });

      if (!res.success) {
        throw new ProviderError(res.errorCode || 'EXCEL_PARSE_FAILED', res.error || 'Failed to fetch records.');
      }

      return {
        page: res.page,
        pageSize: res.pageSize,
        totalRows: res.totalRows,
        totalPages: res.totalPages,
        columns: res.columns,
        fields: res.fields,
        rows: res.rows,
        normalizedCells: res.normalizedCells,
      };
    }

    return {
      page: 1,
      pageSize: query.pageSize || 200,
      totalRows: 0,
      totalPages: 1,
      columns: [],
      rows: [],
    };
  }

  /**
   * Creates an immutable, frozen snapshot of the dataset for batch printing
   * Requirement 31: If linked workbook changes mid-print, batch print is NOT corrupted.
   */
  public async createPrintSnapshot(
    config: ExcelProviderConfig,
    query?: RecordQuery
  ): Promise<{ snapshotId: string; records: Record<string, string>[]; totalRecords: number }> {
    console.log(`[ExcelProvider] Freezing print dataset snapshot for ${config.filePath}...`);
    // Fetch all matched records up to a safe enterprise ceiling (e.g. 100,000)
    const result = await this.getRecords(config, {
      ...query,
      page: 1,
      pageSize: 100000,
    });

    let records = [...result.rows];

    // Expand by quantity column if configured
    if (config.quantityColumn) {
      records = this.expandRecordsByQuantity(records, config.quantityColumn);
    }

    const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log(`[ExcelProvider] Print snapshot ${snapshotId} frozen with ${records.length} distinct records.`);

    return {
      snapshotId,
      records,
      totalRecords: records.length,
    };
  }

  /**
   * Expands records based on an Excel Quantity column
   * Example: Row A with Qty 2 -> 2 labels of A
   */
  public expandRecordsByQuantity(
    records: Record<string, string>[],
    quantityColumn: string
  ): Record<string, string>[] {
    if (!quantityColumn) return records;

    const expanded: Record<string, string>[] = [];
    for (const rec of records) {
      const rawQty = rec[quantityColumn];
      const parsed = parseInt(String(rawQty ?? '').trim(), 10);
      const qty = !isNaN(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 1; // Cap at 1000 to prevent DOS

      for (let i = 0; i < qty; i++) {
        expanded.push({ ...rec });
      }
    }
    return expanded;
  }

  /**
   * Refreshes provider cache and notifies listeners
   */
  public async refresh(connectionId: string): Promise<void> {
    this.invalidateCache(connectionId);
    console.log(`[ExcelProvider] Cache refreshed for connection: ${connectionId}`);
  }

  /**
   * Disconnects workbook and terminates watchers
   */
  public async disconnect(connectionId: string): Promise<void> {
    await this.stopWatcher(connectionId);
    this.invalidateCache(connectionId);
    console.log(`[ExcelProvider] Disconnected and unwatched connection: ${connectionId}`);
  }

  private async startWatcher(connectionId: string, filePath: string, projectDir?: string): Promise<void> {
    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.watch) {
      await window.barcodeFlow.dataSources.excel.watch({
        filePath,
        connectionId,
        projectDir,
      });
      this.activeWatchers.set(connectionId, () => {
        window.barcodeFlow?.dataSources?.excel?.unwatch(connectionId);
      });
    }
  }

  private async stopWatcher(connectionId: string): Promise<void> {
    const unwatch = this.activeWatchers.get(connectionId);
    if (unwatch) {
      unwatch();
      this.activeWatchers.delete(connectionId);
    }
    if (typeof window !== 'undefined' && window.barcodeFlow?.dataSources?.excel?.unwatch) {
      await window.barcodeFlow.dataSources.excel.unwatch(connectionId);
    }
  }
}

// Register singleton into registry
export const excelDataSourceProvider = new ExcelDataSourceProvider();
