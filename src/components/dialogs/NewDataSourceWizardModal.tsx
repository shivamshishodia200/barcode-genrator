import React, { useState, useEffect } from 'react';
import { DataSourceItem, DataSourceType } from '../../types';
import { formatCustomDate, evaluateSafeScript } from '../../services/dataSourceEngine';
import { X, Calendar, Database, Globe, Hash, Save, Code, FileText, ChevronDown, Check, AlertCircle } from 'lucide-react';

export type WizardDataSourceType =
  | 'embedded'
  | 'clock'
  | 'database'
  | 'global'
  | 'print-job'
  | 'external-file'
  | 'script'
  | 'printer-code';

interface NewDataSourceWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDataSource: (item: DataSourceItem) => void;
  datasets?: any[];
  currentRecord?: Record<string, any>;
  availableVariables?: Array<{ name: string; label?: string; sampleValue?: string }>;
  currentConnection?: any;
  existingCount?: number;
}

interface TypeOption {
  type: WizardDataSourceType;
  label: string;
  description: string;
  defaultName: string;
  icon: React.ReactNode;
}

export const NewDataSourceWizardModal: React.FC<NewDataSourceWizardModalProps> = ({
  isOpen,
  onClose,
  onAddDataSource,
  datasets = [],
  currentRecord = {},
  availableVariables = [],
  currentConnection,
  existingCount = 0,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<WizardDataSourceType>('embedded');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  // Common configuration fields
  const [sourceName, setSourceName] = useState('');

  // 1. Embedded Data
  const [embeddedValue, setEmbeddedValue] = useState('Sample Text');
  const [embeddedDataType, setEmbeddedDataType] = useState<'text' | 'number' | 'date' | 'time' | 'currency'>('text');

  // 2. Clock
  const [clockFormat, setClockFormat] = useState('YYYY-MM-DD');
  const [clockOffsetDays, setClockOffsetDays] = useState(0);
  const [clockOffsetMonths, setClockOffsetMonths] = useState(0);
  const [clockOffsetYears, setClockOffsetYears] = useState(0);
  const [clockType, setClockType] = useState<'current' | 'expiry' | 'mfg'>('current');

  // 3. Database Field
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');

  // 4. Global Data Field
  const [globalVarName, setGlobalVarName] = useState('GLOBAL_VAR_1');
  const [globalDefaultValue, setGlobalDefaultValue] = useState('DefaultValue');

  // 5. Print Job Field
  const [printJobField, setPrintJobField] = useState<string>('SYSTEM.RECORD_NUMBER');

  // 6. External File
  const [filePath, setFilePath] = useState('C:\\BarcodeFlow\\data.txt');
  const [fileReadMode, setFileReadMode] = useState<'entire' | 'first_line' | 'by_index'>('first_line');
  const [fileFallbackValue, setFileFallbackValue] = useState('FILE_DATA_SAMPLE');

  // 7. Visual Basic Script
  const [scriptCode, setScriptCode] = useState('Value = "SN-" & Format(Now, "YYYYMMDD")');
  const [scriptLanguage, setScriptLanguage] = useState<'vbscript' | 'javascript'>('vbscript');
  const [scriptTestResult, setScriptTestResult] = useState<string | null>(null);

  // 8. Printer Code Template Field
  const [printerFieldTag, setPrinterFieldTag] = useState('<PRINTER_FIELD_1>');
  const [printerDefaultValue, setPrinterDefaultValue] = useState('SAMPLE_PRN');
  const [printerLanguage, setPrinterLanguage] = useState('zpl');

  // Available database fields extraction
  const activeDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || currentConnection;
  const availableFields: string[] = React.useMemo(() => {
    if (activeDataset?.fields && Array.isArray(activeDataset.fields)) {
      return activeDataset.fields.map((f: any) => (typeof f === 'string' ? f : f.name || f.fieldName));
    }
    if (activeDataset?.records && activeDataset.records.length > 0) {
      return Object.keys(activeDataset.records[0]);
    }
    if (currentRecord && Object.keys(currentRecord).length > 0) {
      return Object.keys(currentRecord);
    }
    return ['ProductID', 'ProductName', 'Barcode', 'Price', 'Batch', 'ExpiryDate', 'Quantity'];
  }, [activeDataset, currentRecord]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedType('embedded');
      setSourceName(`Source ${existingCount + 1}`);
      setEmbeddedValue('Sample Text');
      setScriptTestResult(null);

      if (datasets.length > 0) {
        setSelectedDatasetId(datasets[0].id || 'dataset-1');
      }
      if (availableFields.length > 0) {
        setSelectedField(availableFields[0]);
      }
    }
  }, [isOpen, existingCount, datasets, availableFields]);

  useEffect(() => {
    if (availableFields.length > 0 && !availableFields.includes(selectedField)) {
      setSelectedField(availableFields[0]);
    }
  }, [availableFields, selectedField]);

  if (!isOpen) return null;

  const typeOptions: TypeOption[] = [
    {
      type: 'embedded',
      label: 'Embedded Data',
      defaultName: `Embedded Data ${existingCount + 1}`,
      description:
        'The Embedded Data source is primarily intended for static data, but can also be modified using transforms, serialization, or user input.',
      icon: (
        <div className="flex items-center gap-0.5 px-0.5 bg-blue-50 border border-blue-300 rounded text-[9px] font-bold text-blue-900 leading-none">
          <span className="text-blue-600 font-serif">I</span>
          <span className="text-blue-900 text-[8.5px] font-extrabold">BT</span>
        </div>
      ),
    },
    {
      type: 'clock',
      label: 'Clock',
      defaultName: `Clock ${existingCount + 1}`,
      description:
        "The Clock data source provides the current date or time from your computer's clock, with support for date/time formatting and time offsets.",
      icon: <Calendar className="w-3.5 h-3.5 text-blue-600" />,
    },
    {
      type: 'database',
      label: 'Database Field',
      defaultName: `Database Field ${existingCount + 1}`,
      description:
        'The Database Field data source obtains data from a field in a connected database, Excel workbook, CSV file, or OLE DB / ODBC source.',
      icon: <Database className="w-3.5 h-3.5 text-emerald-600" />,
    },
    {
      type: 'global',
      label: 'Global Data Field',
      defaultName: `Global Field ${existingCount + 1}`,
      description:
        'A Global Data Field shares data across multiple documents or applications on the local network.',
      icon: <Globe className="w-3.5 h-3.5 text-cyan-600" />,
    },
    {
      type: 'print-job',
      label: 'Print Job Field',
      defaultName: `Print Job Field ${existingCount + 1}`,
      description:
        'The Print Job Field data source provides information about the current print job, such as serial number, document name, printer name, or total pages.',
      icon: <Hash className="w-3.5 h-3.5 text-indigo-600" />,
    },
    {
      type: 'external-file',
      label: 'External File',
      defaultName: `External File ${existingCount + 1}`,
      description:
        'The External File data source reads data from an external text file, binary file, or script at print time.',
      icon: <Save className="w-3.5 h-3.5 text-amber-600" />,
    },
    {
      type: 'script',
      label: 'Visual Basic Script',
      defaultName: `VBScript ${existingCount + 1}`,
      description:
        'The Visual Basic Script data source generates or transforms data using a custom VBScript expression or multi-line event script.',
      icon: <Code className="w-3.5 h-3.5 text-green-700" />,
    },
    {
      type: 'printer-code',
      label: 'Printer Code Template Field',
      defaultName: `Printer Code Field ${existingCount + 1}`,
      description:
        'A Printer Code Template Field allows inserting printer-specific command sequences or template merge fields directly into the print output.',
      icon: <span className="font-serif italic font-bold text-slate-800 text-xs px-0.5">T</span>,
    },
  ];

  const currentTypeOption = typeOptions.find((t) => t.type === selectedType) || typeOptions[0];

  const handleSelectType = (t: WizardDataSourceType) => {
    setSelectedType(t);
    setTypeDropdownOpen(false);
    const opt = typeOptions.find((o) => o.type === t);
    if (opt) {
      setSourceName(opt.defaultName);
    }
  };

  // Evaluate Clock preview
  const getClockPreview = () => {
    const d = new Date();
    d.setDate(d.getDate() + Number(clockOffsetDays || 0));
    d.setMonth(d.getMonth() + Number(clockOffsetMonths || 0));
    d.setFullYear(d.getFullYear() + Number(clockOffsetYears || 0));
    return formatCustomDate(d, clockFormat || 'YYYY-MM-DD');
  };

  // Test script
  const handleTestScript = () => {
    try {
      const scopeCtx = {
        record: currentRecord || {},
        system: {
          userName: 'Administrator',
          printerName: 'Zebra ZT410 (300 dpi)',
          jobId: 'JOB-2026-001',
          currentRecordIndex: 0,
          totalRecords: 1,
        },
      };
      const result = evaluateSafeScript(scriptCode, scopeCtx);
      setScriptTestResult(result || '[Empty Result]');
    } catch (err: any) {
      setScriptTestResult(`[Error: ${err.message}]`);
    }
  };

  // Final Finish Handler
  const handleFinish = () => {
    const newId = `ds-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let newDs: DataSourceItem;

    switch (selectedType) {
      case 'embedded':
        newDs = {
          id: newId,
          name: sourceName || currentTypeOption.defaultName,
          type: 'embedded',
          value: embeddedValue || 'Sample Text',
          dataType: embeddedDataType,
          enabled: true,
        };
        break;

      case 'clock':
        newDs = {
          id: newId,
          name: sourceName || `Clock (${clockFormat})`,
          type: 'clock',
          value: getClockPreview(),
          dateFormat: clockFormat,
          dateOffsetDays: Number(clockOffsetDays || 0),
          dateOffsetMonths: Number(clockOffsetMonths || 0),
          dateOffsetYears: Number(clockOffsetYears || 0),
          dateType: clockType,
          enabled: true,
        };
        break;

      case 'database':
        const dbFieldVal =
          currentRecord && currentRecord[selectedField] !== undefined
            ? String(currentRecord[selectedField])
            : `{{${selectedField}}}`;
        newDs = {
          id: newId,
          name: sourceName || `Field: ${selectedField}`,
          type: 'database-field',
          databaseField: selectedField,
          field: selectedField,
          datasetId: selectedDatasetId,
          value: dbFieldVal,
          enabled: true,
        };
        break;

      case 'global':
        newDs = {
          id: newId,
          name: sourceName || `Global: ${globalVarName}`,
          type: 'variable',
          variableName: globalVarName,
          value: globalDefaultValue || 'GLOBAL_VAL',
          enabled: true,
        };
        break;

      case 'print-job':
        newDs = {
          id: newId,
          name: sourceName || `Print Job (${printJobField.replace('SYSTEM.', '')})`,
          type: 'system',
          systemVarName: printJobField as any,
          value:
            printJobField === 'SYSTEM.DATE'
              ? formatCustomDate(new Date(), 'YYYY-MM-DD')
              : printJobField === 'SYSTEM.TIME'
              ? formatCustomDate(new Date(), 'HH:mm:ss')
              : printJobField === 'SYSTEM.RECORD_NUMBER'
              ? '1'
              : printJobField === 'SYSTEM.USER'
              ? 'Current User'
              : printJobField === 'SYSTEM.PRINTER'
              ? 'Default Printer'
              : 'JOB-001',
          enabled: true,
        };
        break;

      case 'external-file':
        newDs = {
          id: newId,
          name: sourceName || `File: ${filePath.split(/[\\/]/).pop() || 'data.txt'}`,
          type: 'embedded',
          value: fileFallbackValue || `[Content of ${filePath}]`,
          enabled: true,
        };
        break;

      case 'script':
        newDs = {
          id: newId,
          name: sourceName || 'VB Script Source',
          type: 'script',
          scriptLanguage,
          scriptCode,
          value: scriptTestResult && !scriptTestResult.startsWith('[Error') ? scriptTestResult : 'SCRIPT_VAL',
          enabled: true,
        };
        break;

      case 'printer-code':
        newDs = {
          id: newId,
          name: sourceName || `Template: ${printerFieldTag}`,
          type: 'embedded',
          value: printerDefaultValue || printerFieldTag,
          enabled: true,
        };
        break;

      default:
        newDs = {
          id: newId,
          name: sourceName || 'New Data Source',
          type: 'embedded',
          value: 'Sample Text',
          enabled: true,
        };
        break;
    }

    onAddDataSource(newDs);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-2xs p-3 select-none">
      <div className="bg-[#f0f2f5] border border-[#7088a8] shadow-2xl rounded-sm w-[520px] max-w-full overflow-hidden flex flex-col select-none text-[11.5px] text-slate-800 relative z-[1001]">
        
        {/* Title Bar matching Windows BarTender dialog */}
        <div className="h-7 bg-[#f0f2f5] border-b border-[#cbd5e1] px-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[12px]">
            {/* BarTender Wizard Icon */}
            <div className="w-3.5 h-3.5 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-xs flex items-center justify-center text-[8px] font-black text-white shadow-2xs">
              ✦
            </div>
            <span>New Data Source Wizard</span>
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-xs text-slate-600 transition-colors cursor-pointer"
            title="Close Wizard"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Wizard Header Banner with decorative BarTender graphic watermark */}
        <div className="relative h-18 bg-white border-b border-[#b8c5d6] px-4 py-2.5 flex items-center justify-between overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-bold text-[13.5px] text-slate-900 leading-tight">
              {step === 1 ? 'Select Data Source Type' : `Configure ${currentTypeOption.label}`}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {step === 1
                ? 'Choose the category of data that this source provides.'
                : 'Specify options and field bindings for this data source.'}
            </p>
          </div>

          {/* Decorative Classic BarTender Blueprint Graphic Banner */}
          <div className="absolute right-0 top-0 bottom-0 w-52 pointer-events-none opacity-40 flex items-center justify-end overflow-hidden select-none">
            <svg viewBox="0 0 200 70" className="w-full h-full">
              <defs>
                <linearGradient id="wizardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#0369a1" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              {/* Background gradient block */}
              <rect width="200" height="70" fill="url(#wizardGrad)" />
              {/* Keyboard tiles Q W E R T */}
              <g fill="#475569" opacity="0.6" fontSize="7" fontWeight="bold" fontFamily="monospace">
                <rect x="90" y="8" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="92" y="15">Q</text>
                <rect x="102" y="8" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="104" y="15">W</text>
                <rect x="114" y="8" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="116" y="15">E</text>
                <rect x="126" y="8" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="128" y="15">R</text>
                <rect x="138" y="8" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="140" y="15">T</text>
                {/* Second row A S D F G */}
                <rect x="94" y="19" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="96" y="26">A</text>
                <rect x="106" y="19" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="108" y="26">S</text>
                <rect x="118" y="19" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="120" y="26">D</text>
                <rect x="130" y="19" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="132" y="26">F</text>
                <rect x="142" y="19" width="10" height="9" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
                <text x="144" y="26">G</text>
              </g>
              {/* Binary code strings */}
              <text x="5" y="16" fill="#0369a1" opacity="0.4" fontSize="6.5" fontFamily="monospace">43597001011101000101</text>
              <text x="5" y="28" fill="#0369a1" opacity="0.4" fontSize="6.5" fontFamily="monospace">A7-1184-9920-BT-092</text>
              {/* Clock outline */}
              <circle cx="168" cy="40" r="18" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="1,1" />
              <circle cx="168" cy="40" r="15" fill="#f0f9ff" stroke="#0369a1" strokeWidth="1" />
              <line x1="168" y1="40" x2="168" y2="30" stroke="#0369a1" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="168" y1="40" x2="176" y2="40" stroke="#0369a1" strokeWidth="1.2" strokeLinecap="round" />
              {/* Mini barcode lines */}
              <g fill="#0f172a" opacity="0.5">
                <rect x="155" y="6" width="1.5" height="12" />
                <rect x="158" y="6" width="0.8" height="12" />
                <rect x="160" y="6" width="2" height="12" />
                <rect x="164" y="6" width="1" height="12" />
                <rect x="166" y="6" width="1.8" height="12" />
                <rect x="170" y="6" width="0.8" height="12" />
                <rect x="172" y="6" width="2.2" height="12" />
                <rect x="176" y="6" width="1" height="12" />
              </g>
            </svg>
          </div>
        </div>

        {/* Wizard Form Content Area */}
        <div className="p-5 flex-1 bg-white min-h-[260px] flex flex-col justify-between">
          {step === 1 ? (
            /* STEP 1: SELECT DATA SOURCE TYPE */
            <div className="space-y-4">
              <p className="text-[11.5px] text-slate-800">
                Select the type for the new data source:
              </p>

              {/* Type Dropdown Row matching BarTender Screenshot */}
              <div className="flex items-center gap-3">
                <label className="w-14 font-medium text-slate-700 shrink-0 text-right">Type:</label>
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                    className="w-full h-6 px-2 bg-white border border-[#94a3b8] rounded-xs flex items-center justify-between text-left hover:border-blue-500 focus:border-blue-600 outline-none shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="shrink-0">{currentTypeOption.icon}</span>
                      <span className="font-medium text-slate-900 truncate">{currentTypeOption.label}</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                  </button>

                  {/* Dropdown Menu matching BarTender Options */}
                  {typeDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[1010]"
                        onClick={() => setTypeDropdownOpen(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border border-[#94a3b8] shadow-xl py-0.5 z-[1020] rounded-xs text-[11.5px] max-h-60 overflow-y-auto">
                        {typeOptions.map((opt) => {
                          const isSelected = opt.type === selectedType;
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => handleSelectType(opt.type)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[#0078d7] text-white font-semibold'
                                  : 'text-slate-800 hover:bg-[#cce0f5]'
                              }`}
                            >
                              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                                {opt.icon}
                              </span>
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Data Source Name Input */}
              <div className="flex items-center gap-3">
                <label className="w-14 font-medium text-slate-700 shrink-0 text-right">Name:</label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="flex-1 h-6 px-2 border border-[#94a3b8] rounded-xs text-[11.5px] outline-none focus:border-blue-600 bg-white"
                  placeholder="Data source name..."
                />
              </div>

              {/* Description Group Box matching BarTender UI */}
              <fieldset className="border border-[#cbd5e1] rounded-xs p-3 bg-slate-50/50 mt-4">
                <legend className="px-1 text-[11px] font-semibold text-slate-600">
                  Description:
                </legend>
                <p className="text-[11.5px] text-slate-700 leading-relaxed min-h-[48px]">
                  {currentTypeOption.description}
                </p>
              </fieldset>
            </div>
          ) : (
            /* STEP 2: CONFIGURE SPECIFIC DATA SOURCE TYPE */
            <div className="space-y-3.5">
              {/* 1. EMBEDDED DATA CONFIGURATION */}
              {selectedType === 'embedded' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Embedded Value / Text:
                    </label>
                    <textarea
                      rows={3}
                      value={embeddedValue}
                      onChange={(e) => setEmbeddedValue(e.target.value)}
                      className="w-full p-2 border border-[#94a3b8] rounded-xs text-[11.5px] font-mono outline-none focus:border-blue-600 bg-white"
                      placeholder="Enter embedded string data..."
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Data Type:</label>
                    <select
                      value={embeddedDataType}
                      onChange={(e) => setEmbeddedDataType(e.target.value as any)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      <option value="text">Text / String</option>
                      <option value="number">Numeric</option>
                      <option value="date">Date</option>
                      <option value="time">Time</option>
                      <option value="currency">Currency</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 2. CLOCK CONFIGURATION */}
              {selectedType === 'clock' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Clock Type:</label>
                    <select
                      value={clockType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setClockType(val);
                        if (val === 'expiry' && clockOffsetDays === 0) setClockOffsetDays(365);
                        if (val === 'current') {
                          setClockOffsetDays(0);
                          setClockOffsetMonths(0);
                          setClockOffsetYears(0);
                        }
                      }}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      <option value="current">Current Date / Time</option>
                      <option value="expiry">Offset Date (Expiry / Shelf Life)</option>
                      <option value="mfg">Manufacturing Date (MFG)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Date Format:</label>
                    <select
                      value={clockFormat}
                      onChange={(e) => setClockFormat(e.target.value)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-09-08)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (08/09/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (09/08/2026)</option>
                      <option value="DD-MMM-YYYY">DD-MMM-YYYY (08-Sep-2026)</option>
                      <option value="YYYYMMDD">YYYYMMDD (20260908)</option>
                      <option value="HH:mm:ss">HH:mm:ss (15:30:00)</option>
                      <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss</option>
                    </select>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xs space-y-2">
                    <span className="font-bold text-slate-700 text-[11px]">Time Offset (from current clock):</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10.5px] text-slate-600 block">Days:</label>
                        <input
                          type="number"
                          value={clockOffsetDays}
                          onChange={(e) => setClockOffsetDays(parseInt(e.target.value) || 0)}
                          className="w-full h-5.5 px-1.5 border border-slate-300 rounded text-center text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10.5px] text-slate-600 block">Months:</label>
                        <input
                          type="number"
                          value={clockOffsetMonths}
                          onChange={(e) => setClockOffsetMonths(parseInt(e.target.value) || 0)}
                          className="w-full h-5.5 px-1.5 border border-slate-300 rounded text-center text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10.5px] text-slate-600 block">Years:</label>
                        <input
                          type="number"
                          value={clockOffsetYears}
                          onChange={(e) => setClockOffsetYears(parseInt(e.target.value) || 0)}
                          className="w-full h-5.5 px-1.5 border border-slate-300 rounded text-center text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-blue-50/70 border border-blue-200 rounded-xs text-[11px]">
                    <span className="font-semibold text-blue-900">Evaluated Output:</span>
                    <span className="font-mono font-bold text-blue-950">{getClockPreview()}</span>
                  </div>
                </div>
              )}

              {/* 3. DATABASE FIELD CONFIGURATION */}
              {selectedType === 'database' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Database/Table:</label>
                    <select
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      {datasets.length > 0 ? (
                        datasets.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.name || d.sheetName || 'Database Table'}
                          </option>
                        ))
                      ) : (
                        <option value="active-excel">Excel / Active Workbook (Products$)</option>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Field / Column:</label>
                    <select
                      value={selectedField}
                      onChange={(e) => setSelectedField(e.target.value)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] font-bold text-slate-900 outline-none flex-1"
                    >
                      {availableFields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xs flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-semibold text-emerald-900 block">Sample Record Value:</span>
                      <span className="text-[10px] text-emerald-700">From currently selected record</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-950 text-[12px]">
                      {currentRecord && currentRecord[selectedField] !== undefined
                        ? String(currentRecord[selectedField])
                        : `{{${selectedField}}}`}
                    </span>
                  </div>
                </div>
              )}

              {/* 4. GLOBAL DATA FIELD CONFIGURATION */}
              {selectedType === 'global' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Global Field Key:</label>
                    <input
                      type="text"
                      value={globalVarName}
                      onChange={(e) => setGlobalVarName(e.target.value)}
                      className="w-full h-6 px-2 border border-[#94a3b8] rounded-xs font-mono text-[11.5px] outline-none"
                      placeholder="e.g. GLOBAL_STORE_ID"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Fallback Value:</label>
                    <input
                      type="text"
                      value={globalDefaultValue}
                      onChange={(e) => setGlobalDefaultValue(e.target.value)}
                      className="w-full h-6 px-2 border border-[#94a3b8] rounded-xs text-[11.5px] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 5. PRINT JOB FIELD CONFIGURATION */}
              {selectedType === 'print-job' && (
                <div className="space-y-3">
                  <label className="block font-semibold text-slate-700">Select Print Job Variable:</label>
                  <select
                    value={printJobField}
                    onChange={(e) => setPrintJobField(e.target.value)}
                    className="w-full h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none"
                  >
                    <option value="SYSTEM.RECORD_NUMBER">Serial Number / Record Index</option>
                    <option value="SYSTEM.DATE">Print Job Date (YYYY-MM-DD)</option>
                    <option value="SYSTEM.TIME">Print Job Time (HH:mm:ss)</option>
                    <option value="SYSTEM.USER">Logged-in Windows User Name</option>
                    <option value="SYSTEM.PRINTER">Target Printer Name</option>
                    <option value="SYSTEM.TOTAL_RECORDS">Total Labels in Print Batch</option>
                    <option value="SYSTEM.COPY_NUMBER">Current Copy Index</option>
                    <option value="SYSTEM.JOB_ID">Enterprise Print Job ID</option>
                  </select>
                </div>
              )}

              {/* 6. EXTERNAL FILE CONFIGURATION */}
              {selectedType === 'external-file' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">File Path:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={filePath}
                        onChange={(e) => setFilePath(e.target.value)}
                        className="flex-1 h-6 px-2 border border-[#94a3b8] rounded-xs font-mono text-[11px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const mockPath = 'C:\\BarcodeFlow\\BatchData_2026.csv';
                          setFilePath(mockPath);
                        }}
                        className="h-6 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[10.5px] font-semibold cursor-pointer"
                      >
                        Browse...
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700 w-24">Reading Mode:</label>
                    <select
                      value={fileReadMode}
                      onChange={(e) => setFileReadMode(e.target.value as any)}
                      className="h-6 px-2 bg-white border border-[#94a3b8] rounded-xs text-[11.5px] outline-none flex-1"
                    >
                      <option value="first_line">First Line Only</option>
                      <option value="entire">Entire File Content</option>
                      <option value="by_index">Line Matching Record Number</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 7. VISUAL BASIC SCRIPT CONFIGURATION */}
              {selectedType === 'script' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800">VBScript Expression / Function:</label>
                    <button
                      type="button"
                      onClick={handleTestScript}
                      className="h-5 px-2 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold cursor-pointer"
                    >
                      Test Expression
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={scriptCode}
                    onChange={(e) => setScriptCode(e.target.value)}
                    className="w-full p-2 border border-[#94a3b8] rounded-xs font-mono text-[11px] outline-none focus:border-green-600 bg-white"
                    placeholder='Value = "BATCH-" & Record("ProductID")'
                  />
                  {scriptTestResult && (
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[10.5px] flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Evaluated Output:</span>
                      <span className="font-mono font-bold text-slate-900">{scriptTestResult}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 8. PRINTER CODE TEMPLATE FIELD CONFIGURATION */}
              {selectedType === 'printer-code' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Printer Template Tag:</label>
                    <input
                      type="text"
                      value={printerFieldTag}
                      onChange={(e) => setPrinterFieldTag(e.target.value)}
                      className="w-full h-6 px-2 border border-[#94a3b8] rounded-xs font-mono text-[11.5px] outline-none"
                      placeholder="<PRINTER_FIELD_1>"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default / Preview Value:</label>
                    <input
                      type="text"
                      value={printerDefaultValue}
                      onChange={(e) => setPrinterDefaultValue(e.target.value)}
                      className="w-full h-6 px-2 border border-[#94a3b8] rounded-xs text-[11.5px] outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation matching Screenshot */}
        <div className="h-10 bg-[#f0f2f5] border-t border-[#cbd5e1] px-4 flex items-center justify-end gap-2">
          {/* < Back Button */}
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={step === 1}
            className="h-6 px-3 bg-white border border-[#94a3b8] hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white rounded-xs text-slate-800 font-medium text-[11px] cursor-pointer"
          >
            &lt; Back
          </button>

          {/* Next > Button */}
          <button
            type="button"
            onClick={() => {
              if (step === 1) {
                setStep(2);
              } else {
                handleFinish();
              }
            }}
            disabled={step === 2}
            className="h-6 px-3 bg-white border border-[#94a3b8] hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white rounded-xs text-slate-800 font-medium text-[11px] cursor-pointer"
          >
            Next &gt;
          </button>

          {/* Finish Button */}
          <button
            type="button"
            onClick={handleFinish}
            className="h-6 px-3.5 bg-white border border-[#94a3b8] hover:bg-blue-50 hover:border-blue-500 rounded-xs text-slate-900 font-bold text-[11px] shadow-2xs cursor-pointer ml-1"
          >
            Finish
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            className="h-6 px-3 bg-white border border-[#94a3b8] hover:bg-slate-50 rounded-xs text-slate-800 font-medium text-[11px] cursor-pointer ml-1"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
