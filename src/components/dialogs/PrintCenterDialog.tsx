import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LabelTemplate, PrinterDefinition, PrintJob, ObjectPrintMethodSettings } from '../../types';
import {
  Printer as PrinterIcon,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Database,
  Sliders,
  FileCode,
  Check,
  X,
  SlidersHorizontal,
  HelpCircle,
  Settings,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { generateZPL, generateTSPL, generateEPL } from '../../services/zplEngine';
import { renderTSPL, renderZPL, renderCPCL, renderSBPL } from '../../printing/renderers';
import { exportLabelsToPDF } from '../../services/pdfExportService';
import { EnterprisePrintSpooler } from '../../services/printSpoolerService';
import { advanceTemplateSerialState } from '../../services/serializationEngine';
import { evaluateElementData } from '../../services/dataSourceEngine';
import {
  RecordSelectionModal,
  formatIndicesToRangeString,
  parseRangeStringToIndices,
} from './RecordSelectionModal';
import { PrinterPropertiesModal } from './PrinterPropertiesModal';
import { PrinterManagerModal } from './PrinterManagerModal';
import { PageSetupModal } from './PageSetupModal';
import { ShowPrinterCodeModal } from './ShowPrinterCodeModal';
import { PrinterCodeModifierModal, PrinterCodeModifierConfig } from './PrinterCodeModifierModal';
import { PrinterService, useCentralPrinterState } from '../../printer/printerService';
import { PrinterModel } from '../../printer/types';
import { createPrintPlan, PrintPlan } from '../../services/printPlanService';
import {
  getGlobalObjectPrintMethodSettings,
  saveGlobalObjectPrintMethodSettings,
  getEffectiveObjectPrintMethodSettings,
  DEFAULT_OBJECT_PRINT_METHOD_SETTINGS,
} from '../../services/objectPrintMethodService';

export interface PrintCenterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  printers?: PrinterDefinition[];
  recordData: Record<string, string>;
  onJobSubmitted: (job: PrintJob) => void;
  activeRecordIndex?: number;
  selectedRecordIndices?: number[];
  onOpenDatabaseSetup?: () => void;
  onUpdateTemplate?: (template: LabelTemplate) => void;
  onOpenPrintPreview?: (planOptions: {
    printer: PrinterModel;
    effectiveDpi: number | null;
    recordsToPrint: Record<string, any>[];
    copies: number;
    quantitySource: 'manual' | 'database_field';
    selectedQtyColumn?: string;
    serializedLabels: number;
    startingSlot: number;
  }) => void;
}

