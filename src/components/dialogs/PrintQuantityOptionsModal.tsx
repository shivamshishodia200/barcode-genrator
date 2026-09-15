import React, { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { DynamicValueSource } from '../../types';

export interface PrintQuantityOptionsModalProps {
  isOpen: boolean;
  initialCategory?: 'serialNumbers' | 'copies';
  showOnlyCopies?: boolean;
  serialNumbersSource?: DynamicValueSource;
  serialNumbersValue?: number;
  copiesSource?: DynamicValueSource;
  copiesValue?: number;
  availableDatabaseFields: string[];
  availableNamedSources: string[];
  onClose: () => void;
  onApply: (results: {
    serialNumbersSource: DynamicValueSource;
    copiesSource: DynamicValueSource;
  }) => void;
}

export const PrintQuantityOptionsModal: React.FC<PrintQuantityOptionsModalProps> = ({
  isOpen,
  initialCategory = 'serialNumbers',
  showOnlyCopies = false,
  serialNumbersSource,
  serialNumbersValue = 1,
  copiesSource,
  copiesValue = 1,
  availableDatabaseFields,
  availableNamedSources,
  onClose,
  onApply,
}) => {
  const [activeCategory, setActiveCategory] = useState<'serialNumbers' | 'copies'>(
    showOnlyCopies ? 'copies' : initialCategory
  );

  // Serial Numbers state
  const [snSourceType, setSnSourceType] = useState<'constant' | 'database' | 'named_source' | 'unlimited'>('constant');
  const [snDbField, setSnDbField] = useState<string>('');
  const [snNamedSource, setSnNamedSource] = useState<string>('');

  // Copies per Serial Number state
  const [cpSourceType, setCpSourceType] = useState<'constant' | 'database' | 'named_source' | 'unlimited'>('constant');
  const [cpDbField, setCpDbField] = useState<string>('');
  const [cpNamedSource, setCpNamedSource] = useState<string>('');
  const [cpAllowRecordOverride, setCpAllowRecordOverride] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setActiveCategory(initialCategory);

      // Initialize Serial Numbers
      if (serialNumbersSource) {
        setSnSourceType(serialNumbersSource.sourceType || 'constant');
        setSnDbField(serialNumbersSource.databaseField || (availableDatabaseFields[0] || ''));
        setSnNamedSource(serialNumbersSource.namedSource || (availableNamedSources[0] || ''));
      } else {
        setSnSourceType('constant');
        setSnDbField(availableDatabaseFields[0] || '');
        setSnNamedSource(availableNamedSources[0] || '');
      }

      // Initialize Copies
      if (copiesSource) {
        setCpSourceType(copiesSource.sourceType || 'constant');
        setCpDbField(copiesSource.databaseField || (availableDatabaseFields[0] || ''));
        setCpNamedSource(copiesSource.namedSource || (availableNamedSources[0] || ''));
        setCpAllowRecordOverride(copiesSource.allowRecordOverride === true);
      } else {
        setCpSourceType('constant');
        setCpDbField(availableDatabaseFields[0] || '');
        setCpNamedSource(availableNamedSources[0] || '');
        setCpAllowRecordOverride(false);
      }
    }
  }, [
    isOpen,
    initialCategory,
    serialNumbersSource,
    copiesSource,
    availableDatabaseFields,
    availableNamedSources,
  ]);

  if (!isOpen) return null;

  const handleOk = () => {
    const updatedSnSource: DynamicValueSource = {
      sourceType: snSourceType,
      value: serialNumbersValue,
      databaseField: snSourceType === 'database' ? snDbField : undefined,
      namedSource: snSourceType === 'named_source' ? snNamedSource : undefined,
      isUnlimited: snSourceType === 'unlimited',
    };

    const updatedCpSource: DynamicValueSource = {
      sourceType: cpSourceType,
      value: copiesValue,
      databaseField: cpSourceType === 'database' ? cpDbField : undefined,
      namedSource: cpSourceType === 'named_source' ? cpNamedSource : undefined,
      allowRecordOverride: cpSourceType === 'constant' ? cpAllowRecordOverride : false,
      isUnlimited: cpSourceType === 'unlimited',
    };

    onApply({
      serialNumbersSource: updatedSnSource,
      copiesSource: updatedCpSource,
    });
    onClose();
  };

  const isSerialNumbers = activeCategory === 'serialNumbers';
  const currentSourceType = isSerialNumbers ? snSourceType : cpSourceType;
  const currentDbField = isSerialNumbers ? snDbField : cpDbField;
  const currentNamedSource = isSerialNumbers ? snNamedSource : cpNamedSource;

  const setSourceType = (type: 'constant' | 'database' | 'named_source' | 'unlimited') => {
    if (isSerialNumbers) {
      setSnSourceType(type);
    } else {
      setCpSourceType(type);
    }
  };

  const setDbField = (field: string) => {
    if (isSerialNumbers) {
      setSnDbField(field);
    } else {
      setCpDbField(field);
    }
  };

  const setNamedSource = (ns: string) => {
    if (isSerialNumbers) {
      setSnNamedSource(ns);
    } else {
      setCpNamedSource(ns);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 font-sans select-none animate-in fade-in duration-100">
      <div
        className="w-[560px] max-w-full bg-[#f4f7fb] rounded-lg shadow-2xl border border-[#7d9ebc] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#e8edf5] to-[#d8e3f0] border-b border-[#b8c9db] px-3 py-1.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            {/* BarTender style Yellow/Blue Print Quantity Document Icon */}
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="10" height="12" rx="1" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
              <rect x="5" y="4" width="9" height="10" rx="0.5" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
              <line x1="7" y1="7" x2="12" y2="7" stroke="#ffffff" strokeWidth="1" />
              <line x1="7" y1="9.5" x2="12" y2="9.5" stroke="#ffffff" strokeWidth="1" />
            </svg>
            <span className="font-semibold text-slate-800 text-[12.5px]">Print Quantity Options</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-red-600 hover:text-white rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body: Left Navigation + Right Options Fieldset */}
        <div className="p-3.5 flex gap-3 min-h-[260px] bg-[#f4f7fb]">
          {/* Left Category Selection List */}
          <div className="w-44 shrink-0 bg-white border border-[#a4bed8] rounded-xs shadow-2xs p-1 flex flex-col gap-0.5 overflow-y-auto">
            {showOnlyCopies ? (
              <button
                type="button"
                onClick={() => setActiveCategory('copies')}
                className="w-full text-left px-2 py-1.5 rounded-xs flex items-center gap-2 text-[11.5px] cursor-pointer bg-[#cce8ff] border border-[#99d1ff] text-slate-900 font-medium"
              >
                <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="truncate">Copies</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveCategory('serialNumbers')}
                  className={`w-full text-left px-2 py-1.5 rounded-xs flex items-center gap-2 text-[11.5px] cursor-pointer transition-colors ${
                    activeCategory === 'serialNumbers'
                      ? 'bg-[#cce8ff] border border-[#99d1ff] text-slate-900 font-medium'
                      : 'hover:bg-[#f0f4f9] text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300 flex items-center justify-center text-[9px] font-bold text-blue-700 shrink-0">
                    123
                  </div>
                  <span className="truncate">Serial Numbers</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCategory('copies')}
                  className={`w-full text-left px-2 py-1.5 rounded-xs flex items-center gap-2 text-[11.5px] cursor-pointer transition-colors ${
                    activeCategory === 'copies'
                      ? 'bg-[#cce8ff] border border-[#99d1ff] text-slate-900 font-medium'
                      : 'hover:bg-[#f0f4f9] text-slate-700 border border-transparent'
                  }`}
                >
                  <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                  <span className="truncate">Copies per Serial Number</span>
                </button>
              </>
            )}
          </div>

          {/* Right Options Panel */}
          <div className="flex-1 min-w-0">
            <fieldset className="border border-[#c5d4e4] rounded p-3 pt-2 bg-white/70 h-full flex flex-col justify-start space-y-3">
              <legend className="text-[11.5px] font-semibold text-slate-700 px-1">Quantity Source</legend>

              {/* Radio 1: Specify quantity in print dialog */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer font-normal text-slate-800 text-[11.5px]">
                  <input
                    type="radio"
                    name={`quantitySource_${activeCategory}`}
                    checked={currentSourceType === 'constant'}
                    onChange={() => setSourceType('constant')}
                    className="accent-[#0078d7]"
                  />
                  <span>Specify quantity in print dialog</span>
                </label>

                {/* Sub-option for Copies: Allow record selection dialog to override copies */}
                {!isSerialNumbers && (
                  <div className="pl-6">
                    <label
                      className={`flex items-center gap-2 cursor-pointer text-[11px] ${
                        currentSourceType === 'constant' ? 'text-slate-700' : 'text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={cpAllowRecordOverride}
                        disabled={currentSourceType !== 'constant'}
                        onChange={(e) => setCpAllowRecordOverride(e.target.checked)}
                        className="accent-[#0078d7]"
                      />
                      <span>Allow record selection dialog to override copies</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Radio 2: Get quantity from database field */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer font-normal text-slate-800 text-[11.5px]">
                  <input
                    type="radio"
                    name={`quantitySource_${activeCategory}`}
                    checked={currentSourceType === 'database'}
                    onChange={() => setSourceType('database')}
                    className="accent-[#0078d7]"
                  />
                  <span>Get quantity from database field</span>
                </label>
                <div className="pl-6 flex items-center gap-2">
                  <label
                    className={`text-[11px] shrink-0 ${
                      currentSourceType === 'database' ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    Database Field:
                  </label>
                  <select
                    value={currentDbField}
                    disabled={currentSourceType !== 'database'}
                    onChange={(e) => setDbField(e.target.value)}
                    className="flex-1 border border-[#a4bed8] rounded px-2 py-0.8 text-[11px] bg-white text-slate-800 focus:outline-[#0078d7] disabled:bg-[#f1f3f6] disabled:text-slate-400 disabled:border-slate-300"
                  >
                    {availableDatabaseFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Radio 3: Get quantity from data source */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer font-normal text-slate-800 text-[11.5px]">
                  <input
                    type="radio"
                    name={`quantitySource_${activeCategory}`}
                    checked={currentSourceType === 'named_source'}
                    onChange={() => setSourceType('named_source')}
                    className="accent-[#0078d7]"
                  />
                  <span>Get quantity from data source</span>
                </label>
                {currentSourceType === 'named_source' && (
                  <div className="pl-6 flex items-center gap-2 animate-in fade-in duration-100">
                    <label className="text-[11px] shrink-0 text-slate-700">Data Source:</label>
                    <select
                      value={currentNamedSource}
                      onChange={(e) => setNamedSource(e.target.value)}
                      className="flex-1 border border-[#a4bed8] rounded px-2 py-0.8 text-[11px] bg-white text-slate-800 focus:outline-[#0078d7]"
                    >
                      {availableNamedSources.map((ns) => (
                        <option key={ns} value={ns}>
                          {ns}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Radio 4: Unlimited quantity (print until cancelled) */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer font-normal text-slate-800 text-[11.5px]">
                  <input
                    type="radio"
                    name={`quantitySource_${activeCategory}`}
                    checked={currentSourceType === 'unlimited'}
                    onChange={() => setSourceType('unlimited')}
                    className="accent-[#0078d7]"
                  />
                  <span>Unlimited quantity (print until cancelled)</span>
                </label>
              </div>
            </fieldset>
          </div>
        </div>

        {/* Dialog Footer */}
        <div className="border-t border-[#cbdbe9] bg-[#edf3f9] px-3 py-2 flex items-center justify-between shrink-0">
          <div />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOk}
              className="w-20 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-medium rounded text-[11.5px] shadow-2xs cursor-pointer text-center"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-20 py-1 border border-[#a4bed8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                alert(
                  'Print Quantity Options:\n\n• Specify quantity in print dialog: Sets a fixed number of serial numbers or copies.\n• Get quantity from database field: Dynamically reads the quantity from the connected database record.\n• Get quantity from data source: Dynamically resolves quantity from a named source or variable.\n• Unlimited quantity: Continuously prints serialized labels until manually stopped.'
                )
              }
              className="w-20 py-1 border border-[#a4bed8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer text-center"
            >
              Help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
