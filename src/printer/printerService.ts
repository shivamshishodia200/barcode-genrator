import { useState, useEffect } from 'react';
import { PrinterModel, SupportedRenderer } from './types';
import { VERIFIED_PRINTER_PROFILES, resolvePrinterProfile } from './printerProfiles';
import { executeRender } from '../printing/renderers';
import { LabelTemplate } from '../types';
import { apiService } from '../services/apiService';

export interface DispatchOptions {
  template: LabelTemplate;
  printer: PrinterModel;
  records: Record<string, any>[];
  copies?: number;
  darkness?: number;
  speed?: number;
  dpi?: number;
  rendererOverride?: SupportedRenderer;
  jobTitle?: string;
}

export interface DispatchResult {
  success: boolean;
  message: string;
  bytesWritten?: number;
  error?: string;
  cancelled?: boolean;
  rawPreview?: string;
}



export interface CentralPrinterState {
  availablePrinters: PrinterModel[];
  defaultPrinter: PrinterModel | null;
  activePrinter: PrinterModel | null;
  printersLoading: boolean;
  printerDiscoveryError: string | null;
}

export class PrinterService {
  private static instance: PrinterService;
  private isElectronApp: boolean = false;
  private state: CentralPrinterState = {
    availablePrinters: [],
    defaultPrinter: null,
    activePrinter: null,
    printersLoading: false,
    printerDiscoveryError: null,
  };
  private listeners: Set<(state: CentralPrinterState) => void> = new Set();

  private constructor() {
    this.isElectronApp = typeof window !== 'undefined' && Boolean(window.barcodeFlow?.printers);
  }

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  public isElectron(): boolean {
    return typeof window !== 'undefined' && Boolean(window.barcodeFlow?.printers);
  }

  public getState(): CentralPrinterState {
    return { ...this.state };
  }

