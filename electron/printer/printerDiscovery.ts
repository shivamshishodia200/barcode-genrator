import { BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DetectedSystemPrinter {
  id: string;
  name: string;
  systemName: string;
  deviceName: string;
  displayName: string;
  driverName?: string;
  port?: string;
  portName?: string;
  location?: string;
  comment?: string;
  isDefault: boolean;
  isInteractive: boolean;
  status: 'READY' | 'OFFLINE' | 'PAUSED' | 'ERROR' | 'BUSY' | 'UNKNOWN' | 'ready' | 'offline' | 'paused' | 'error' | 'unknown';
  statusDetails?: string;
  connectionType: 'windows-driver';
  manufacturer?: string;
  model?: string;
  dpi?: number | null;
  nativeLanguages: string[];
  preferredRenderer: 'WINDOWS_DRIVER' | 'ZPL' | 'TSPL' | 'EPL';
  renderer: 'WINDOWS_DRIVER' | 'ZPL' | 'TSPL' | 'EPL';
  capabilities?: {
    color?: boolean;
    duplex?: boolean;
    speedControl?: boolean;
    darknessControl?: boolean;
    gapMedia?: boolean;
    blackMarkMedia?: boolean;
    continuousMedia?: boolean;
    cutter?: boolean;
    peeler?: boolean;
    rfid?: boolean;
    minDpi?: number | null;
    maxDpi?: number | null;
    maxPrintWidthMm?: number;
  };
}

export function isInteractiveDriverPrinter(meta: {
  name: string;
  driverName?: string;
  portName?: string;
}): boolean {
  const port = (meta.portName || '').trim().toLowerCase();
  const driver = (meta.driverName || '').trim().toLowerCase();
  const name = meta.name.trim().toLowerCase();

  // 1. Port indicates prompt or virtual document sink
  if (
    port === 'portprompt:' ||
    port === 'nul:' ||
    port.startsWith('file:') ||
    port.includes('prompt') ||
    port.includes('virtual') ||
    port.includes('kingsoft') ||
    port.includes('nitro') ||
    port.includes('pdf')
  ) {
    return true;
  }

  // 2. Driver indicates virtual document generator / interactive driver
  if (
    driver.includes('print to pdf') ||
    driver.includes('pdf driver') ||
    driver.includes('virtual printer') ||
    driver.includes('onenote') ||
    driver.includes('document writer') ||
    driver.includes('fax')
  ) {
    return true;
  }

  // 3. Printer name indicates virtual printer
  if (
    name.includes('print to pdf') ||
    name.includes('wps pdf') ||
    name.includes('onenote') ||
    name.includes('nitro pdf')
  ) {
    return true;
  }

  // Physical USB, Network (IP_*, WSD-*, \\*), Serial, Parallel -> Direct print (silent: true)
  return false;
}

/**
 * Discovers real installed Windows printers using Electron WebContents and Windows CIM/Spooler API.
 * Uses Get-CimInstance Win32_Printer for 100% reliable Default, WorkOffline, PortName, DriverName, Location, Comment.
 */
export async function discoverSystemPrinters(
  window?: BrowserWindow | null
): Promise<DetectedSystemPrinter[]> {
  const printerMap = new Map<string, DetectedSystemPrinter>();
  let electronDefaultName: string | null = null;

  // 1. Probe via Electron native getPrintersAsync if window is available
  const activeWin = window && !window.isDestroyed() ? window : (BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null);
  if (activeWin) {
    try {
      const electronPrinters = await activeWin.webContents.getPrintersAsync();
      electronPrinters.forEach((p, idx) => {
        const isDefault = Boolean(p.isDefault);
        if (isDefault) {
          electronDefaultName = p.name;
        }
        const statusStr = p.status === 0 ? 'READY' : p.status === 3 ? 'READY' : 'UNKNOWN';

        const detected = buildDetectedPrinterFromMeta({
          id: `prn-win-${idx + 1}`,
          name: p.name,
          driverName: p.description || p.name,
          isDefault,
          status: statusStr,
        });

        printerMap.set(p.name.trim().toLowerCase(), detected);
      });
    } catch (err) {
      console.warn('[PrinterDiscovery] Electron getPrintersAsync warning:', err);
    }
  }

  // 2. Query Windows CIM Win32_Printer for enriched driver, port, offline state, location, comment, and exact Default printer
  if (process.platform === 'win32') {
    try {
      const psCommand = `powershell -NoProfile -NonInteractive -Command "$ProgressPreference = 'SilentlyContinue'; Get-CimInstance Win32_Printer | Select-Object Name, Default, DriverName, PortName, PrinterStatus, WorkOffline, Location, Comment | ConvertTo-Json -Compress"`;
      const execPromise = execAsync(psCommand);
      const timeoutPromise = new Promise<{ stdout: string }>((_, reject) =>
        setTimeout(() => reject(new Error('PowerShell CIM query timed out')), 6000)
      );
      const { stdout } = await Promise.race([execPromise, timeoutPromise]);
      if (stdout.trim()) {
        const jsonStart = stdout.indexOf('[');
        const jsonObjStart = stdout.indexOf('{');
        const start = jsonStart !== -1 && (jsonObjStart === -1 || jsonStart < jsonObjStart) ? jsonStart : jsonObjStart;
        const end = Math.max(stdout.lastIndexOf(']'), stdout.lastIndexOf('}'));
        const jsonStr = start !== -1 && end !== -1 && end > start ? stdout.slice(start, end + 1) : stdout.trim();
        const parsed = JSON.parse(jsonStr);
        const list = Array.isArray(parsed) ? parsed : [parsed];

        let hasCimDefault = false;

        list.forEach((p: any, idx: number) => {
          const name = String(p.Name || '').trim();
          if (!name) return;
          const key = name.toLowerCase();

          const isDefault = Boolean(p.Default);
          if (isDefault) hasCimDefault = true;

          const isOffline = Boolean(p.WorkOffline);
          const psStatus: DetectedSystemPrinter['status'] = isOffline
            ? 'OFFLINE'
            : p.PrinterStatus === 1
            ? 'PAUSED'
            : p.PrinterStatus === 2
            ? 'ERROR'
            : 'READY';

          if (printerMap.has(key)) {
            const existing = printerMap.get(key)!;
            existing.driverName = p.DriverName || existing.driverName;
            existing.port = p.PortName || existing.port;
            existing.portName = p.PortName || existing.portName;
            existing.location = p.Location || existing.location;
            existing.comment = p.Comment || existing.comment;
            existing.isInteractive = isInteractiveDriverPrinter({
              name: existing.name,
              driverName: existing.driverName,
              portName: existing.portName,
            });
            existing.status = psStatus;
            if (isDefault) {
              existing.isDefault = true;
              existing.displayName = `Default (currently ${existing.name})`;
            }
          } else {
            const item = buildDetectedPrinterFromMeta({
              id: `prn-cim-${idx + 1}`,
              name,
              driverName: p.DriverName,
              port: p.PortName,
              location: p.Location,
              comment: p.Comment,
              isDefault,
              status: psStatus,
            });
            printerMap.set(key, item);
          }
        });

        // If CIM didn't indicate default, use Electron's detected default if available
        if (!hasCimDefault && electronDefaultName) {
          const defaultKey = electronDefaultName.toLowerCase();
          if (printerMap.has(defaultKey)) {
            const defPrn = printerMap.get(defaultKey)!;
            defPrn.isDefault = true;
            defPrn.displayName = `Default (currently ${defPrn.name})`;
          }
        }
      }
    } catch (err) {
      console.warn('[PrinterDiscovery] PowerShell Get-CimInstance Win32_Printer query error:', err);
    }
  }

  // Ensure ONLY ONE printer is marked default (Priority 1: Win32_Printer Default, Priority 2: Electron isDefault)
  let foundDefault = false;
  printerMap.forEach((printer) => {
    if (printer.isDefault) {
      if (foundDefault) {
        printer.isDefault = false;
        printer.displayName = printer.name;
      } else {
        foundDefault = true;
        printer.displayName = `Default (currently ${printer.name})`;
      }
    } else {
      printer.displayName = printer.name;
    }
  });

  return Array.from(printerMap.values());
}

function buildDetectedPrinterFromMeta(meta: {
  id: string;
  name: string;
  driverName?: string;
  port?: string;
  location?: string;
  comment?: string;
  isDefault: boolean;
  status: DetectedSystemPrinter['status'];
}): DetectedSystemPrinter {
  const lowerName = meta.name.toLowerCase();
  const lowerDriver = (meta.driverName || '').toLowerCase();

  const isTsc = lowerName.includes('tsc') || lowerDriver.includes('tsc');
  const isZebra =
    lowerName.includes('zebra') ||
    lowerDriver.includes('zdesigner') ||
    lowerDriver.includes('zpl');
  const isBrother = lowerName.includes('brother');
  const isPdf = lowerName.includes('pdf') || lowerDriver.includes('pdf');

  let manufacturer: string | undefined = undefined;
  let nativeLanguages: string[] = [];
  let preferredRenderer: DetectedSystemPrinter['preferredRenderer'] = 'WINDOWS_DRIVER';
  let dpi: number | null = null;

  // Extract DPI only if driver name or printer name explicitly specifies it (e.g. 203dpi, 300dpi, 600dpi)
  const dpiMatch = (meta.driverName || meta.name).match(/(\d{3})\s*dpi/i);
  if (dpiMatch) {
    dpi = parseInt(dpiMatch[1], 10);
  }

  if (isTsc) {
    manufacturer = 'TSC Auto ID';
    nativeLanguages = ['TSPL'];
  } else if (isZebra) {
    manufacturer = 'Zebra Technologies';
    nativeLanguages = ['ZPL'];
  } else if (isBrother) {
    manufacturer = 'Brother';
  } else if (isPdf) {
    manufacturer = 'Microsoft / Virtual PDF';
  } else {
    manufacturer = meta.driverName?.split(' ')[0] || undefined;
  }

  const isInteractive = isInteractiveDriverPrinter({
    name: meta.name,
    driverName: meta.driverName,
    portName: meta.port,
  });

  return {
    id: meta.id,
    name: meta.name,
    systemName: meta.name,
    deviceName: meta.name,
    displayName: meta.isDefault ? `Default (currently ${meta.name})` : meta.name,
    driverName: meta.driverName,
    port: meta.port,
    portName: meta.port,
    location: meta.location,
    comment: meta.comment,
    isDefault: meta.isDefault,
    isInteractive,
    status: meta.status,
    connectionType: 'windows-driver',
    manufacturer,
    model: meta.driverName || meta.name,
    dpi: dpi || null,
    nativeLanguages,
    preferredRenderer,
    renderer: preferredRenderer,
    capabilities: {
      color: isPdf || (!isTsc && !isZebra),
      duplex: false,
      speedControl: isTsc || isZebra,
      darknessControl: isTsc || isZebra,
      gapMedia: isTsc || isZebra,
      blackMarkMedia: isTsc || isZebra,
      continuousMedia: true,
      cutter: false,
      peeler: false,
      rfid: false,
      minDpi: dpi,
      maxDpi: dpi,
      maxPrintWidthMm: isTsc ? 108 : isZebra ? 104 : 215.9,
    },
  };
}
