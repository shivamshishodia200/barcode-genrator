/**
 * Enterprise Database IPC Handlers
 * BarcodeFlow Enterprise Suite
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import {
  detectProviderDependencies,
  testEnterpriseDatabaseConnection,
  listDatabases,
  listDatabaseTables,
  listDatabaseColumns,
  queryDatabaseRecords,
  enumerateWindowsOleDbProviders,
  enumerateWindowsOdbcDsns,
  enumerateWindowsOdbcDrivers,
} from './databaseEngine';
import { parseIdocFile } from './idocParser';

export function registerDatabaseIpc(getMainWindow?: () => BrowserWindow | null): void {
  // 1. Dependency Detection
  ipcMain.handle('database:detect-dependencies', async (_event, providerType: string) => {
    try {
      return await detectProviderDependencies(providerType);
    } catch (err: any) {
      return {
        available: false,
        driverName: providerType,
        architecture: 'x64',
        status: 'UNAVAILABLE',
        message: err.message || 'Failed to detect provider dependencies.',
      };
    }
  });

  // 2. Test Connection
  ipcMain.handle('database:test-connection', async (_event, config: any) => {
    try {
      return await testEnterpriseDatabaseConnection(config);
    } catch (err: any) {
      return {
        success: false,
        status: 'DISCONNECTED',
        error: err.message || 'Connection test failed.',
        errorCode: 'ERR_CONNECTION_FAILED',
      };
    }
  });

  // 3. List Databases (SQL Server / Oracle / Informix)
  ipcMain.handle('database:list-databases', async (_event, config: any) => {
    try {
      return await listDatabases(config);
    } catch {
      return [];
    }
  });

  // 4. List Tables / Views / IDoc Segments
  ipcMain.handle('database:list-tables', async (_event, config: any) => {
    try {
      return await listDatabaseTables(config);
    } catch {
      return [];
    }
  });

  // 5. List Columns / Fields
  ipcMain.handle('database:list-columns', async (_event, config: any, table?: string) => {
    try {
      return await listDatabaseColumns(config, table);
    } catch {
      return [];
    }
  });

  // 6. Query Records
  ipcMain.handle('database:query', async (_event, config: any, query: any) => {
    try {
      return await queryDatabaseRecords(config, query || {});
    } catch (err: any) {
      return {
        page: 1,
        pageSize: 50,
        totalRows: 0,
        totalPages: 0,
        columns: [],
        rows: [],
      };
    }
  });

  // 7. Enumerate Windows Native OLE DB Providers
  ipcMain.handle('database:enumerate-oledb-providers', async () => {
    try {
      return await enumerateWindowsOleDbProviders();
    } catch {
      return [];
    }
  });

  // 8. Enumerate Windows Native ODBC DSNs
  ipcMain.handle('database:enumerate-odbc-dsns', async () => {
    try {
      return await enumerateWindowsOdbcDsns();
    } catch {
      return [];
    }
  });

  // 9. Enumerate Windows Native ODBC Drivers
  ipcMain.handle('database:enumerate-odbc-drivers', async () => {
    try {
      return await enumerateWindowsOdbcDrivers();
    } catch {
      return [];
    }
  });

  // 10. SAP IDoc Parser
  ipcMain.handle('database:parse-idoc', async (_event, filePath: string, options?: any) => {
    try {
      return await parseIdocFile(filePath, options);
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to parse SAP IDoc file.',
      };
    }
  });

  // 11. SAP IDoc File Selector Dialog
  ipcMain.handle('database:select-idoc-file', async () => {
    try {
      const win = getMainWindow ? getMainWindow() : null;
      const result = await dialog.showOpenDialog(win || undefined as any, {
        title: 'Select SAP IDoc File (XML or Flat File)',
        buttonLabel: 'Select IDoc',
        filters: [
          { name: 'SAP IDoc Files (*.xml, *.idoc, *.txt, *.dat)', extensions: ['xml', 'idoc', 'txt', 'dat'] },
          { name: 'XML IDoc Files (*.xml)', extensions: ['xml'] },
          { name: 'Flat Text IDoc Files (*.txt, *.idoc, *.dat)', extensions: ['txt', 'idoc', 'dat'] },
          { name: 'All Files (*.*)', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || !result.filePaths.length) {
        return { canceled: true };
      }

      const selectedPath = result.filePaths[0];
      const stats = await fs.promises.stat(selectedPath);
      return {
        canceled: false,
        filePath: selectedPath,
        fileName: path.basename(selectedPath),
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    } catch (err: any) {
      return { canceled: true, error: err.message };
    }
  });
}