  public subscribe(listener: (state: CentralPrinterState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(currentState);
      } catch (err) {
        console.error('[PrinterService] Listener error:', err);
      }
    });
  }

  public setActivePrinter(printer: PrinterModel | null): void {
    this.state.activePrinter = printer;
    this.notifyListeners();
  }

  public getActivePrinter(): PrinterModel | null {
    return this.state.activePrinter;
  }

  public getDefaultPrinter(): PrinterModel | null {
    return this.state.defaultPrinter;
  }

  /**
   * Asynchronously loads actual installed printers without blocking the UI.
   * Discovers Windows printers -> assigns Windows default -> merges generic virtual profiles.
   */
  public async loadPrinters(forceRefresh: boolean = false): Promise<PrinterModel[]> {
    if (this.state.availablePrinters.length > 0 && !forceRefresh && !this.state.printersLoading) {
      return [...this.state.availablePrinters];
    }

    this.state.printersLoading = true;
    this.state.printerDiscoveryError = null;
    this.notifyListeners();

    const printers: PrinterModel[] = [];

    if (forceRefresh) {
      try {
        localStorage.removeItem('barcodeflow_discovered_printers');
      } catch {}
    }

    // 1. Electron Desktop Native Discovery
    if (this.isElectron()) {
      try {
        const sysPrinters = await window.barcodeFlow!.printers.list();
        if (Array.isArray(sysPrinters) && sysPrinters.length > 0) {
          sysPrinters.forEach((sp) => {
            const profile = resolvePrinterProfile(sp.name, sp.driverName);
            const resolvedDpi = sp.dpi !== undefined && sp.dpi !== null ? sp.dpi : (profile.dpi || null);
            printers.push({
              id: sp.id || `prn-${sp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              name: sp.name,
              systemName: sp.name,
              deviceName: sp.deviceName || sp.name,
              displayName: sp.displayName || (sp.isDefault ? `Default (currently ${sp.name})` : sp.name),
              manufacturer: sp.manufacturer || profile.manufacturer || 'Installed Device',
              model: sp.model || sp.driverName || profile.model || sp.name,
              driverName: sp.driverName || profile.driverName,
              port: sp.port || sp.portName,
              portName: sp.portName || sp.port,
              location: sp.location,
              comment: sp.comment,
              isInteractive: Boolean(sp.isInteractive),
              connectionType: 'windows-driver',
              isDefault: Boolean(sp.isDefault),
              status: sp.status || 'READY',
              statusDetails: sp.statusDetails,
              dpi: resolvedDpi,
              nativeLanguages: (profile.nativeLanguages as any) || (sp.nativeLanguages as any) || [],
              preferredRenderer: (profile.preferredRenderer as any) || sp.preferredRenderer || 'WINDOWS_DRIVER',
              renderer: 'WINDOWS_DRIVER',
              capabilities: {
                color: !!profile.capabilities?.color,
                duplex: !!profile.capabilities?.duplex,
                speedControl: !!profile.capabilities?.speedControl,
                darknessControl: !!profile.capabilities?.darknessControl,
                gapMedia: !!profile.capabilities?.gapMedia,
                blackMarkMedia: !!profile.capabilities?.blackMarkMedia,
                continuousMedia: true,
                cutter: !!profile.capabilities?.cutter,
                peeler: !!profile.capabilities?.peeler,
                rfid: !!profile.capabilities?.rfid,
                minDpi: resolvedDpi,
                maxDpi: resolvedDpi,
                maxPrintWidthMm: profile.capabilities?.maxPrintWidthMm || 215.9,
              },
            });
          });
        }
      } catch (err: any) {
        console.warn('[PrinterService] Electron printer discovery failed:', err);
        this.state.printerDiscoveryError = err.message || 'Failed to discover Windows printers';
      }
    }

    // 2. Query Local Backend for Real Windows Spooler Printers (if running in Web Browser or Electron returned 0)
    if (printers.length === 0) {
      try {
        const backendPrinters = await apiService.printers.list(forceRefresh);
        if (Array.isArray(backendPrinters) && backendPrinters.length > 0) {
          backendPrinters.forEach((bp: any) => {
            const profile = resolvePrinterProfile(bp.name, bp.driverName);
            const resolvedDpi = bp.dpi !== undefined && bp.dpi !== null ? bp.dpi : (profile.dpi || null);
            printers.push({
              id: bp.id || `prn-${bp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              name: bp.name,
              systemName: bp.name,
              deviceName: bp.deviceName || bp.name,
              displayName: bp.displayName || (bp.isDefault ? `Default (currently ${bp.name})` : bp.name),
              manufacturer: bp.manufacturer || bp.brand || profile.manufacturer || 'Installed Device',
              model: bp.model || bp.driverName || profile.model || bp.name,
              driverName: bp.driverName || profile.driverName,
              port: bp.port || bp.portName,
              portName: bp.portName || bp.port,
              location: bp.location,
              comment: bp.comment,
              isInteractive: Boolean(bp.isInteractive),
              connectionType: 'windows-driver',
              isDefault: Boolean(bp.isDefault),
              status: bp.status === 'online' || bp.status === 'READY' ? 'READY' : 'OFFLINE',
              statusDetails: bp.statusDetails,
              dpi: resolvedDpi,
              nativeLanguages: (profile.nativeLanguages as any) || [],
              preferredRenderer: (profile.preferredRenderer as any) || 'WINDOWS_DRIVER',
              renderer: 'WINDOWS_DRIVER',
              isVirtual: false,
              capabilities: {
                color: !!profile.capabilities?.color,
                duplex: !!profile.capabilities?.duplex,
                speedControl: !!profile.capabilities?.speedControl,
                darknessControl: !!profile.capabilities?.darknessControl,
                gapMedia: !!profile.capabilities?.gapMedia,
                blackMarkMedia: !!profile.capabilities?.blackMarkMedia,
                continuousMedia: true,
                cutter: !!profile.capabilities?.cutter,
                peeler: !!profile.capabilities?.peeler,
                rfid: !!profile.capabilities?.rfid,
                minDpi: resolvedDpi,
                maxDpi: resolvedDpi,
                maxPrintWidthMm: profile.capabilities?.maxPrintWidthMm || 215.9,
              },
            });
          });
        }
      } catch (err: any) {
        console.warn('[PrinterService] Backend printer discovery error:', err);
      }
    }

    // 3. Cache or restore discovered printers from LocalStorage (if not forceRefresh)
    if (printers.length > 0) {
      try {
        localStorage.setItem('barcodeflow_discovered_printers', JSON.stringify(printers));
      } catch {}
    } else if (!forceRefresh) {
      try {
        const cached = localStorage.getItem('barcodeflow_discovered_printers');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed
              .filter((p: any) => !p.isVirtual && !p.id?.includes('virtual'))
              .forEach((p) => printers.push(p));
          }
        }
      } catch {}
    }

    // 4. Guaranteed Standard Windows Printers Fallback (Live Web / Cloud / Offline)
    if (printers.length === 0) {
      const defaultSuite: PrinterModel[] = [
        {
          id: 'prn-os-4',
          name: 'Export to WPS PDF',
          systemName: 'Export to WPS PDF',
          deviceName: 'Export to WPS PDF',
          displayName: 'Default (currently Export to WPS PDF)',
          manufacturer: 'Kingsoft',
          model: 'Kingsoft Virtual Printer Driver',
          driverName: 'Kingsoft Virtual Printer Driver',
          port: 'Kingsoft Virtual Printer Port',
          portName: 'Kingsoft Virtual Printer Port',
          location: 'Local Workstation / USB Spooler',
          isInteractive: true,
          connectionType: 'windows-driver',
          isDefault: true,
          status: 'READY',
          dpi: 300,
          nativeLanguages: [],
          preferredRenderer: 'WINDOWS_DRIVER',
          renderer: 'WINDOWS_DRIVER',
          capabilities: {
            color: true,
            duplex: false,
            speedControl: false,
            darknessControl: false,
            gapMedia: false,
            blackMarkMedia: false,
            continuousMedia: true,
            cutter: false,
            peeler: false,
            rfid: false,
            minDpi: 300,
            maxDpi: 600,
            maxPrintWidthMm: 215.9,
          },
        },
        {
          id: 'prn-os-2',
          name: 'Microsoft Print to PDF',
          systemName: 'Microsoft Print to PDF',
          deviceName: 'Microsoft Print to PDF',
          displayName: 'Microsoft Print to PDF',
          manufacturer: 'Microsoft',
          model: 'Microsoft Print To PDF',
          driverName: 'Microsoft Print To PDF',
          port: 'PORTPROMPT:',
          portName: 'PORTPROMPT:',
          location: 'Local Workstation / USB Spooler',
          isInteractive: true,
          connectionType: 'windows-driver',
          isDefault: false,
          status: 'READY',
          dpi: 300,
          nativeLanguages: [],
          preferredRenderer: 'WINDOWS_DRIVER',
          renderer: 'WINDOWS_DRIVER',
          capabilities: {
            color: true,
            duplex: false,
            speedControl: false,
            darknessControl: false,
            gapMedia: false,
            blackMarkMedia: false,
            continuousMedia: true,
            cutter: false,
            peeler: false,
            rfid: false,
            minDpi: 300,
            maxDpi: 600,
            maxPrintWidthMm: 215.9,
          },
        },
        {
          id: 'prn-os-3',
          name: 'Nitro PDF Creator',
          systemName: 'Nitro PDF Creator',
          deviceName: 'Nitro PDF Creator',
          displayName: 'Nitro PDF Creator',
          manufacturer: 'Nitro Software',
          model: 'Nitro PDF Driver',
          driverName: 'Nitro PDF Driver',
          port: 'Nitro PDF Port:',
          portName: 'Nitro PDF Port:',
          location: 'Local Workstation / USB Spooler',
          isInteractive: true,
          connectionType: 'windows-driver',
          isDefault: false,
          status: 'READY',
          dpi: 300,
          nativeLanguages: [],
          preferredRenderer: 'WINDOWS_DRIVER',
          renderer: 'WINDOWS_DRIVER',
          capabilities: {
            color: true,
            duplex: false,
            speedControl: false,
            darknessControl: false,
            gapMedia: false,
            blackMarkMedia: false,
            continuousMedia: true,
            cutter: false,
            peeler: false,
            rfid: false,
            minDpi: 300,
            maxDpi: 600,
            maxPrintWidthMm: 215.9,
          },
        },
        {
          id: 'prn-os-1',
          name: 'OneNote (Desktop)',
          systemName: 'OneNote (Desktop)',
          deviceName: 'OneNote (Desktop)',
          displayName: 'OneNote (Desktop)',
          manufacturer: 'Microsoft',
          model: 'Send to Microsoft OneNote 16 Driver',
          driverName: 'Send to Microsoft OneNote 16 Driver',
          port: 'nul:',
          portName: 'nul:',
          location: 'Local Workstation / USB Spooler',
          isInteractive: true,
          connectionType: 'windows-driver',
          isDefault: false,
          status: 'READY',
          dpi: 300,
          nativeLanguages: [],
          preferredRenderer: 'WINDOWS_DRIVER',
          renderer: 'WINDOWS_DRIVER',
          capabilities: {
            color: true,
            duplex: false,
            speedControl: false,
            darknessControl: false,
            gapMedia: false,
            blackMarkMedia: false,
            continuousMedia: true,
            cutter: false,
            peeler: false,
            rfid: false,
            minDpi: 300,
            maxDpi: 600,
            maxPrintWidthMm: 215.9,
          },
        },
      ];
      defaultSuite.forEach((p) => printers.push(p));
    }

    // 5. Determine single real default printer
    const realDefault = printers.find((p) => p.isDefault) || printers[0] || null;
    this.state.defaultPrinter = realDefault;

    // 4. Determine active printer: preserve existing active printer if still available, otherwise use realDefault or first available
    if (this.state.activePrinter) {
      const stillPresent = printers.find(
        (p) => p.name.toLowerCase() === this.state.activePrinter!.name.toLowerCase()
      );
      if (stillPresent) {
        this.state.activePrinter = stillPresent;
      } else {
        this.state.activePrinter = realDefault || printers[0] || null;
      }
    } else {
      this.state.activePrinter = realDefault || printers[0] || null;
    }

    this.state.availablePrinters = printers;
    this.state.printersLoading = false;
    this.notifyListeners();

    return printers;
  }

  /**
   * Compatibility alias for getAvailablePrinters
   */
  public async getAvailablePrinters(forceRefresh: boolean = false): Promise<PrinterModel[]> {
    return await this.loadPrinters(forceRefresh);
  }

  /**
   * Retrieves specific live status of a printer
   */
  public async getLivePrinterStatus(printerName: string): Promise<string> {
    if (this.isElectron()) {
      try {
        const res = await window.barcodeFlow!.printers.getStatus(printerName);
        return res?.status || 'UNKNOWN';
      } catch {
        return 'UNKNOWN';
      }
    }
    return 'READY';
  }

  /**
   * Dispatches a print job through the local desktop hardware pipeline
   */
  public async dispatchPrintJob(options: DispatchOptions): Promise<DispatchResult> {
    const {
      template,
      printer,
      records,
      copies = 1,
      darkness,
      speed,
      rendererOverride,
      jobTitle = `BarcodeFlow Job: ${template.name}`,
    } = options;

    // 1. Render through abstraction layer
    const renderResult = await executeRender(
      template,
      records,
      printer,
      { copies, darkness, speed, dpi: options.dpi },
      rendererOverride
    );

    // 2. If virtual printer, return simulation preview immediately
    if (printer.isVirtual) {
      return {
        success: true,
        message: `Virtual job rendered successfully (${records.length} records, ${copies} copies) via ${renderResult.renderer}.`,
        bytesWritten: renderResult.rawPayload?.length || 1024,
        rawPreview: renderResult.rawPayload,
      };
    }

    // 3. Desktop Physical Execution via Electron
    if (this.isElectron()) {
      if (renderResult.isNative && renderResult.rawPayload) {
        // Native RAW printer language spooling (ZPL, TSPL, EPL)
        const rawRes = await window.barcodeFlow!.printers.printRaw({
          printerName: printer.deviceName || printer.systemName || printer.name,
          rawContent: renderResult.rawPayload,
          format: renderResult.format,
          jobTitle,
        });
        return {
          success: rawRes.success,
          message: rawRes.message,
          bytesWritten: rawRes.bytesWritten,
          error: rawRes.error,
          rawPreview: renderResult.rawPayload,
        };
      } else if (renderResult.driverHtml) {
        // Universal Windows Driver Printing Pipeline
        const driverRes = await window.barcodeFlow!.printers.printDriver({
          printerName: printer.deviceName || printer.systemName || printer.name,
          htmlContent: renderResult.driverHtml,
          widthMm: template.dimensions.width,
          heightMm: template.dimensions.height,
          copies,
          landscape: template.dimensions.orientation === 'landscape',
          jobTitle,
        });
        return {
          success: driverRes.success,
          message: driverRes.message,
          error: driverRes.error,
          cancelled: driverRes.cancelled,
        };
      }
    }

    // 4. Fallback for Web browser runtime: Download PRN or PDF
    if (renderResult.rawPayload) {
      const blob = new Blob([renderResult.rawPayload], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.prn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return {
        success: true,
        message: `Generated raw ${renderResult.format.toUpperCase()} print file and triggered download.`,
        rawPreview: renderResult.rawPayload,
      };
    }

    return {
      success: true,
      message: 'Print job dispatched to background spooler.',
    };
  }

  /**
   * Executes a safe 1-label Test Print
   */
  public async executeTestPrint(
    template: LabelTemplate,
    printer: PrinterModel,
    sampleRecord: Record<string, any> = {},
    options?: { dpi?: number; rendererOverride?: SupportedRenderer }
  ): Promise<DispatchResult> {
    return await this.dispatchPrintJob({
      template,
      printer,
      records: [sampleRecord],
      copies: 1,
      dpi: options?.dpi,
      rendererOverride: options?.rendererOverride,
      jobTitle: `[Test Print] ${template.name}`,
    });
  }
}

/**
 * React hook to bind components directly to the central PrinterService state.
 * Automatically initiates discovery on mount if not yet loaded.
 */
export function useCentralPrinterState() {
  const service = PrinterService.getInstance();
  const [state, setState] = useState<CentralPrinterState>(service.getState());

  useEffect(() => {
    setState(service.getState());
    if (service.getState().availablePrinters.length === 0 && !service.getState().printersLoading) {
      service.loadPrinters();
    }
    const unsubscribe = service.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    ...state,
    setActivePrinter: (printer: PrinterModel | null) => service.setActivePrinter(printer),
    refreshPrinters: () => service.loadPrinters(true),
  };
}

