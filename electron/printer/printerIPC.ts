import { ipcMain, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { discoverSystemPrinters, DetectedSystemPrinter } from './printerDiscovery';
import { sendRawBytesToWindowsSpooler } from './rawSpooler';

export interface DriverPrintRequest {
  printerName: string;
  htmlContent: string;
  widthMm: number;
  heightMm: number;
  copies?: number;
  landscape?: boolean;
  jobTitle?: string;
  silent?: boolean;
}

export interface RawPrintRequest {
  printerName: string;
  rawContent: string;
  format: string;
  jobTitle?: string;
}

/**
 * Resolves UI aliases like "Default (currently Microsoft Print to PDF)" to exact OS deviceName.
 */
function resolveDeviceName(rawName: string, defaultName?: string): string {
  if (!rawName) return defaultName || '';
  const trimmed = rawName.trim();
  if (trimmed.toLowerCase() === 'default' || trimmed.toLowerCase().startsWith('default (')) {
    const match = trimmed.match(/^default\s*\((?:currently\s+)?([^)]+)\)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return defaultName || trimmed;
  }
  return trimmed;
}

export function registerPrinterIpc(getMainWindow: () => BrowserWindow | null) {
  // 1. Enumerate Installed Printers
  ipcMain.handle('printers:list', async () => {
    const mainWindow = getMainWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null;
    return await discoverSystemPrinters(mainWindow);
  });

  // 2. Get Default Printer
  ipcMain.handle('printers:get-default', async () => {
    const mainWindow = getMainWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null;
    const printers = await discoverSystemPrinters(mainWindow);
    return printers.find((p) => p.isDefault) || null;
  });

  // 3. Get Specific Printer Status
  ipcMain.handle('printers:get-status', async (_event, printerName: string) => {
    const mainWindow = getMainWindow();
    const printers = await discoverSystemPrinters(mainWindow);
    const resolvedName = resolveDeviceName(printerName);
    const target = printers.find(
      (p) =>
        p.deviceName.toLowerCase() === resolvedName.toLowerCase() ||
        p.name.toLowerCase() === resolvedName.toLowerCase()
    );
    if (!target) {
      return { status: 'UNKNOWN', message: 'Printer not found in installed devices.' };
    }
    return {
      status: target.status,
      name: target.deviceName,
      deviceName: target.deviceName,
      driverName: target.driverName,
      port: target.port,
      portName: target.portName,
      location: target.location,
      comment: target.comment,
      isDefault: target.isDefault,
    };
  });

  // 4. Universal Windows Driver Printing via Parented Off-Screen Print Host
  ipcMain.handle('printers:print-driver', async (_event, req: DriverPrintRequest) => {
    const {
      printerName,
      htmlContent,
      widthMm,
      heightMm,
      copies = 1,
      landscape = false,
      jobTitle = 'BarcodeFlow Label Job',
    } = req;

    const mainWindow = getMainWindow();
    const installed = await discoverSystemPrinters(mainWindow);
    const defaultPrinter = installed.find((p) => p.isDefault);
    const resolvedDeviceName = resolveDeviceName(printerName, defaultPrinter?.deviceName);

    const targetPrinter = installed.find(
      (p) =>
        p.deviceName.toLowerCase() === resolvedDeviceName.toLowerCase() ||
        p.name.toLowerCase() === resolvedDeviceName.toLowerCase() ||
        p.displayName.toLowerCase() === resolvedDeviceName.toLowerCase()
    );

    const targetDeviceName = targetPrinter ? targetPrinter.deviceName : resolvedDeviceName;

    console.log(`[PRINT] Requested printer: "${printerName}"`);
    console.log(`[PRINT] Resolved Windows deviceName: "${targetDeviceName}"`);
    console.log(`[PRINT] Renderer: WINDOWS_DRIVER`);
    console.log(`[PRINT] Job submitted: ${copies} label(s) (${widthMm}×${heightMm} mm)`);

    if (!targetPrinter && installed.length > 0) {
      console.warn(`[PRINT] Warning: Target printer "${targetDeviceName}" not found in installed devices.`);
    }

    // Windows driver printing: silent: true dispatches directly to the Windows Spooler.
    // For physical printers, this spools directly to hardware.
    // For virtual printers (Microsoft Print to PDF, Nitro, WPS), Windows Spooler and the driver display their native Save As dialog.
    const silent = req.silent !== undefined ? req.silent : true;
    console.log(`[PRINT] Windows Spooler Dispatch: silent=${silent}`);

    return new Promise<{ success: boolean; message: string; error?: string; cancelled?: boolean }>((resolve) => {
      // Create off-screen print host window parented to mainWindow so any OS driver dialogs are centered
      let printHost: BrowserWindow | null = new BrowserWindow({
        parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
        show: false,
        width: Math.max(800, Math.round(widthMm * 3.78)),
        height: Math.max(600, Math.round(heightMm * 3.78)),
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      printHost.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      printHost.webContents.on('did-finish-load', async () => {
        if (!printHost) return;

        // Ensure fonts and vector graphics are ready before calling OS print
        try {
          await printHost.webContents.executeJavaScript(`
            (async () => {
              if (document.fonts) {
                await document.fonts.ready;
              }
              return true;
            })()
          `);
        } catch (fontErr) {
          console.warn('[PRINT] Font readiness check warning:', fontErr);
        }

        if (!printHost) return;

        // Custom page size in microns (1 mm = 1000 microns)
        const widthMicrons = Math.round(widthMm * 1000);
        const heightMicrons = Math.round(heightMm * 1000);

        const printOptions: any = {
          silent,
          printBackground: true,
          deviceName: targetDeviceName,
          color: true,
          margins: {
            marginType: 'none',
          },
          landscape: Boolean(landscape),
          copies: Math.max(1, copies),
          pageSize: {
            width: widthMicrons,
            height: heightMicrons,
          },
        };

        printHost.webContents.print(printOptions, (success, failureReason) => {
          if (printHost) {
            try {
              printHost.destroy();
            } catch {}
            printHost = null;
          }

          if (success) {
            console.log(`[PRINT] Job successfully submitted to Windows Spooler for "${targetDeviceName}".`);
            resolve({
              success: true,
              message: `Print job submitted to ${targetDeviceName}`,
            });
          } else {
            console.warn(`[PRINT] Print callback status for "${targetDeviceName}": success=false, reason="${failureReason}"`);
            const isCancelled =
              failureReason === 'Print job canceled' ||
              failureReason === 'cancelled' ||
              (failureReason && failureReason.toLowerCase().includes('cancel'));
            resolve({
              success: false,
              cancelled: Boolean(isCancelled),
              error: isCancelled ? 'PRINT_CANCELLED' : failureReason || 'PRINT_FAILED',
              message: isCancelled
                ? 'Print job canceled by user.'
                : `Windows driver printing failed: ${failureReason}`,
            });
          }
        });
      });

      printHost.webContents.on('did-fail-load', (_ev, errCode, errDesc) => {
        if (printHost) {
          try {
            printHost.destroy();
          } catch {}
          printHost = null;
        }
        resolve({
          success: false,
          cancelled: false,
          error: errDesc,
          message: `Failed to render printable label document (${errCode}): ${errDesc}`,
        });
      });
    });
  });

  // 5. Native Raw Spooler Printing (ZPL, TSPL, EPL, ESC/POS)
  ipcMain.handle('printers:print-raw', async (_event, req: RawPrintRequest) => {
    const { printerName, rawContent, format, jobTitle = 'BarcodeFlow Raw Job' } = req;
    const resolvedDeviceName = resolveDeviceName(printerName);
    console.log(`[PRINT] Requested printer: ${printerName}`);
    console.log(`[PRINT] Windows system printer: ${resolvedDeviceName}`);
    console.log(`[PRINT] Renderer: RAW (${format.toUpperCase()})`);
    console.log(`[PRINT] Job submitted: ${jobTitle}`);
    return await sendRawBytesToWindowsSpooler(resolvedDeviceName, rawContent, jobTitle);
  });

  // 6. Test Print (Exact 1 Label)
  ipcMain.handle('printers:test-print', async (_event, req: { printerName: string; mode: 'driver' | 'raw'; payload: any }) => {
    const { printerName, mode, payload } = req;
    const mainWindow = getMainWindow();
    const installed = await discoverSystemPrinters(mainWindow);
    const defaultPrinter = installed.find((p) => p.isDefault);
    const resolvedDeviceName = resolveDeviceName(printerName, defaultPrinter?.deviceName);

    const targetPrinter = installed.find(
      (p) =>
        p.deviceName.toLowerCase() === resolvedDeviceName.toLowerCase() ||
        p.name.toLowerCase() === resolvedDeviceName.toLowerCase() ||
        p.displayName.toLowerCase() === resolvedDeviceName.toLowerCase()
    );
    const targetDeviceName = targetPrinter ? targetPrinter.deviceName : resolvedDeviceName;

    console.log(`[PRINT] [TEST PRINT] Target: "${targetDeviceName}", Mode: ${mode}`);

    if (mode === 'raw') {
      return await sendRawBytesToWindowsSpooler(targetDeviceName, payload.rawContent, 'BarcodeFlow Test Label');
    } else {
      const isInteractive = targetPrinter
        ? targetPrinter.isInteractive
        : targetDeviceName.toLowerCase().includes('pdf') ||
          targetDeviceName.toLowerCase().includes('wps') ||
          targetDeviceName.toLowerCase().includes('onenote');

      return new Promise((resolve) => {
        let printHost: BrowserWindow | null = new BrowserWindow({
          parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
          show: false,
          width: 800,
          height: 600,
          skipTaskbar: true,
          webPreferences: { nodeIntegration: false, contextIsolation: true },
        });

        printHost.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.htmlContent)}`);
        printHost.webContents.on('did-finish-load', async () => {
          if (!printHost) return;

          try {
            await printHost.webContents.executeJavaScript(`
              (async () => {
                if (document.fonts) await document.fonts.ready;
                return true;
              })()
            `);
          } catch {}

          if (!printHost) return;

          printHost.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: targetDeviceName,
              margins: { marginType: 'none' },
              copies: 1,
              pageSize: {
                width: Math.round((payload.widthMm || 50) * 1000),
                height: Math.round((payload.heightMm || 25) * 1000),
              },
            },
            (success, reason) => {
              if (printHost) {
                try {
                  printHost.destroy();
                } catch {}
                printHost = null;
              }
              const isCancelled = reason === 'Print job canceled' || reason === 'cancelled';
              resolve({
                success,
                cancelled: isCancelled,
                message: success
                  ? `Test print label sent to "${targetDeviceName}" successfully.`
                  : isCancelled
                  ? 'Test print canceled by user.'
                  : `Test print failed: ${reason}`,
                error: success ? undefined : isCancelled ? 'PRINT_CANCELLED' : reason,
              });
            }
          );
        });
      });
    }
  });

  // 7. Open Real Windows Printer Properties / Preferences Dialog
  ipcMain.handle('printers:open-properties', async (_event, printerName: string) => {
    if (process.platform === 'win32' && printerName) {
      try {
        const safeName = printerName.replace(/"/g, '');
        // printui.dll /e opens Printing Preferences for target printer
        exec(`rundll32.exe printui.dll,PrintUIEntry /e /n "${safeName}"`);
        return { success: true };
      } catch (err: any) {
        console.warn('[PrinterIPC] Error opening printer properties:', err);
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Platform not supported' };
  });

  // 8. Cancel Queued Jobs for Specific Printer
  ipcMain.handle('printers:cancel-queued-jobs', async (_event, printerName: string) => {
    if (process.platform === 'win32' && printerName) {
      return new Promise<{ success: boolean; message: string; error?: string }>((resolve) => {
        const safeName = printerName.replace(/'/g, "''");
        exec(
          `powershell.exe -NoProfile -Command "Get-PrintJob -PrinterName '${safeName}' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue"`,
          (err, stdout, stderr) => {
            if (err) {
              console.warn('[PrinterIPC] Cancel queued jobs warning/error:', err);
              resolve({
                success: false,
                message: `Could not cancel jobs for "${printerName}": ${stderr || err.message}`,
                error: err.message,
              });
            } else {
              resolve({
                success: true,
                message: `Successfully cancelled queued print jobs for "${printerName}".`,
              });
            }
          }
        );
      });
    }
    return { success: false, message: 'Platform not supported or printer not specified.' };
  });

  // 9. Generate Vector PDF via Chromium Engine (printToPDF)
  ipcMain.handle('printers:generate-pdf', async (_event, payload: {
    htmlContent: string;
    widthMm: number;
    heightMm: number;
    landscape?: boolean;
  }) => {
    let printHost: BrowserWindow | null = new BrowserWindow({
      show: false,
      width: Math.max(800, Math.round((payload.widthMm || 100) * 3.78)),
      height: Math.max(600, Math.round((payload.heightMm || 100) * 3.78)),
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    try {
      await new Promise<void>((resolve, reject) => {
        if (!printHost) return reject(new Error('Print host window missing'));
        const timeout = setTimeout(() => {
          resolve();
        }, 5000);

        printHost.webContents.once('did-finish-load', () => {
          clearTimeout(timeout);
          resolve();
        });
        printHost.webContents.once('did-fail-load', (_ev, code, desc) => {
          clearTimeout(timeout);
          reject(new Error(`HTML load failed: ${desc} (${code})`));
        });
        printHost.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.htmlContent)}`);
      });

      if (!printHost || printHost.isDestroyed()) {
        throw new Error('Print host window was destroyed before render');
      }

      // Wait for fonts and complete layout paint cycle
      try {
        await printHost.webContents.executeJavaScript(`
          (async () => {
            if (document.fonts) {
              await document.fonts.ready;
            }
            await new Promise(r => requestAnimationFrame(() => setTimeout(r, 60)));
            return true;
          })()
        `);
      } catch (jsErr) {
        console.warn('[PrinterIPC] Font readiness/render wait warning:', jsErr);
      }

      if (!printHost || printHost.isDestroyed()) {
        throw new Error('Print host window was destroyed');
      }

      const printOptions: any = {
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: 'none' },
      };

      if (payload.widthMm && payload.heightMm) {
        printOptions.pageSize = {
          width: Math.round(payload.widthMm * 1000), // in microns
          height: Math.round(payload.heightMm * 1000),
        };
      }
      if (payload.landscape !== undefined) {
        printOptions.landscape = Boolean(payload.landscape);
      }

      const pdfBuffer = await printHost.webContents.printToPDF(printOptions);

      return {
        success: true,
        base64Data: pdfBuffer.toString('base64'),
        sizeBytes: pdfBuffer.length,
      };
    } catch (err: any) {
      console.error('[PrinterIPC] generate-pdf failed:', err);
      return {
        success: false,
        error: err?.message || 'Chromium PDF generation failed',
      };
    } finally {
      if (printHost && !printHost.isDestroyed()) {
        try {
          printHost.destroy();
        } catch {}
        printHost = null;
      }
    }
  });
}