export const PrintCenterDialog: React.FC<PrintCenterDialogProps> = ({
  isOpen,
  onClose,
  template,
  printers: propPrinters = [],
  recordData,
  onJobSubmitted,
  activeRecordIndex = 0,
  selectedRecordIndices: propSelectedRecordIndices = [],
  onOpenDatabaseSetup,
  onUpdateTemplate,
  onOpenPrintPreview,
}) => {
  const {
    availablePrinters,
    defaultPrinter,
    activePrinter,
    printersLoading,
    setActivePrinter,
  } = useCentralPrinterState();

  // Dialog top tabs: 'print' | 'objectPrintMethod'
  const [activeTopTab, setActiveTopTab] = useState<'print' | 'objectPrintMethod'>('print');
  // Sub-tabs inside Print tab: 'quantity' | 'options'
  const [activeSubTab, setActiveSubTab] = useState<'quantity' | 'options'>('quantity');

  // Printer selection & parameters
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [serializedLabels, setSerializedLabels] = useState<number>(1);
  const [printOnBothSides, setPrintOnBothSides] = useState<boolean>(false);
  const [printToFile, setPrintToFile] = useState<boolean>(false);
  const [startingSlot, setStartingSlot] = useState<number>(
    (template.sheetGrid as any)?.startingSlot || 1
  );

  // Print properties
  const [darkness, setDarkness] = useState<number>(18);
  const [printSpeed, setPrintSpeed] = useState<number>(4); // ips
  const [mediaType, setMediaType] = useState<'continuous' | 'gap' | 'black_mark' | 'die_cut'>('gap');
  const [outputFormat, setOutputFormat] = useState<'zpl' | 'tspl' | 'epl' | 'cpcl' | 'sbpl' | 'pdf'>('pdf');

  // Options Tab Controls
  const [repeatDataEntry, setRepeatDataEntry] = useState<boolean>(false);
  const [cancelQueuedJobsBeforePrint, setCancelQueuedJobsBeforePrint] = useState<boolean>(false);
  const [enableDataEntry, setEnableDataEntry] = useState<boolean>(
    Boolean(template.dataEntryForm || (template.variables && template.variables.some((v: any) => v.promptAtPrint)))
  );
  const [enableCodeModifier, setEnableCodeModifier] = useState<boolean>(false);
  const [showPrinterCodeAtEnd, setShowPrinterCodeAtEnd] = useState<boolean>(false);

  // Printer Code Modifier Config
  const [codeModifierConfig, setCodeModifierConfig] = useState<PrinterCodeModifierConfig>({
    enabled: false,
    prefix: '',
    suffix: '',
    rules: [],
  });

  // Object Print Method Settings (Draft State)
  const [printMethodSettings, setPrintMethodSettings] = useState<ObjectPrintMethodSettings>(() =>
    getEffectiveObjectPrintMethodSettings(template)
  );

  // DPI override
  const [userDpiOverride, setUserDpiOverride] = useState<number | null>(null);

  // Execution states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobSuccess, setJobSuccess] = useState<string | null>(null);
  const [testPrintSuccess, setTestPrintSuccess] = useState<string | null>(null);
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [isCancellingJobs, setIsCancellingJobs] = useState(false);

  // Generated code modal state
  const [generatedCodePayload, setGeneratedCodePayload] = useState<{
    isOpen: boolean;
    code: string;
    format: string;
  }>({
    isOpen: false,
    code: '',
    format: 'ZPL',
  });

  // Sub-modals
  const [isRecordSelectionModalOpen, setIsRecordSelectionModalOpen] = useState(false);
  const [isPrinterPropertiesModalOpen, setIsPrinterPropertiesModalOpen] = useState(false);
  const [isPageSetupModalOpen, setIsPageSetupModalOpen] = useState(false);
  const [isCodeModifierModalOpen, setIsCodeModifierModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Database Connection Toggle
  const hasDatabaseConnection = Boolean(
    template.databaseConnection?.records && template.databaseConnection.records.length > 0
  );
  const [useDatabaseConnection, setUseDatabaseConnection] = useState<boolean>(hasDatabaseConnection);

  // Record Selection Mode
  const [recordSelectionMode, setRecordSelectionMode] = useState<'all' | 'current' | 'selected' | 'range'>('all');
  const [selectedIndices, setSelectedIndices] = useState<number[]>(
    propSelectedRecordIndices.length > 0
      ? propSelectedRecordIndices
      : template.databaseConnection?.records
      ? template.databaseConnection.records.map((_, i) => i)
      : [0]
  );
  const [rangeString, setRangeString] = useState<string>(() =>
    formatIndicesToRangeString(
      propSelectedRecordIndices.length > 0
        ? propSelectedRecordIndices
        : template.databaseConnection?.records
        ? template.databaseConnection.records.map((_, i) => i)
        : [0]
    )
  );

  // Quantity Source
  const [quantitySource, setQuantitySource] = useState<'manual' | 'database_field'>(
    template.databaseConnection?.quantityColumn ? 'database_field' : 'manual'
  );
  const [selectedQtyColumn, setSelectedQtyColumn] = useState<string>(
    template.databaseConnection?.quantityColumn || ''
  );

  const displayPrinters: PrinterModel[] = useMemo(() => {
    if (availablePrinters && availablePrinters.length > 0) {
      return availablePrinters.filter(
        (p) =>
          !p.isVirtual &&
          !p.id?.includes('citizen') &&
          !p.id?.includes('sato') &&
          !p.id?.includes('zebra') &&
          !p.id?.includes('tsc') &&
          !p.id?.includes('virtual')
      );
    }
    return [];
  }, [availablePrinters]);

  // Sync initial selection when opened or when template changes
  useEffect(() => {
    if (!isOpen) return;

    // Load effective object print method settings
    setPrintMethodSettings(getEffectiveObjectPrintMethodSettings(template));

    if (displayPrinters.length === 0) return;

    if (template.printer?.name) {
      const match = displayPrinters.find(
        (p) =>
          p.name.toLowerCase() === template.printer!.name.toLowerCase() ||
          p.systemName.toLowerCase() === (template.printer!.systemName || '').toLowerCase()
      );
      if (match) {
        setSelectedPrinterId(match.id);
        setActivePrinter(match);
        return;
      }
    }

    if (activePrinter) {
      const match = displayPrinters.find((p) => p.id === activePrinter.id);
      if (match) {
        setSelectedPrinterId(match.id);
        return;
      }
    }

    if (defaultPrinter) {
      const match = displayPrinters.find((p) => p.id === defaultPrinter.id);
      if (match) {
        setSelectedPrinterId(match.id);
        setActivePrinter(match);
        return;
      }
    }

    const firstChoice = displayPrinters.find((p) => !p.isVirtual) || displayPrinters[0];
    if (firstChoice) {
      setSelectedPrinterId(firstChoice.id);
      setActivePrinter(firstChoice);
    }
  }, [isOpen, displayPrinters, template.printer]);

  const selectedPrinter = useMemo(() => {
    return (
      displayPrinters.find((p) => p.id === selectedPrinterId) ||
      displayPrinters[0] ||
      ({
        id: 'fallback-pdf',
        name: 'Microsoft Print to PDF',
        systemName: 'Microsoft Print to PDF',
        isDefault: true,
        status: 'READY' as const,
        dpi: 300,
        driverName: 'Microsoft Print To PDF',
        port: 'PORTPROMPT:',
        portName: 'PORTPROMPT:',
        connectionType: 'windows-driver' as const,
        preferredRenderer: 'WINDOWS_DRIVER' as const,
        renderer: 'WINDOWS_DRIVER' as const,
      } as PrinterModel)
    );
  }, [displayPrinters, selectedPrinterId]);

  // Sync DPI
  useEffect(() => {
    if (!selectedPrinter) return;
    if (selectedPrinter.dpi) {
      setUserDpiOverride(selectedPrinter.dpi);
      return;
    }
    const storageKey = `barcodeflow_printer_dpi_${(selectedPrinter.systemName || selectedPrinter.name).trim().toLowerCase()}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setUserDpiOverride(parsed);
          return;
        }
      }
    } catch {}
    setUserDpiOverride(null);
  }, [selectedPrinterId, selectedPrinter]);

  const effectiveDpi = selectedPrinter?.dpi ?? userDpiOverride ?? null;

  // Determine if printer supports thermal speed / darkness
  const isThermalProtocol = outputFormat === 'zpl' || outputFormat === 'tspl' || outputFormat === 'epl' || outputFormat === 'cpcl' || outputFormat === 'sbpl';
  const isSpeedSupported = isThermalProtocol || Boolean(selectedPrinter?.capabilities?.speedControl);
  const isDarknessSupported = isThermalProtocol || Boolean(selectedPrinter?.capabilities?.darknessControl);

  // Raw dataset records
  const allRecords = useMemo(() => {
    if (useDatabaseConnection && template.databaseConnection?.records && template.databaseConnection.records.length > 0) {
      return template.databaseConnection.records;
    }
    return [recordData];
  }, [useDatabaseConnection, template.databaseConnection, recordData]);

  // Detected fields
  const availableColumns = useMemo(() => {
    if (template.databaseConnection?.fields && template.databaseConnection.fields.length > 0) {
      return template.databaseConnection.fields;
    }
    if (allRecords.length > 0) {
      return Object.keys(allRecords[0]);
    }
    return [];
  }, [template.databaseConnection, allRecords]);

  // Determine subset of records to print
  const recordsToPrint = useMemo(() => {
    if (!useDatabaseConnection || (allRecords.length === 1 && !template.databaseConnection?.records?.length)) {
      return [recordData];
    }

    switch (recordSelectionMode) {
      case 'current':
        return [allRecords[activeRecordIndex] || allRecords[0]];
      case 'selected':
        if (selectedIndices.length > 0) {
          return selectedIndices.map((idx) => allRecords[idx]).filter(Boolean);
        }
        return [allRecords[activeRecordIndex] || allRecords[0]];
      case 'range': {
        const parsed = parseRangeStringToIndices(rangeString, allRecords.length);
        if (parsed.length > 0) {
          return parsed.map((idx) => allRecords[idx]).filter(Boolean);
        }
        return allRecords;
      }
      case 'all':
      default:
        return allRecords;
    }
  }, [
    useDatabaseConnection,
    allRecords,
    recordSelectionMode,
    activeRecordIndex,
    selectedIndices,
    rangeString,
    recordData,
    template.databaseConnection,
  ]);

  // Total labels count
  const totalLabelsCount = useMemo(() => {
    if (quantitySource === 'database_field' && selectedQtyColumn) {
      return recordsToPrint.reduce((acc, row) => {
        const val = parseInt(String(row[selectedQtyColumn] ?? '1'), 10);
        const rowQty = isNaN(val) || val <= 0 ? 1 : val;
        return acc + rowQty * copies;
      }, 0);
    }
    return recordsToPrint.length * copies * Math.max(1, serializedLabels);
  }, [recordsToPrint, quantitySource, selectedQtyColumn, copies, serializedLabels]);

  // Validation
  const validationResult = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!selectedPrinter) {
      errors.push('No printer selected.');
    }

    if (recordsToPrint.length === 0) {
      errors.push('No records selected to print.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [selectedPrinter, recordsToPrint]);

  // Cancel Queued Jobs Handler
  const handlePurgePrinterQueue = async () => {
    if (!selectedPrinter) return;
    const confirmPurge = window.confirm(
      `Are you sure you want to cancel all queued print jobs for "${selectedPrinter.name}"?`
    );
    if (!confirmPurge) return;

    setIsCancellingJobs(true);
    try {
      if (window.barcodeFlow?.printers?.cancelQueuedJobs) {
        const res = await window.barcodeFlow.printers.cancelQueuedJobs(
          selectedPrinter.systemName || selectedPrinter.name
        );
        alert(res.message || (res.success ? 'Queued jobs cancelled successfully.' : 'No queued jobs found.'));
      } else {
        const res = await fetch(`http://localhost:3001/api/printers/${selectedPrinter.id}/cancel-jobs`, {
          method: 'POST',
        });
        const json = await res.json();
        alert(json.message || 'Queued print jobs cancelled.');
      }
    } catch (err: any) {
      alert(`Error cancelling queued jobs: ${err.message}`);
    } finally {
      setIsCancellingJobs(false);
    }
  };

  // Commit Object Print Method settings
  const commitPrintMethodSettings = (newSettings: ObjectPrintMethodSettings) => {
    setPrintMethodSettings(newSettings);
    if (newSettings.scope === 'global') {
      saveGlobalObjectPrintMethodSettings(newSettings);
      if (onUpdateTemplate && template.objectPrintMethodSettings) {
        const updated = { ...template };
        delete updated.objectPrintMethodSettings;
        onUpdateTemplate(updated);
      }
    } else {
      if (onUpdateTemplate) {
        onUpdateTemplate({
          ...template,
          objectPrintMethodSettings: newSettings,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  // Test Print
  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    setTestPrintSuccess(null);
    try {
      const sampleRecord = recordsToPrint[0] || recordData;
      const testRes = await PrinterService.getInstance().executeTestPrint(
        template,
        selectedPrinter,
        sampleRecord,
        {
          dpi: effectiveDpi || undefined,
          rendererOverride:
            outputFormat === 'tspl'
              ? 'TSPL'
              : outputFormat === 'zpl'
              ? 'ZPL'
              : outputFormat === 'epl'
              ? 'EPL'
              : outputFormat === 'cpcl'
              ? 'CPCL'
              : outputFormat === 'sbpl'
              ? 'SBPL'
              : 'WINDOWS_DRIVER',
        }
      );

      if (!testRes.success) {
        alert(`Test print failed: ${testRes.error || testRes.message || 'Printer not found.'}`);
        return;
      }

      setTestPrintSuccess(`Test print sent to "${selectedPrinter.name}"`);
      setTimeout(() => setTestPrintSuccess(null), 3500);
    } catch (err: any) {
      alert(`Test print failed: ${err.message}`);
    } finally {
      setIsTestingPrint(false);
    }
  };

  // Preview Button Handler
  const handleOpenPreview = () => {
    // Commit print method settings before preview
    commitPrintMethodSettings(printMethodSettings);

    if (onOpenPrintPreview) {
      onOpenPrintPreview({
        printer: selectedPrinter,
        effectiveDpi,
        recordsToPrint,
        copies,
        quantitySource,
        selectedQtyColumn: quantitySource === 'database_field' ? selectedQtyColumn : undefined,
        serializedLabels,
        startingSlot,
      });
      onClose();
    }
  };

  // Main Print Execution
  const handleExecutePrint = async () => {
    if (!validationResult.isValid) return;

    // 1. Commit print method settings
    commitPrintMethodSettings(printMethodSettings);

    // 2. Pre-job Queue Cancellation if checked
    if (cancelQueuedJobsBeforePrint && selectedPrinter) {
      try {
        if (window.barcodeFlow?.printers?.cancelQueuedJobs) {
          await window.barcodeFlow.printers.cancelQueuedJobs(selectedPrinter.systemName || selectedPrinter.name);
        } else {
          await fetch(`http://localhost:3001/api/printers/${selectedPrinter.id}/cancel-jobs`, { method: 'POST' });
        }
      } catch (e) {
        console.warn('[PrintCenter] Pre-job queue cancel failed:', e);
      }
    }

    setIsSubmitting(true);
    try {
      // Build deterministic print plan
      const plan = createPrintPlan(template, {
        printer: selectedPrinter,
        copies,
        recordsToPrint,
        quantitySource,
        selectedQtyColumn: quantitySource === 'database_field' ? selectedQtyColumn : undefined,
        serializedLabels,
        startingSlot,
        effectiveDpi,
      });

      const dispatchedRecords = plan.items.map((it) => it.record);

      // Render raw code if thermal or printToFile
      let generatedRawCode = '';
      if (outputFormat === 'tspl') {
        generatedRawCode = renderTSPL(template, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi || undefined });
      } else if (outputFormat === 'epl') {
        generatedRawCode = dispatchedRecords.map((r) => generateEPL(template, r as any)).join('\n');
      } else if (outputFormat === 'cpcl') {
        generatedRawCode = renderCPCL(template, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi || undefined });
      } else if (outputFormat === 'sbpl') {
        generatedRawCode = renderSBPL(template, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi || undefined });
      } else if (outputFormat === 'zpl') {
        generatedRawCode = renderZPL(template, dispatchedRecords as any, { copies: 1, dpi: effectiveDpi || undefined });
      }

      // Apply Printer Code Modifier if active
      if (enableCodeModifier && codeModifierConfig.enabled && generatedRawCode) {
        let modified = generatedRawCode;
        if (codeModifierConfig.rules && codeModifierConfig.rules.length > 0) {
          codeModifierConfig.rules.forEach((rule) => {
            if (rule.find) {
              modified = modified.split(rule.find).join(rule.replace || '');
            }
          });
        }
        if (codeModifierConfig.prefix) {
          modified = `${codeModifierConfig.prefix}\n${modified}`;
        }
        if (codeModifierConfig.suffix) {
          modified = `${modified}\n${codeModifierConfig.suffix}`;
        }
        generatedRawCode = modified;
      }

      // Handle "Print to file" (PRN / ZPL / TSPL download)
      if (printToFile && generatedRawCode) {
        const blob = new Blob([generatedRawCode], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(template.name || 'Document1').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${outputFormat === 'zpl' ? 'zpl' : outputFormat === 'tspl' ? 'txt' : 'prn'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      if (outputFormat === 'pdf') {
        await exportLabelsToPDF(template, dispatchedRecords);
      }

      const hardwareDispatchResult = await PrinterService.getInstance().dispatchPrintJob({
        template,
        printer: selectedPrinter,
        records: dispatchedRecords,
        copies: 1,
        darkness,
        speed: printSpeed,
        dpi: effectiveDpi || undefined,
        rendererOverride:
          outputFormat === 'tspl'
            ? 'TSPL'
            : outputFormat === 'zpl'
            ? 'ZPL'
            : outputFormat === 'epl'
            ? 'EPL'
            : outputFormat === 'cpcl'
            ? 'CPCL'
            : outputFormat === 'sbpl'
            ? 'SBPL'
            : 'WINDOWS_DRIVER',
      });

      if (!hardwareDispatchResult.success) {
        setIsSubmitting(false);
        alert(`Print execution error: ${hardwareDispatchResult.error || hardwareDispatchResult.message || 'Spooler failed.'}`);
        return;
      }

      // Advance serial sequence counters on template elements upon confirmed print dispatch
      if (onUpdateTemplate) {
        const advancedTemplate = advanceTemplateSerialState(template, dispatchedRecords.length);
        onUpdateTemplate(advancedTemplate);
      }

      const spooler = EnterprisePrintSpooler.getInstance();
      const dispatchedJob = spooler.dispatchJob({
        template,
        printer: {
          id: selectedPrinter.id,
          name: selectedPrinter.name,
          model: selectedPrinter.model || selectedPrinter.name,
          brand: (selectedPrinter.manufacturer?.includes('Zebra') ? 'Zebra' : selectedPrinter.manufacturer?.includes('TSC') ? 'TSC' : 'Desktop PDF') as any,
          dpi: (selectedPrinter.dpi || 300) as any,
          ipAddress: selectedPrinter.portName || selectedPrinter.port || '127.0.0.1',
          port: 9100,
          status: 'online',
          protocol: outputFormat as any,
          location: 'Local Windows Spooler',
          mediaWidth: template.dimensions.width,
          mediaHeight: template.dimensions.height,
        },
        copies: 1,
        records: dispatchedRecords as any,
        format: outputFormat,
        submittedBy: 'Operator (BarcodeFlow Suite)',
        darkness,
        speed: printSpeed,
      });

      dispatchedJob.dataSnapshot = recordsToPrint.map((r) => ({ ...r }));
      dispatchedJob.printMode = recordSelectionMode;
      dispatchedJob.quantityColumn = quantitySource === 'database_field' ? selectedQtyColumn : undefined;
      dispatchedJob.totalLabelsPrinted = dispatchedRecords.length;
      dispatchedJob.datasetName = template.databaseConnection?.name;
      dispatchedJob.excelFilePath = template.databaseConnection?.filePath;
      dispatchedJob.excelSheetName = template.databaseConnection?.sheetName;
      dispatchedJob.status = 'completed';

      onJobSubmitted(dispatchedJob);

      // Check if Show Printer Code modal should be displayed
      if (showPrinterCodeAtEnd && generatedRawCode) {
        setGeneratedCodePayload({
          isOpen: true,
          code: generatedRawCode,
          format: outputFormat.toUpperCase(),
        });
      }

      setJobSuccess(`Dispatched ${dispatchedRecords.length} label(s) to "${selectedPrinter.name}" successfully.`);

      if (!showPrinterCodeAtEnd && !repeatDataEntry) {
        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
          setJobSuccess(null);
        }, 1200);
      } else {
        setIsSubmitting(false);
        setTimeout(() => setJobSuccess(null), 3500);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      alert(`Print execution error: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const docTitleName = template.name ? (template.name.endsWith('.btw') || template.name.endsWith('.bfl') ? template.name : `${template.name}.btw`) : 'Document1.btw';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none font-sans text-xs">
      {/* CLASSIC WINDOWS DESKTOP PRINT DIALOG (Matching Reference Layout) */}
      <div className="w-[600px] max-w-[95vw] bg-[#f4f7fb] border border-[#7d9ebc] rounded-md shadow-2xl overflow-hidden flex flex-col text-slate-800">
        {/* Title Bar */}
        <div className="h-7 bg-gradient-to-r from-[#e8edf5] to-[#d8e3f0] border-b border-[#b8c9db] flex items-center justify-between px-3 shrink-0">
          <span className="font-semibold text-slate-800 text-[12px] truncate">
            Print [{docTitleName}]
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-red-600 hover:text-white rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Top Tabs */}
        <div className="flex items-center px-3 pt-2 bg-[#f4f7fb] border-b border-[#cbdbe9] gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTopTab('print')}
            className={`px-4 py-1 rounded-t border-t border-l border-r font-medium text-[11.5px] cursor-pointer transition-colors -mb-px ${
              activeTopTab === 'print'
                ? 'bg-white border-[#b8c9db] text-slate-900 font-semibold shadow-2xs'
                : 'bg-[#e4ebf5] border-transparent text-slate-600 hover:bg-[#ebf1f8]'
            }`}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => setActiveTopTab('objectPrintMethod')}
            className={`px-3 py-1 rounded-t border-t border-l border-r font-medium text-[11.5px] cursor-pointer transition-colors -mb-px ${
              activeTopTab === 'objectPrintMethod'
                ? 'bg-white border-[#b8c9db] text-slate-900 font-semibold shadow-2xs'
                : 'bg-[#e4ebf5] border-transparent text-slate-600 hover:bg-[#ebf1f8]'
            }`}
          >
            Object Print Method
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-3 bg-white space-y-3 flex-1 overflow-y-auto overflow-x-hidden min-h-[380px]">
          {activeTopTab === 'print' ? (
            <>
              {/* 1. PRINTER FIELDSET GROUP */}
              <fieldset className="border border-[#c5d4e4] rounded p-3 pt-1.5 bg-[#fafcff]">
                <legend className="px-1 text-[11px] font-semibold text-slate-700">
                  Printer
                </legend>

                <div className="flex items-start justify-between gap-3">
                  {/* Left: Printer details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Name Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="w-16 text-right text-slate-700 font-medium shrink-0">
                        Name:
                      </label>
                      <select
                        value={selectedPrinterId}
                        onChange={(e) => {
                          setSelectedPrinterId(e.target.value);
                          const p = displayPrinters.find((x) => x.id === e.target.value);
                          if (p) {
                            setActivePrinter(p);
                            if (p.nativeLanguages?.includes('TSPL')) setOutputFormat('tspl');
                            else if (p.nativeLanguages?.includes('ZPL')) setOutputFormat('zpl');
                            else if (p.nativeLanguages?.includes('EPL')) setOutputFormat('epl');
                            else if (p.nativeLanguages?.includes('CPCL')) setOutputFormat('cpcl');
                            else if (p.nativeLanguages?.includes('SBPL')) setOutputFormat('sbpl');
                            else setOutputFormat('pdf');
                          }
                        }}
                        className="flex-1 min-w-0 px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11.5px] text-slate-900 focus:outline-blue-500 font-medium truncate"
                      >
                        {displayPrinters.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.isDefault ? `Default (currently ${p.name})` : p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Status:
                      </span>
                      <span className="text-slate-800 font-medium">
                        {String(selectedPrinter.status).toUpperCase() === 'READY' || String(selectedPrinter.status).toLowerCase() === 'online'
                          ? 'Ready'
                          : String(selectedPrinter.status || 'Ready')}
                      </span>
                    </div>

                    {/* Model */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Model:
                      </span>
                      <span className="text-slate-800 font-medium truncate">
                        {selectedPrinter.driverName || selectedPrinter.model || selectedPrinter.name}
                      </span>
                    </div>

                    {/* Port */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Port:
                      </span>
                      <span className="text-slate-800 font-mono text-[11px] truncate">
                        {selectedPrinter.portName || selectedPrinter.port || 'PORTPROMPT:'}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Location:
                      </span>
                      <span className="text-slate-800 truncate">
                        {(selectedPrinter as any).location || ''}
                      </span>
                    </div>

                    {/* Comment */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-slate-500 font-medium shrink-0">
                        Comment:
                      </span>
                      <span className="text-slate-800 truncate">
                        {(selectedPrinter as any).comment || ''}
                      </span>
                    </div>
                  </div>

                  {/* Right: Buttons and Checkboxes */}
                  <div className="w-[170px] flex flex-col gap-1.5 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsPageSetupModalOpen(true)}
                      className="w-full px-2.5 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
                    >
                      Document Properties...
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (selectedPrinter && window.barcodeFlow?.printers?.openProperties) {
                          const res = await window.barcodeFlow.printers.openProperties(
                            selectedPrinter.systemName || selectedPrinter.name
                          );
                          if (!res?.success) {
                            setIsPrinterPropertiesModalOpen(true);
                          }
                        } else {
                          setIsPrinterPropertiesModalOpen(true);
                        }
                      }}
                      className="w-full px-2.5 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
                    >
                      Printer Properties...
                    </button>

                    <div className="pt-1.5 space-y-1 text-[11px] text-slate-700">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printOnBothSides}
                          onChange={(e) => setPrintOnBothSides(e.target.checked)}
                          disabled={!selectedPrinter.capabilities?.duplex}
                          className="rounded border-[#a4bed8] text-blue-600 disabled:opacity-40"
                        />
                        <span className={!selectedPrinter.capabilities?.duplex ? 'text-slate-400' : ''}>
                          Print on Both Sides
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printToFile}
                          onChange={(e) => setPrintToFile(e.target.checked)}
                          className="rounded border-[#a4bed8] text-blue-600"
                        />
                        <span>Print to File</span>
                      </label>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* 2. SUB-TABS: QUANTITY & OPTIONS */}
              <div className="border border-[#c5d4e4] rounded bg-[#fafcff] overflow-hidden">
                {/* Sub Tab Headers */}
                <div className="flex items-center px-2 pt-1 bg-[#edf3f9] border-b border-[#cbdbe9] gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('quantity')}
                    className={`px-3 py-0.5 rounded-t border-t border-l border-r text-[11px] cursor-pointer transition-colors -mb-px ${
                      activeSubTab === 'quantity'
                        ? 'bg-white border-[#c5d4e4] text-slate-900 font-bold shadow-2xs'
                        : 'bg-[#e0eaf5] border-transparent text-slate-600 hover:bg-[#eaf0f8]'
                    }`}
                  >
                    Quantity
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('options')}
                    className={`px-3 py-0.5 rounded-t border-t border-l border-r text-[11px] cursor-pointer transition-colors -mb-px ${
                      activeSubTab === 'options'
                        ? 'bg-white border-[#c5d4e4] text-slate-900 font-bold shadow-2xs'
                        : 'bg-[#e0eaf5] border-transparent text-slate-600 hover:bg-[#eaf0f8]'
                    }`}
                  >
                    Options
                  </button>
                </div>

                {/* Sub Tab Content */}
                <div className="p-3 bg-white space-y-3">
                  {activeSubTab === 'quantity' ? (
                    <>
                      {/* Copies Stepper */}
                      <div className="flex items-center gap-3">
                        <label className="text-slate-700 font-medium">
                          Copies:
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={9999}
                            value={copies}
                            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-20 px-2 py-0.5 bg-white border border-[#a4bed8] rounded text-slate-900 font-bold text-center focus:outline-blue-500"
                          />
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => setCopies((c) => c + 1)}
                              className="px-1 py-0.2 bg-[#e8edf5] hover:bg-[#d8e3f0] border border-[#a4bed8] rounded text-[8px] font-bold"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => setCopies((c) => Math.max(1, c - 1))}
                              className="px-1 py-0.2 bg-[#e8edf5] hover:bg-[#d8e3f0] border border-[#a4bed8] rounded text-[8px] font-bold"
                            >
                              ▼
                            </button>
                          </div>
                        </div>

                        {/* Quantity Source Toggle */}
                        {template.databaseConnection?.quantityColumn && (
                          <div className="flex items-center gap-1.5 ml-4">
                            <input
                              type="checkbox"
                              id="useQtyCol"
                              checked={quantitySource === 'database_field'}
                              onChange={(e) => setQuantitySource(e.target.checked ? 'database_field' : 'manual')}
                              className="rounded border-[#a4bed8] text-blue-600"
                            />
                            <label htmlFor="useQtyCol" className="text-[11px] text-slate-700 cursor-pointer">
                              From Column ({selectedQtyColumn})
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Record Selection Group */}
                      <div className="pt-1">
                        <div className="relative flex py-1.5 items-center">
                          <div className="flex-grow border-t border-[#cbdbe9]"></div>
                          <span className="flex-shrink mx-2 text-[11px] font-semibold text-slate-600">
                            Record Selection
                          </span>
                          <div className="flex-grow border-t border-[#cbdbe9]"></div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={useDatabaseConnection}
                              onChange={(e) => setUseDatabaseConnection(e.target.checked)}
                              disabled={!hasDatabaseConnection}
                              className="rounded border-[#a4bed8] text-blue-600 disabled:opacity-40"
                            />
                            <span className={!hasDatabaseConnection ? 'text-slate-400 font-medium' : 'font-medium text-slate-800'}>
                              Use Database
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenDatabaseSetup) {
                                onOpenDatabaseSetup();
                              }
                            }}
                            className="px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11px] font-medium shadow-2xs transition-colors cursor-pointer"
                          >
                            Database Connection Setup...
                          </button>
                        </div>

                        {/* Database records summary and filtering */}
                        {useDatabaseConnection && hasDatabaseConnection && (
                          <div className="mt-2.5 p-2 bg-[#f4f8fc] border border-[#d2e0ee] rounded flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-700">Records:</span>
                              <select
                                value={recordSelectionMode}
                                onChange={(e) => setRecordSelectionMode(e.target.value as any)}
                                className="px-2 py-0.5 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                              >
                                <option value="all">All Records ({allRecords.length})</option>
                                <option value="current">Current Record (#{activeRecordIndex + 1})</option>
                                <option value="selected">Selected Records ({selectedIndices.length})</option>
                                <option value="range">Range: {rangeString || 'All'}</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsRecordSelectionModalOpen(true)}
                              className="px-2.5 py-0.5 bg-white hover:bg-slate-50 border border-[#a4bed8] rounded text-blue-700 font-semibold"
                            >
                              Select Records...
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Options Tab (Rebuilt with Reference Workflow) */
                    <div className="space-y-3 text-[11.5px] text-slate-800">
                      {/* Job & Data Entry Checkboxes */}
                      <div className="space-y-1.5 pb-2 border-b border-[#e2edf8]">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={repeatDataEntry}
                            onChange={(e) => setRepeatDataEntry(e.target.checked)}
                            className="rounded border-[#a4bed8] text-blue-600"
                          />
                          <span>Repeat data entry until cancelled</span>
                        </label>

                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cancelQueuedJobsBeforePrint}
                              onChange={(e) => setCancelQueuedJobsBeforePrint(e.target.checked)}
                              className="rounded border-[#a4bed8] text-blue-600"
                            />
                            <span>Cancel any jobs previously queued to this printer</span>
                          </label>
                          <button
                            type="button"
                            onClick={handlePurgePrinterQueue}
                            disabled={isCancellingJobs}
                            className="px-2 py-0.5 bg-[#fef2f2] hover:bg-[#fee2e2] text-red-700 border border-red-200 rounded text-[10.5px] font-medium cursor-pointer"
                          >
                            {isCancellingJobs ? 'Purging...' : 'Purge Queue Now'}
                          </button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableDataEntry}
                            onChange={(e) => setEnableDataEntry(e.target.checked)}
                            className="rounded border-[#a4bed8] text-blue-600"
                          />
                          <span>Enable data entry</span>
                        </label>

                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enableCodeModifier}
                              onChange={(e) => {
                                setEnableCodeModifier(e.target.checked);
                                setCodeModifierConfig((prev) => ({ ...prev, enabled: e.target.checked }));
                              }}
                              className="rounded border-[#a4bed8] text-blue-600"
                            />
                            <span>Enable Printer Code Modifier</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsCodeModifierModalOpen(true)}
                            className="px-2 py-0.5 bg-[#f0f5fc] hover:bg-[#e2eefb] text-blue-700 border border-[#a4bed8] rounded text-[10.5px] font-medium cursor-pointer"
                          >
                            Configure Modifier...
                          </button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showPrinterCodeAtEnd}
                            onChange={(e) => setShowPrinterCodeAtEnd(e.target.checked)}
                            disabled={outputFormat === 'pdf'}
                            className="rounded border-[#a4bed8] text-blue-600 disabled:opacity-40"
                          />
                          <span className={outputFormat === 'pdf' ? 'text-slate-400' : ''}>
                            Show printer code at end of print job {outputFormat === 'pdf' ? '(ZPL/TSPL Only)' : ''}
                          </span>
                        </label>
                      </div>

                      {/* Advanced Printer Settings Section */}
                      <fieldset className="border border-[#d2e0ee] rounded p-2.5 pt-1 bg-[#f9fbfe] space-y-2">
                        <legend className="px-1 text-[11px] font-semibold text-slate-700">
                          Advanced Printer Settings
                        </legend>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-slate-600">Starting Slot:</span>
                            <input
                              type="number"
                              min={1}
                              max={template.sheetGrid ? (template.sheetGrid.rows || 1) * (template.sheetGrid.columns || 1) : 1}
                              value={startingSlot}
                              onChange={(e) => setStartingSlot(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="w-16 px-1.5 py-0.5 bg-white border border-[#a4bed8] rounded text-center text-slate-900 font-bold"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-slate-600">Output Protocol:</span>
                            <select
                              value={outputFormat}
                              onChange={(e) => setOutputFormat(e.target.value as any)}
                              className="px-1.5 py-0.5 bg-white border border-[#a4bed8] rounded font-medium text-[10.5px]"
                            >
                              <option value="pdf">Windows Driver / High-Res PDF</option>
                              <option value="zpl">Zebra ZPL (Direct Thermal/TT)</option>
                              <option value="tspl">TSC TSPL (Direct Thermal/TT)</option>
                              <option value="epl">Eltron EPL</option>
                              <option value="cpcl">CPCL Mobile</option>
                              <option value="sbpl">SATO SBPL</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-medium ${!isSpeedSupported ? 'text-slate-400' : 'text-slate-600'}`}>
                              Print Speed:
                            </span>
                            <select
                              value={printSpeed}
                              onChange={(e) => setPrintSpeed(parseInt(e.target.value, 10))}
                              disabled={!isSpeedSupported}
                              className="px-1.5 py-0.5 bg-white border border-[#a4bed8] rounded disabled:opacity-40 text-[10.5px]"
                            >
                              <option value={2}>2 ips (High Quality)</option>
                              <option value={4}>4 ips (Standard)</option>
                              <option value={6}>6 ips (High Speed)</option>
                              <option value={8}>8 ips (Draft)</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-medium ${!isDarknessSupported ? 'text-slate-400' : 'text-slate-600'}`}>
                              Darkness (Heat):
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={darkness}
                              onChange={(e) => setDarkness(parseInt(e.target.value, 10) || 18)}
                              disabled={!isDarknessSupported}
                              className="w-16 px-1.5 py-0.5 bg-white border border-[#a4bed8] rounded text-center disabled:opacity-40"
                            />
                          </div>
                        </div>
                      </fieldset>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: OBJECT PRINT METHOD (Fully functional desktop configuration layout) */
            <div className="space-y-3.5">
              {/* Settings Scope Radio Group */}
              <fieldset className="border border-[#c5d4e4] rounded p-3 pt-1.5 bg-[#fafcff]">
                <legend className="px-1 text-[11px] font-semibold text-slate-700">
                  Settings
                </legend>
                <div className="flex items-center gap-6 text-[11.5px]">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="settingsScope"
                      value="global"
                      checked={printMethodSettings.scope === 'global'}
                      onChange={() =>
                        setPrintMethodSettings((prev) => ({ ...prev, scope: 'global' }))
                      }
                      className="text-blue-600"
                    />
                    <span>Use Settings For All Documents</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="settingsScope"
                      value="document"
                      checked={printMethodSettings.scope === 'document'}
                      onChange={() =>
                        setPrintMethodSettings((prev) => ({ ...prev, scope: 'document' }))
                      }
                      className="text-blue-600"
                    />
                    <span>Use Settings For This Document Only</span>
                  </label>
                </div>
              </fieldset>

              {/* Objects Configuration Group */}
              <fieldset className="border border-[#c5d4e4] rounded p-3 pt-2 bg-white">
                <legend className="px-1 text-[11px] font-semibold text-slate-700">
                  Objects
                </legend>

                <div className="space-y-2.5 text-[11.5px]">
                  {/* TrueType Text */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      TrueType Text:
                    </label>
                    <select
                      value={printMethodSettings.trueTypeText}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          trueTypeText: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="text-output">Text Output</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Unsupported 1D Barcodes */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Unsupported 1D Barcodes:
                    </label>
                    <select
                      value={printMethodSettings.unsupported1D}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          unsupported1D: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Unsupported 2D Barcodes */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Unsupported 2D Barcodes:
                    </label>
                    <select
                      value={printMethodSettings.unsupported2D}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          unsupported2D: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Lines */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Lines:
                    </label>
                    <select
                      value={printMethodSettings.lines}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          lines: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Boxes */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Boxes:
                    </label>
                    <select
                      value={printMethodSettings.boxes}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          boxes: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>

                  {/* Ellipses */}
                  <div className="flex items-center justify-between">
                    <label className="w-52 text-slate-700 font-medium">
                      Ellipses:
                    </label>
                    <select
                      value={printMethodSettings.ellipses}
                      onChange={(e) =>
                        setPrintMethodSettings((prev) => ({
                          ...prev,
                          ellipses: e.target.value as any,
                        }))
                      }
                      className="flex-1 max-w-[260px] px-2 py-1 bg-white border border-[#a4bed8] rounded text-[11px] font-medium"
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Printer Native</option>
                      <option value="vector">Vector</option>
                      <option value="raster">Raster</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Capability status footer */}
              <div className="p-2 bg-[#f4f8fc] border border-[#d2e0ee] rounded flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Active Printer: <strong className="text-slate-800">{selectedPrinter.name}</strong> ({selectedPrinter.dpi || 300} DPI)
                </span>
                <span className="text-blue-700 font-medium">
                  Pipeline: {outputFormat.toUpperCase()} / {selectedPrinter.connectionType || 'Windows Driver'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. BOTTOM BUTTONS BAR ([Test Print] [Print] [Preview] [Close] [Cancel] [Help]) */}
        <div className="h-11 bg-[#f4f7fb] border-t border-[#cbdbe9] px-3 flex items-center justify-between shrink-0">
          {/* Left button: Test Print */}
          <div>
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTestingPrint}
              className="min-w-[75px] px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              {isTestingPrint ? 'Testing...' : 'Test Print'}
            </button>
          </div>

          {/* Right buttons: [Print] [Preview] [Close] [Cancel] [Help] */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExecutePrint}
              disabled={isSubmitting || !validationResult.isValid}
              className="min-w-[65px] px-4 py-1 bg-[#1973e8] hover:bg-[#1557b0] text-white border border-[#1350a2] rounded text-[11.5px] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-40 text-center"
            >
              {isSubmitting ? 'Printing...' : 'Print'}
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              className="min-w-[65px] px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              Preview
            </button>

            <button
              type="button"
              onClick={() => {
                commitPrintMethodSettings(printMethodSettings);
                onClose();
              }}
              className="min-w-[60px] px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              Close
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[60px] px-3 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="min-w-[50px] px-2.5 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer text-center"
            >
              Help
            </button>
          </div>
        </div>
      </div>

      {/* Sub Modals */}
      <RecordSelectionModal
        isOpen={isRecordSelectionModalOpen}
        onClose={() => setIsRecordSelectionModalOpen(false)}
        allRecords={allRecords}
        columns={availableColumns}
        initialSelectedIndices={selectedIndices}
        datasetName={template.databaseConnection?.name}
        quantityColumn={quantitySource === 'database_field' ? selectedQtyColumn : undefined}
        onApplySelection={(newIndices, newRangeStr) => {
          setSelectedIndices(newIndices);
          setRangeString(newRangeStr);
          setRecordSelectionMode(newIndices.length === allRecords.length ? 'all' : 'selected');
        }}
      />

      {selectedPrinter && (
        <PrinterPropertiesModal
          isOpen={isPrinterPropertiesModalOpen}
          onClose={() => setIsPrinterPropertiesModalOpen(false)}
          printer={selectedPrinter as any}
          darkness={darkness}
          printSpeed={printSpeed}
          mediaType={mediaType}
          onSaveProperties={(props) => {
            setDarkness(props.darkness);
            setPrintSpeed(props.speed);
            setMediaType(props.mediaType);
          }}
        />
      )}

      {isPageSetupModalOpen && (
        <PageSetupModal
          isOpen={isPageSetupModalOpen}
          onClose={() => setIsPageSetupModalOpen(false)}
          template={template}
          onApplyPageSetup={(updates) => {
            const updatedTmpl: LabelTemplate = {
              ...template,
              dimensions: {
                ...template.dimensions,
                ...updates.dimensions,
              },
              margins: {
                ...template.margins,
                ...updates.margins,
              },
              sheetGrid: updates.sheetGrid
                ? {
                    ...template.sheetGrid,
                    ...updates.sheetGrid,
                  }
                : template.sheetGrid,
              shape: updates.shape || template.shape,
              cornerRadius:
                updates.cornerRadius !== undefined
                  ? updates.cornerRadius
                  : template.cornerRadius,
              mediaType: updates.mediaType || template.mediaType,
              updatedAt: new Date().toISOString(),
            };
            onUpdateTemplate?.(updatedTmpl);
            setIsPageSetupModalOpen(false);
          }}
        />
      )}

      {/* Printer Code Modifier Configuration Modal */}
      <PrinterCodeModifierModal
        isOpen={isCodeModifierModalOpen}
        onClose={() => setIsCodeModifierModalOpen(false)}
        config={codeModifierConfig}
        onSaveConfig={(newConfig) => {
          setCodeModifierConfig(newConfig);
          setEnableCodeModifier(newConfig.enabled);
        }}
      />

      {/* Show Printer Code Modal */}
      <ShowPrinterCodeModal
        isOpen={generatedCodePayload.isOpen}
        onClose={() => setGeneratedCodePayload((prev) => ({ ...prev, isOpen: false }))}
        rawCode={generatedCodePayload.code}
        format={generatedCodePayload.format}
        printerName={selectedPrinter.name}
      />

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[440px] bg-white border border-[#7d9ebc] rounded shadow-2xl p-4 space-y-3 text-slate-800">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-800 text-sm">Printing Help & Instructions</h3>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p><strong>Printer:</strong> Select installed Windows printers or direct thermal network endpoints.</p>
              <p><strong>Object Print Method:</strong> Configure vector, raster, or native thermal output streams for text, barcodes, and shapes.</p>
              <p><strong>Job Options:</strong> Enable automatic data entry repetition, queue purge, and native code viewer.</p>
              <p><strong>Preview:</strong> Preview output before spooling. Content outside label boundaries is strictly clipped.</p>
            </div>
            <div className="text-right pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-1 bg-blue-600 text-white rounded font-medium text-xs hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
