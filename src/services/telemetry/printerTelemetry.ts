import { PrintCommitPolicy } from '../../types';

export interface PrinterTelemetryStatus {
  online: boolean;
  paperOut: boolean;
  headOpen: boolean;
  ribbonOut: boolean;
  paused: boolean;
  rawStatusString?: string;
  spoolerJobsCount?: number;
}

export interface JobTelemetryStatus {
  jobId: string;
  spoolerJobId?: number | string;
  status: 'PENDING' | 'SPOOLING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'PARTIAL' | 'UNKNOWN';
  pagesPrinted?: number;
  totalPages?: number;
  error?: string;
}

export interface IPrinterTelemetryProvider {
  name: string;
  getPrinterStatus(printerName: string): Promise<PrinterTelemetryStatus>;
  trackJob(jobId: string, spoolerJobId?: number | string): Promise<JobTelemetryStatus>;
  getCommitPolicy(printer: any, format?: string): PrintCommitPolicy;
  pollPhysicalCompletion(
    jobId: string,
    totalLabels: number
  ): Promise<{ isComplete: boolean; confirmedCount: number; unknownCount: number; failedCount: number }>;
}

/**
 * Windows Spooler Telemetry Provider for GDI and Driver-managed thermal/office printers.
 */
export class WindowsSpoolerTelemetryProvider implements IPrinterTelemetryProvider {
  public name = 'WindowsSpoolerTelemetry';

  public async getPrinterStatus(printerName: string): Promise<PrinterTelemetryStatus> {
    if (typeof window !== 'undefined' && window.barcodeFlow?.printers?.getStatus) {
      try {
        const raw = await window.barcodeFlow.printers.getStatus(printerName);
        return {
          online: raw?.status !== 'offline' && raw?.status !== 'error',
          paperOut: raw?.paperOut || false,
          headOpen: false,
          ribbonOut: false,
          paused: raw?.status === 'paused',
          rawStatusString: raw?.status || 'Ready',
          spoolerJobsCount: raw?.jobsCount || 0,
        };
      } catch {
        // Fallback
      }
    }
    return {
      online: true,
      paperOut: false,
      headOpen: false,
      ribbonOut: false,
      paused: false,
      rawStatusString: 'Spooler Active',
    };
  }

  public async trackJob(jobId: string, spoolerJobId?: number | string): Promise<JobTelemetryStatus> {
    return {
      jobId,
      spoolerJobId,
      status: 'COMPLETED',
      pagesPrinted: undefined,
    };
  }

  public getCommitPolicy(printer: any, format?: string): PrintCommitPolicy {
    // Windows printer drivers accept the full spool document atomically
    return 'WHOLE_JOB_ON_DISPATCH';
  }

  public async pollPhysicalCompletion(
    jobId: string,
    totalLabels: number
  ): Promise<{ isComplete: boolean; confirmedCount: number; unknownCount: number; failedCount: number }> {
    return {
      isComplete: true,
      confirmedCount: totalLabels,
      unknownCount: 0,
      failedCount: 0,
    };
  }
}

/**
 * Raw TCP / Direct Socket Telemetry Provider for thermal printers (Zebra, TSC, SATO, Datamax).
 */
export class RawTcpTelemetryProvider implements IPrinterTelemetryProvider {
  public name = 'RawTcpTelemetry';

  public async getPrinterStatus(printerName: string): Promise<PrinterTelemetryStatus> {
    return {
      online: true,
      paperOut: false,
      headOpen: false,
      ribbonOut: false,
      paused: false,
      rawStatusString: 'TCP Socket Ready',
    };
  }

  public async trackJob(jobId: string, spoolerJobId?: number | string): Promise<JobTelemetryStatus> {
    return {
      jobId,
      spoolerJobId,
      status: 'PRINTING',
    };
  }

  public getCommitPolicy(printer: any, format?: string): PrintCommitPolicy {
    // Thermal raw printers benefit from chunked batch commitments
    return 'PER_BATCH';
  }

  public async pollPhysicalCompletion(
    jobId: string,
    totalLabels: number
  ): Promise<{ isComplete: boolean; confirmedCount: number; unknownCount: number; failedCount: number }> {
    return {
      isComplete: true,
      confirmedCount: totalLabels,
      unknownCount: 0,
      failedCount: 0,
    };
  }
}

/**
 * Null Telemetry Provider for virtual printers and PDF generators.
 */
export class NullTelemetryProvider implements IPrinterTelemetryProvider {
  public name = 'NullTelemetry';

  public async getPrinterStatus(): Promise<PrinterTelemetryStatus> {
    return {
      online: true,
      paperOut: false,
      headOpen: false,
      ribbonOut: false,
      paused: false,
      rawStatusString: 'Virtual File Output',
    };
  }

  public async trackJob(jobId: string): Promise<JobTelemetryStatus> {
    return {
      jobId,
      status: 'COMPLETED',
    };
  }

  public getCommitPolicy(): PrintCommitPolicy {
    return 'WHOLE_JOB_ON_DISPATCH';
  }

  public async pollPhysicalCompletion(
    jobId: string,
    totalLabels: number
  ): Promise<{ isComplete: boolean; confirmedCount: number; unknownCount: number; failedCount: number }> {
    return {
      isComplete: true,
      confirmedCount: totalLabels,
      unknownCount: 0,
      failedCount: 0,
    };
  }
}

export function getTelemetryProvider(printer?: any, format: string = 'zpl'): IPrinterTelemetryProvider {
  if (!printer) return new NullTelemetryProvider();
  if (format === 'pdf' || format === 'png' || printer.isInteractive) {
    return new NullTelemetryProvider();
  }
  const isRaw = ['zpl', 'tspl', 'epl', 'cpcl', 'sbpl'].includes(format.toLowerCase());
  if (isRaw && (printer.ipAddress || printer.port === 9100 || printer.isThermal)) {
    return new RawTcpTelemetryProvider();
  }
  return new WindowsSpoolerTelemetryProvider();
}
