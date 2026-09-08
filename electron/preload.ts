import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  // Secure Linked Excel Desktop APIs
  selectExcelFile: (): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
    ipcRenderer.invoke('excel:select-file'),
  locateExcelFile: (oldPath?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
    ipcRenderer.invoke('excel:locate-file', oldPath),
  testExcelConnection: (filePath: string, sheetName?: string): Promise<{ success: boolean; filePath?: string; fileName?: string; sheets?: string[]; sheetCount?: number; selectedSheet?: string; totalRecords?: number; lastModified?: string; sizeBytes?: number; error?: string; errorCode?: string; pathChecked?: string }> =>
    ipcRenderer.invoke('excel:test-connection', { filePath, sheetName }),
  readExcelWorkbook: (filePath: string, sheetName?: string, headerRow?: number): Promise<{ success: boolean; sheetNames?: string[]; selectedSheet?: string; columns?: string[]; records?: Record<string, any>[]; previewRows?: Record<string, any>[]; totalRecords?: number; lastModified?: string; sizeBytes?: number; error?: string }> =>
    ipcRenderer.invoke('excel:read-workbook', { filePath, sheetName, headerRow }),
  openExcelLocation: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:open-location', filePath),
  openExcelFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:open-file', filePath),
  watchExcelFile: (filePath: string, datasetId: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:watch-file', { filePath, datasetId }),
  unwatchExcelFile: (datasetId: string): Promise<boolean> =>
    ipcRenderer.invoke('excel:unwatch-file', datasetId),
  onExcelFileChanged: (callback: (data: { filePath: string; datasetId: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('excel:file-changed', listener);
    return () => {
      ipcRenderer.removeListener('excel:file-changed', listener);
    };
  },
  // Desktop Document File APIs
  showSaveDialog: (defaultFileName?: string, defaultDir?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string }> =>
    ipcRenderer.invoke('document:show-save-dialog', defaultFileName, defaultDir),
  saveFile: (filePath: string, documentData: any): Promise<{ success: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string; error?: string }> =>
    ipcRenderer.invoke('document:save-file', { filePath, documentData }),
  showOpenDialog: (defaultDir?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string }> =>
    ipcRenderer.invoke('document:show-open-dialog', defaultDir),
  readFile: (filePath: string): Promise<{ success: boolean; document?: any; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string; error?: string }> =>
    ipcRenderer.invoke('document:read-file', filePath),
  checkFileExists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('document:check-file-exists', filePath),
  openDocumentLocation: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('document:open-location', filePath),
  getFonts: (): Promise<string[]> =>
    ipcRenderer.invoke('fonts:list'),
  exitApp: (): Promise<boolean> =>
    ipcRenderer.invoke('app:exit'),
});

contextBridge.exposeInMainWorld('barcodeFlow', {
  printers: {
    list: (): Promise<any[]> => ipcRenderer.invoke('printers:list'),
    getDefault: (): Promise<any | null> => ipcRenderer.invoke('printers:get-default'),
    getStatus: (printerName: string): Promise<any> => ipcRenderer.invoke('printers:get-status', printerName),
    printDriver: (req: {
      printerName: string;
      htmlContent: string;
      widthMm: number;
      heightMm: number;
      copies?: number;
      landscape?: boolean;
      jobTitle?: string;
    }): Promise<{ success: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:print-driver', req),
    printRaw: (req: {
      printerName: string;
      rawContent: string;
      format: string;
      jobTitle?: string;
    }): Promise<{ success: boolean; bytesWritten: number; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:print-raw', req),
    testPrint: (req: {
      printerName: string;
      mode: 'driver' | 'raw';
      payload: any;
    }): Promise<{ success: boolean; message: string; error?: string }> =>
      ipcRenderer.invoke('printers:test-print', req),
    openProperties: (printerName: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('printers:open-properties', printerName),
  },
  fonts: {
    list: (): Promise<string[]> => ipcRenderer.invoke('fonts:list'),
  },
  database: {
    detectDependencies: (providerType: string): Promise<any> =>
      ipcRenderer.invoke('database:detect-dependencies', providerType),
    testConnection: (config: any): Promise<any> =>
      ipcRenderer.invoke('database:test-connection', config),
    listDatabases: (config: any): Promise<any[]> =>
      ipcRenderer.invoke('database:list-databases', config),
    listTables: (config: any): Promise<any[]> =>
      ipcRenderer.invoke('database:list-tables', config),
    listColumns: (config: any, table?: string): Promise<any[]> =>
      ipcRenderer.invoke('database:list-columns', config, table),
    query: (config: any, query: any): Promise<any> =>
      ipcRenderer.invoke('database:query', config, query),
    enumerateOleDbProviders: (): Promise<any[]> =>
      ipcRenderer.invoke('database:enumerate-oledb-providers'),
    enumerateOdbcDsns: (): Promise<any[]> =>
      ipcRenderer.invoke('database:enumerate-odbc-dsns'),
    enumerateOdbcDrivers: (): Promise<any[]> =>
      ipcRenderer.invoke('database:enumerate-odbc-drivers'),
    parseIdoc: (filePath: string, options?: any): Promise<any> =>
      ipcRenderer.invoke('database:parse-idoc', filePath, options),
    selectIdocFile: (): Promise<any> =>
      ipcRenderer.invoke('database:select-idoc-file'),
  },
  dataSources: {
    excel: {
      selectFile: (): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
        ipcRenderer.invoke('barcodeFlow:excel:select-file'),
      locateFile: (oldPath?: string): Promise<{ canceled: boolean; filePath?: string; fileName?: string; sizeBytes?: number; lastModified?: string }> =>
        ipcRenderer.invoke('barcodeFlow:excel:locate-file', oldPath),
      inspectWorkbook: (payload: { filePath: string; projectDir?: string }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:inspect-workbook', payload),
      getSheets: (payload: { filePath: string; projectDir?: string }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:get-sheets', payload),
      getFields: (payload: { filePath: string; sheetName: string; headerRow?: number; hasHeaders?: boolean; projectDir?: string }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:get-fields', payload),
      getPreview: (payload: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        page?: number;
        pageSize?: number;
        projectDir?: string;
        sort?: any;
        filters?: any;
        search?: any;
      }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:get-preview', payload),
      getRecords: (payload: {
        filePath: string;
        sheetName: string;
        headerRow?: number;
        hasHeaders?: boolean;
        query?: any;
        projectDir?: string;
      }): Promise<any> =>
        ipcRenderer.invoke('barcodeFlow:excel:get-records', payload),
      watch: (payload: { filePath: string; connectionId: string; projectDir?: string }): Promise<boolean> =>
        ipcRenderer.invoke('barcodeFlow:excel:watch', payload),
      unwatch: (connectionId: string): Promise<boolean> =>
        ipcRenderer.invoke('barcodeFlow:excel:unwatch', connectionId),
      onFileChanged: (callback: (data: { filePath: string; connectionId: string }) => void) => {
        const listener = (_event: any, data: any) => callback(data);
        ipcRenderer.on('barcodeFlow:excel:file-changed', listener);
        return () => {
          ipcRenderer.removeListener('barcodeFlow:excel:file-changed', listener);
        };
      },
      openFile: (filePath: string): Promise<boolean> =>
        ipcRenderer.invoke('excel:open-file', filePath),
      openLocation: (filePath: string): Promise<boolean> =>
        ipcRenderer.invoke('excel:open-location', filePath),
    },
  },
});
