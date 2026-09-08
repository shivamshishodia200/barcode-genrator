import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ExcelDataSourceMode, ExcelColumnDefinition, DatabaseConnectionConfig } from '../../types';
import { excelService } from '../../services/excelService';
import { apiService } from '../../services/apiService';
import {
  FileSpreadsheet,
  Link2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Hash,
  Type,
  Calendar,
  Layers,
  Database,
  Check,
  FolderOpen,
  Info,
  XCircle,
} from 'lucide-react';

interface ExcelConnectWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: {
    mode: ExcelDataSourceMode;
    datasetName: string;
    filePath?: string;
    sheetName: string;
    headerRow: number;
    columns: ExcelColumnDefinition[];
    records: Record<string, any>[];
    autoRefresh: boolean;
    quantityColumn?: string;
    base64Content?: string;
  }) => Promise<void> | void;
  initialMode?: ExcelDataSourceMode;
  editConfig?: DatabaseConnectionConfig | null;
}

export const ExcelConnectWizardModal: React.FC<ExcelConnectWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialMode = 'linked',
  editConfig = null,
}) => {
  // Wizard state: 5 Standard BarTender Steps
  // 1: Select Excel File & Test Connection
  // 2: Select Worksheet
  // 3: Review Fields & Preview Data
  // 4: Connection Options
  // 5: Finish & Connect
  const [step, setStep] = useState<number>(1);
  const [mode, setMode] = useState<ExcelDataSourceMode>(initialMode || 'linked');
  const [datasetName, setDatasetName] = useState<string>('Products Excel');

  // File state
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [lastModified, setLastModified] = useState<string>('');
  const [rawFile, setRawFile] = useState<File | null>(null);

  // Connection options
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshOnOpen, setRefreshOnOpen] = useState<boolean>(true);
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [quantityColumn, setQuantityColumn] = useState<string>('');

  // Diagnostic Test Connection state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    sheetCount?: number;
    sheets?: string[];
    selectedSheet?: string;
    totalRecords?: number;
    lastModified?: string;
    sizeBytes?: number;
    error?: string;
    errorCode?: string;
    pathChecked?: string;
  } | null>(null);

  // Worksheet state
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Preview & Fields state
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [allExtractedRows, setAllExtractedRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<ExcelColumnDefinition[]>([]);
  const [totalRecordsCount, setTotalRecordsCount] = useState<number>(0);

  // Finish saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editConfig) {
        setStep(1);
        setMode(editConfig.mode || 'linked');
        setDatasetName(editConfig.name || 'Products Excel');
        setFilePath(editConfig.filePath || editConfig.endpointOrPath || '');
        setFileName(editConfig.fileName || (editConfig.filePath ? editConfig.filePath.split(/[/\\]/).pop() || '' : ''));
        setSelectedSheet(editConfig.sheetName || '');
        setHeaderRow(editConfig.headerRow || 1);
        setAutoRefresh(editConfig.autoRefresh ?? true);
        setQuantityColumn(editConfig.quantityColumn || '');
        if (editConfig.columns) {
          setColumns(editConfig.columns);
        }
      } else {
        setStep(1);
        setMode('linked');
        setDatasetName('Products Excel');
        setFilePath('');
        setFileName('');
        setFileSize(0);
        setRawFile(null);
        setAvailableSheets([]);
        setSelectedSheet('');
        setHeaderRow(1);
        setTestResult(null);
        setPreviewRows([]);
        setAllExtractedRows([]);
        setColumns([]);
        setAutoRefresh(true);
        setRefreshOnOpen(true);
        setQuantityColumn('');
        setInspectError(null);
      }
    }
  }, [isOpen, editConfig]);

  // Convert File to Base64 for web browser uploads
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Execute diagnostic connection test (Step 1)
  const runTestConnection = async (targetPath: string, targetSheet?: string): Promise<boolean> => {
    setIsTesting(true);
    setTestResult(null);
    setInspectError(null);

    const pathToCheck = targetPath.trim();
    if (!pathToCheck && !rawFile) {
      setTestResult({
        success: false,
        error: 'Please specify an Excel file path first.',
      });
      setIsTesting(false);
      return false;
    }

    try {
      const electronAPI = (window as any).electronAPI;
      let res: any = null;

      // 1. If running in Electron with absolute path, use native Electron IPC
      if (electronAPI?.testExcelConnection && (pathToCheck.includes(':') || pathToCheck.startsWith('/') || pathToCheck.startsWith('\\\\'))) {
        res = await electronAPI.testExcelConnection(pathToCheck, targetSheet);
      } else {
        // 2. Prepare payload for Express backend: include base64Content if in browser mode with rawFile
        let base64Content: string | undefined = undefined;
        if (rawFile) {
          try {
            base64Content = await fileToBase64(rawFile);
          } catch (e) {
            console.warn('Could not encode file as base64:', e);
          }
        }

        res = await apiService.datasets.testConnection({
          filePath: pathToCheck,
          sheetName: targetSheet,
          base64Content,
          fileName: rawFile?.name || fileName || pathToCheck.split(/[/\\]/).pop(),
        });
      }

      if (res && res.success) {
        const sheetsList = res.sheets || [];
        setAvailableSheets(sheetsList);
        const activeSheet = targetSheet && sheetsList.includes(targetSheet)
          ? targetSheet
          : sheetsList[0] || 'Sheet1';
        setSelectedSheet(activeSheet);
        setTotalRecordsCount(res.totalRecords || 0);
        if (res.lastModified) setLastModified(res.lastModified);
        if (res.sizeBytes) setFileSize(res.sizeBytes);
        if (res.filePath) setFilePath(res.filePath);

        // Derive clean dataset connection name from workbook filename
        const baseDocName = (res.fileName || pathToCheck.split(/[/\\]/).pop() || 'Products').replace(/\.[^/.]+$/, '');
        if (datasetName === 'Products Excel' || !datasetName) {
          setDatasetName(`${baseDocName} Excel`);
        }

        setTestResult({
          success: true,
          filePath: res.filePath || pathToCheck,
          fileName: res.fileName || pathToCheck.split(/[/\\]/).pop(),
          sheetCount: sheetsList.length,
          sheets: sheetsList,
          selectedSheet: activeSheet,
          totalRecords: res.totalRecords,
          lastModified: res.lastModified,
          sizeBytes: res.sizeBytes,
          pathChecked: res.pathChecked || res.filePath || pathToCheck,
        });
        setIsTesting(false);
        return true;
      }

      // 3. Client-side fallback if rawFile is available
      if (rawFile) {
        try {
          const inspected = await excelService.inspectExcelFile(rawFile, targetSheet);
          const sheetsList = inspected.sheets || ['Sheet1'];
          setAvailableSheets(sheetsList);
          const activeSheet = targetSheet && sheetsList.includes(targetSheet)
            ? targetSheet
            : inspected.defaultSheet || sheetsList[0];
          setSelectedSheet(activeSheet);

          const sheetData = await excelService.parseSheetData(rawFile, activeSheet, headerRow);
          setColumns(sheetData.columns);
          setPreviewRows(sheetData.previewRows);
          setAllExtractedRows(sheetData.allRows);
          setTotalRecordsCount(sheetData.allRows.length);

          const baseDocName = rawFile.name.replace(/\.[^/.]+$/, '');
          if (datasetName === 'Products Excel' || !datasetName) {
            setDatasetName(`${baseDocName} Excel`);
          }

          setTestResult({
            success: true,
            filePath: rawFile.name,
            fileName: rawFile.name,
            sheetCount: sheetsList.length,
            sheets: sheetsList,
            selectedSheet: activeSheet,
            totalRecords: sheetData.allRows.length,
            lastModified: new Date(rawFile.lastModified).toISOString(),
            sizeBytes: rawFile.size,
            pathChecked: rawFile.name,
          });
          setIsTesting(false);
          return true;
        } catch (parseErr: any) {
          console.warn('Client-side fallback parse failed:', parseErr);
        }
      }

      setTestResult({
        success: false,
        filePath: pathToCheck,
        errorCode: res?.errorCode || 'FILE_NOT_FOUND',
        error: res?.error || 'Connection failed: Unable to read workbook on disk.',
        pathChecked: res?.pathChecked || pathToCheck,
      });
      setIsTesting(false);
      return false;
    } catch (err: any) {
      if (rawFile) {
        try {
          const inspected = await excelService.inspectExcelFile(rawFile, targetSheet);
          const sheetsList = inspected.sheets || ['Sheet1'];
          setAvailableSheets(sheetsList);
          const activeSheet = targetSheet && sheetsList.includes(targetSheet)
            ? targetSheet
            : inspected.defaultSheet || sheetsList[0];
          setSelectedSheet(activeSheet);

          const sheetData = await excelService.parseSheetData(rawFile, activeSheet, headerRow);
          setColumns(sheetData.columns);
          setPreviewRows(sheetData.previewRows);
          setAllExtractedRows(sheetData.allRows);
          setTotalRecordsCount(sheetData.allRows.length);

          setTestResult({
            success: true,
            filePath: rawFile.name,
            fileName: rawFile.name,
            sheetCount: sheetsList.length,
            sheets: sheetsList,
            selectedSheet: activeSheet,
            totalRecords: sheetData.allRows.length,
            lastModified: new Date(rawFile.lastModified).toISOString(),
            sizeBytes: rawFile.size,
            pathChecked: rawFile.name,
          });
          setIsTesting(false);
          return true;
        } catch {}
      }

      setTestResult({
        success: false,
        filePath: pathToCheck,
        errorCode: 'UNEXPECTED_ERROR',
        error: err.message || 'Error occurred while testing Excel connection.',
        pathChecked: pathToCheck,
      });
      setIsTesting(false);
      return false;
    }
  };

  // Inspect & extract sheet contents for Step 3 review
  const inspectAndLoadSheetData = async (targetSheetName: string, targetHeaderRow: number) => {
    setIsInspecting(true);
    setInspectError(null);

    try {
      // 1. If rawFile is present, parse directly in memory
      if (rawFile) {
        const sheetData = await excelService.parseSheetData(rawFile, targetSheetName, targetHeaderRow);
        setColumns(sheetData.columns);
        setPreviewRows(sheetData.previewRows);
        setAllExtractedRows(sheetData.allRows);
        setTotalRecordsCount(sheetData.allRows.length);
        setIsInspecting(false);
        return;
      }

      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.readExcelWorkbook && filePath) {
        const res = await electronAPI.readExcelWorkbook(filePath, targetSheetName, targetHeaderRow);
        if (res.success) {
          const detectedCols: ExcelColumnDefinition[] = (res.columns || []).map((colName: string) => {
            const samples = (res.records || []).slice(0, 30).map((r: any) => r[colName]);
            const inferred = excelService.inferColumnType(samples);
            return {
              name: colName,
              originalName: colName,
              dataType: inferred,
            };
          });
          setColumns(detectedCols);
          setPreviewRows(res.previewRows || []);
          setAllExtractedRows(res.records || []);
          setTotalRecordsCount(res.totalRecords || 0);
          if (res.sheetNames) setAvailableSheets(res.sheetNames);
          setIsInspecting(false);
          return;
        }
      }

      // Backend API fallback
      if (filePath) {
        const res = await apiService.datasets.inspectExcel({
          filePath,
          sheetName: targetSheetName,
          headerRow: targetHeaderRow,
        });
        if (res.success) {
          const detectedCols: ExcelColumnDefinition[] = (res.columns || []).map((colName: string) => ({
            name: colName,
            dataType: 'text',
          }));
          setColumns(detectedCols);
          setPreviewRows(res.previewRows || []);
          setAllExtractedRows(res.previewRows || []);
          setTotalRecordsCount(res.totalRecords || 0);
          if (res.sheetNames) setAvailableSheets(res.sheetNames);
          setIsInspecting(false);
          return;
        }
      }

      if (rawFile) {
        const sheetData = await excelService.parseSheetData(rawFile, targetSheetName, targetHeaderRow);
        setColumns(sheetData.columns);
        setPreviewRows(sheetData.previewRows);
        setAllExtractedRows(sheetData.allRows);
        setTotalRecordsCount(sheetData.allRows.length);
      }
    } catch (err: any) {
      console.error('[ExcelWizard] Inspect sheet error:', err);
      setInspectError(err.message || 'Failed to parse sheet data.');
    } finally {
      setIsInspecting(false);
    }
  };

  // Electron native file browser
  const handleBrowseFile = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.selectExcelFile) {
      try {
        const res = await electronAPI.selectExcelFile();
        if (!res.canceled && res.filePath) {
          setFilePath(res.filePath);
          setFileName(res.fileName || res.filePath.split(/[/\\]/).pop() || 'Workbook.xlsx');
          setFileSize(res.sizeBytes || 0);
          setLastModified(res.lastModified || new Date().toISOString());
          setRawFile(null);
          setTestResult(null);

          const baseDocName = (res.fileName || res.filePath.split(/[/\\]/).pop() || 'Products').replace(/\.[^/.]+$/, '');
          setDatasetName(`${baseDocName} Excel`);

          // Automatically test connection upon selecting file
          await runTestConnection(res.filePath);
          return;
        }
      } catch (err) {
        console.warn('Native selectExcelFile failed, falling back to input:', err);
      }
    }
    // Fallback: Trigger hidden input in browser mode
    const input = document.getElementById('excel-file-input') as HTMLInputElement;
    input?.click();
  };

  // Re-locate missing or moved Excel file
  const handleLocateFile = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.locateExcelFile) {
      try {
        const res = await electronAPI.locateExcelFile(filePath);
        if (!res.canceled && res.filePath) {
          setFilePath(res.filePath);
          setFileName(res.fileName || res.filePath.split(/[/\\]/).pop() || 'Workbook.xlsx');
          setFileSize(res.sizeBytes || 0);
          setLastModified(res.lastModified || new Date().toISOString());
          setRawFile(null);
          setTestResult(null);
          await runTestConnection(res.filePath, selectedSheet);
          return;
        }
      } catch (err) {
        console.warn('Locate file failed:', err);
      }
    }
    handleBrowseFile();
  };

  // Web input file change fallback
  const handleWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setRawFile(file);
      setFileName(file.name);
      setFileSize(file.size);
      setLastModified(new Date(file.lastModified).toISOString());

      const nativePath = (file as any).path;
      if (nativePath && typeof nativePath === 'string' && nativePath.trim()) {
        setFilePath(nativePath);
      } else {
        setFilePath(file.name);
      }
      setTestResult(null);

      const baseDocName = file.name.replace(/\.[^/.]+$/, '');
      setDatasetName(`${baseDocName} Excel`);

      await runTestConnection(nativePath || file.name);
    }
  };

  // Step advancement handler (1 -> 2 -> 3 -> 4 -> 5)
  const handleNextStep = async () => {
    if (step === 1) {
      // Validate file and ensure test passed or run it
      if (!testResult?.success) {
        const ok = await runTestConnection(filePath, selectedSheet);
        if (!ok) return;
      }
      setStep(2);
    } else if (step === 2) {
      // Worksheet selected -> proceed to Step 3 and inspect fields
      if (!selectedSheet && availableSheets.length > 0) {
        setSelectedSheet(availableSheets[0]);
      }
      setStep(3);
      await inspectAndLoadSheetData(selectedSheet || availableSheets[0] || 'Sheet1', headerRow);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    }
  };

  // Column data type modification
  const handleColumnTypeChange = (colName: string, newType: any) => {
    setColumns((prev) =>
      prev.map((c) => (c.name === colName ? { ...c, dataType: newType } : c))
    );
  };

  // Save persistent connection (Step 5 Finish)
  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const activeRows = allExtractedRows.length > 0 ? allExtractedRows : previewRows;
      let base64Content: string | undefined = undefined;
      if (rawFile) {
        try {
          base64Content = await fileToBase64(rawFile);
        } catch {}
      }

      await onComplete({
        mode,
        datasetName: datasetName.trim() || fileName || 'Products Excel',
        filePath: filePath.trim(),
        sheetName: selectedSheet,
        headerRow,
        columns,
        records: activeRows,
        autoRefresh: mode === 'linked' ? autoRefresh : false,
        quantityColumn: quantityColumn || undefined,
        base64Content,
      });
      onClose();
    } catch (err: any) {
      setInspectError(err.message || 'Failed to save persistent connection.');
    } finally {
      setIsSaving(false);
    }
  };

  // Format file size helper
  const formatSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const stepsList = [
    { num: 1, label: 'Select File' },
    { num: 2, label: 'Select Worksheet' },
    { num: 3, label: 'Review Fields' },
    { num: 4, label: 'Options' },
    { num: 5, label: 'Finish' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link Excel Data Source (BarTender Live)"
      subtitle="BarTender-compatible live file data source wizard"
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Step {step} of 5</span>
            <span>•</span>
            <span className="capitalize font-medium text-slate-700">
              {step === 1 && 'Select Excel File'}
              {step === 2 && 'Select Worksheet'}
              {step === 3 && 'Review Fields & Data Preview'}
              {step === 4 && 'Connection Options'}
              {step === 5 && 'Finish & Connect'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && (!filePath.trim() || isTesting)) ||
                  (step === 2 && !selectedSheet) ||
                  isInspecting
                }
                onClick={handleNextStep}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
              >
                Next &gt;
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinish}
                className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving Connection...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Finish &amp; Connect
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* Hidden file input for web fallback */}
      <input
        type="file"
        id="excel-file-input"
        className="hidden"
        accept=".xlsx,.xls,.xlsm,.csv"
        onChange={handleWebFileChange}
      />

      <div className="py-2">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5 px-1">
          {stepsList.map((s) => (
            <div
              key={s.num}
              onClick={() => {
                if (s.num < step || (s.num === 2 && testResult?.success)) {
                  setStep(s.num);
                }
              }}
              className={`flex items-center gap-1.5 cursor-pointer transition-colors ${
                step === s.num
                  ? 'text-blue-600 font-semibold'
                  : step > s.num
                  ? 'text-emerald-600 font-medium'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  step === s.num
                    ? 'bg-blue-100 text-blue-700 border border-blue-300 font-bold'
                    : step > s.num
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s.num ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className="text-xs hidden md:inline">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Global Error Banner */}
        {inspectError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Connection Warning</p>
              <p className="text-red-600 mt-0.5">{inspectError}</p>
            </div>
          </div>
        )}

        {/* STEP 1: SELECT EXCEL FILE */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Select Excel File</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Specify the real local path to your Microsoft Excel workbook (<code>*.xlsx</code>, <code>*.xls</code>, <code>*.xlsm</code>, <code>*.csv</code>).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Excel File:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => {
                      setFilePath(e.target.value);
                      setFileName(e.target.value.split(/[/\\]/).pop() || '');
                      setTestResult(null);
                    }}
                    placeholder="C:\Users\...\Products.xlsx"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFile}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Browse...
                  </button>
                </div>
              </div>

              {/* Action Buttons: Test Connection */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!filePath.trim() || isTesting}
                  onClick={() => runTestConnection(filePath)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-blue-600' : ''}`} />
                  <span>{isTesting ? 'Testing Connection...' : 'Test Connection'}</span>
                </button>
              </div>

              {/* Diagnostic Test Results Card */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-lg border text-xs transition-all ${
                    testResult.success
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                      : 'bg-red-50/70 border-red-300 text-red-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs flex items-center gap-2">
                        <span>{testResult.success ? '✓ Connection successful' : '✗ Connection failed'}</span>
                        {testResult.errorCode && (
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-red-100 text-red-700 border border-red-200">
                            {testResult.errorCode}
                          </span>
                        )}
                      </p>

                      {testResult.success ? (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-500 font-sans block text-[10px]">Workbook:</span>
                            <span className="font-bold text-slate-800 truncate block">{testResult.fileName}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-sans block text-[10px]">Sheets:</span>
                            <span className="font-bold text-slate-800">{testResult.sheetCount}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-sans block text-[10px]">Rows:</span>
                            <span className="font-bold text-emerald-700 font-bold">{testResult.totalRecords}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-sans block text-[10px]">Size:</span>
                            <span className="font-bold text-slate-800">{formatSize(testResult.sizeBytes || 0)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 space-y-2">
                          <p className="text-red-700 text-[11px]">{testResult.error}</p>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleLocateFile}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 rounded shadow-2xs"
                            >
                              Locate File...
                            </button>
                            <button
                              type="button"
                              onClick={() => runTestConnection(filePath)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-2xs"
                            >
                              Retry
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: SELECT WORKSHEET */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Select Worksheet</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the worksheet from <code>{fileName || 'the workbook'}</code> that contains your label data.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
              <div className="text-xs font-bold text-slate-700 mb-2">
                Available Worksheets ({availableSheets.length}):
              </div>

              {availableSheets.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 italic bg-slate-50 rounded-lg">
                  No worksheets detected. Please test connection again.
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {availableSheets.map((sheetName) => {
                    const isSelected = selectedSheet === sheetName;
                    return (
                      <label
                        key={sheetName}
                        onClick={() => setSelectedSheet(sheetName)}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="selected-sheet"
                            checked={isSelected}
                            onChange={() => setSelectedSheet(sheetName)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-800">{sheetName}</span>
                            <span className="text-[11px] text-slate-500 block">Worksheet Table</span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Selected
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW FIELDS & PREVIEW DATA */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Review Fields &amp; Data Preview</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify detected column headers and field types from sheet <strong>"{selectedSheet}"</strong>.
                </p>
              </div>

              {/* Header Row Selector */}
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-xs font-medium text-slate-700">Header Row:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={headerRow}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setHeaderRow(val);
                    inspectAndLoadSheetData(selectedSheet, val);
                  }}
                  className="w-14 px-1.5 py-0.5 text-xs font-mono text-center bg-white border border-slate-300 rounded"
                />
              </div>
            </div>

            {isInspecting ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-xl space-y-2">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs font-medium text-slate-600">Inspecting sheet data &amp; columns...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Columns Field Types Summary */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Detected Fields ({columns.length}):
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Total Records: <strong>{totalRecordsCount}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                    {columns.map((col) => (
                      <div
                        key={col.name}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs"
                      >
                        {col.dataType === 'number' ? (
                          <Hash className="w-3 h-3 text-amber-600" />
                        ) : col.dataType === 'date' ? (
                          <Calendar className="w-3 h-3 text-blue-600" />
                        ) : (
                          <Type className="w-3 h-3 text-slate-600" />
                        )}
                        <span className="font-semibold text-slate-800">{col.name}</span>
                        <select
                          value={col.dataType || 'text'}
                          onChange={(e) => handleColumnTypeChange(col.name, e.target.value as any)}
                          className="text-[10px] bg-white border border-slate-300 rounded px-1 py-0.2 ml-1 text-slate-600"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="boolean">Boolean</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compact Data Preview Table (First 5-10 rows) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>Data Preview (First {Math.min(10, previewRows.length)} rows)</span>
                    <span className="font-normal text-slate-500">Preserves text formatting &amp; leading zeroes</span>
                  </div>

                  <div className="overflow-x-auto max-h-[160px] overflow-y-auto">
                    {previewRows.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">No rows in worksheet.</div>
                    ) : (
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="px-2.5 py-1.5 font-bold text-slate-600 w-10 text-center">#</th>
                            {columns.map((col) => (
                              <th key={col.name} className="px-2.5 py-1.5 font-bold text-slate-800 whitespace-nowrap">
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewRows.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/50">
                              <td className="px-2.5 py-1 text-slate-400 text-center font-mono text-[10px]">
                                {idx + 1}
                              </td>
                              {columns.map((col) => (
                                <td key={col.name} className="px-2.5 py-1 text-slate-700 font-mono whitespace-nowrap">
                                  {String(row[col.name] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: CONNECTION OPTIONS */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Connection Options</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure connection properties and live synchronization options.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
              {/* Connection Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Connection Name:
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="Products Excel"
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* File & Sheet Summary */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Selected File:</span>
                  <span className="font-mono text-slate-800 font-bold truncate block">{fileName || filePath}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Worksheet:</span>
                  <span className="font-mono text-slate-800 font-bold block">{selectedSheet}</span>
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Connection Mode:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    onClick={() => setMode('linked')}
                    className={`p-3 rounded-lg border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      mode === 'linked'
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conn-mode"
                      checked={mode === 'linked'}
                      onChange={() => setMode('linked')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Live Linked File</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 text-blue-700 font-bold rounded">
                          RECOMMENDED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Original Excel file on disk remains the authoritative source. Automatically refreshes on file changes.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setMode('imported')}
                    className={`p-3 rounded-lg border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      mode === 'imported'
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conn-mode"
                      checked={mode === 'imported'}
                      onChange={() => setMode('imported')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">Embedded Snapshot</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Copies rows into template database as a static snapshot unaffected by disk file modifications.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Live Link Options */}
              {mode === 'linked' && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Refresh automatically when file changes (Live Watcher)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={refreshOnOpen}
                      onChange={(e) => setRefreshOnOpen(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Refresh when document opens</span>
                  </label>
                </div>
              )}

              {/* Optional Quantity Column */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Quantity Column (Optional for print-time copies multiplication):
                </label>
                <select
                  value={quantityColumn}
                  onChange={(e) => setQuantityColumn(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="">-- None (Manual Print Quantity) --</option>
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: FINISH & CONNECT */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Finish &amp; Connect</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Review your connection parameters before completing setup.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Database className="w-5 h-5 text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">{datasetName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold ml-auto uppercase">
                    {mode === 'linked' ? 'Live Linked' : 'Snapshot'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Source Path:</span>
                    <span className="font-mono text-slate-800 font-medium break-all">{filePath}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Worksheet:</span>
                    <span className="font-semibold text-slate-800">{selectedSheet}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Total Fields:</span>
                    <span className="font-semibold text-slate-800">{columns.length} columns</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Total Records:</span>
                    <span className="font-semibold text-emerald-700">{totalRecordsCount} records</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Auto-Refresh:</span>
                    <span className="font-semibold text-slate-800">
                      {autoRefresh ? 'Enabled (File Watcher active)' : 'Manual'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Header Row:</span>
                    <span className="font-semibold text-slate-800">Row {headerRow}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Click <strong>Finish &amp; Connect</strong> to bind this Excel workbook to your template. The fields will appear immediately in the <strong>Data Sources</strong> side panel ready to drag and drop onto your label canvas.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
