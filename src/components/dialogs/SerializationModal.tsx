import React, { useState, useEffect } from 'react';
import { SerializationConfig } from '../../types';
import { generatePreviewSequence, PreviewSequenceItem } from '../../services/serializationEngine';
import { X, Eye, HelpCircle } from 'lucide-react';

interface SerializationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: SerializationConfig) => void;
  initialConfig?: SerializationConfig;
  initialValue?: string;
  prefix?: string;
  suffix?: string;
  recordCount?: number;
}

export const SerializationModal: React.FC<SerializationModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialConfig,
  initialValue = '000001',
  prefix = '',
  suffix = '',
  recordCount = 3,
}) => {
  const [activeTab, setActiveTab] = useState<'serialization' | 'reset'>('serialization');

  // Serialization tab state
  const [action, setAction] = useState<'none' | 'increment' | 'decrement'>('none');
  const [method, setMethod] = useState<'alphanumeric' | 'numeric' | 'alphabetic'>('alphanumeric');
  const [letterCase, setLetterCase] = useState<'uppercase' | 'lowercase'>('uppercase');
  const [preserveCharacters, setPreserveCharacters] = useState<boolean>(true);
  const [incrementBy, setIncrementBy] = useState<number>(1);
  const [event, setEvent] = useState<'standard' | 'item' | 'record' | 'interval'>('standard');
  const [eventInterval, setEventInterval] = useState<number>(1);
  const [copies, setCopies] = useState<number>(1);

  // Reset tab state
  const [resetRule, setResetRule] = useState<'never' | 'manual' | 'start' | 'daily' | 'weekly' | 'monthly' | 'record' | 'change'>('never');
  const [resetValue, setResetValue] = useState<string>('');

  // Preview Sequence modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewSequenceItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setAction(initialConfig.action || 'none');
        setMethod(initialConfig.method || 'alphanumeric');
        setLetterCase(initialConfig.letterCase || 'uppercase');
        setPreserveCharacters(initialConfig.preserveCharacters !== false);
        setIncrementBy(initialConfig.incrementBy || 1);
        setEvent(initialConfig.event || 'standard');
        setEventInterval(initialConfig.eventInterval || 1);
        setCopies(initialConfig.copies || 1);
        setResetRule(initialConfig.resetRule || 'never');
        setResetValue(initialConfig.resetValue || '');
      } else {
        setAction('none');
        setMethod('alphanumeric');
        setLetterCase('uppercase');
        setPreserveCharacters(true);
        setIncrementBy(1);
        setEvent('standard');
        setEventInterval(1);
        setCopies(1);
        setResetRule('never');
        setResetValue('');
      }
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const isEnabled = action !== 'none';

  const handleOpenPreview = () => {
    const config: SerializationConfig = {
      action,
      method,
      letterCase,
      preserveCharacters,
      incrementBy,
      event,
      eventInterval,
      copies,
      resetRule,
      resetValue,
    };
    const seq = generatePreviewSequence(initialValue, config, {
      recordCount: Math.max(1, recordCount),
      copies,
      prefix,
      suffix,
      maxItems: 30,
    });
    setPreviewItems(seq);
    setShowPreviewModal(true);
  };

  const handleOk = () => {
    const config: SerializationConfig = {
      action,
      method,
      letterCase,
      preserveCharacters,
      incrementBy,
      event,
      eventInterval,
      copies,
      resetRule,
      resetValue,
    };
    onApply(config);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 font-sans select-none animate-in fade-in duration-100">
        <div
          className="w-[520px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title Bar */}
          <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-3 py-1.5 flex items-center justify-between">
            <span className="font-semibold text-slate-900 text-[12.5px]">Serialization</span>
            <button
              onClick={onClose}
              className="w-7 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs shadow-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Modal Header Tabs */}
          <div className="flex border-b border-[#cbd5e1] bg-[#e2e8f0] px-3 pt-1.5 gap-1">
            <button
              onClick={() => setActiveTab('serialization')}
              className={`px-3 py-1 text-[11.5px] font-medium rounded-t border-t border-x cursor-pointer transition-colors ${
                activeTab === 'serialization'
                  ? 'bg-white border-[#cbd5e1] text-slate-900 shadow-2xs font-semibold'
                  : 'border-transparent text-slate-600 hover:bg-slate-200'
              }`}
            >
              Serialization
            </button>
            <button
              onClick={() => setActiveTab('reset')}
              className={`px-3 py-1 text-[11.5px] font-medium rounded-t border-t border-x cursor-pointer transition-colors ${
                activeTab === 'reset'
                  ? 'bg-white border-[#cbd5e1] text-slate-900 shadow-2xs font-semibold'
                  : 'border-transparent text-slate-600 hover:bg-slate-200'
              }`}
            >
              Reset
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 bg-white min-h-[350px] space-y-3.5 overflow-y-auto">
            {activeTab === 'serialization' && (
              <>
                {/* Action Radio Group */}
                <div className="flex items-center gap-6 pb-2 border-b border-slate-100">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      name="serialAction"
                      checked={action === 'none'}
                      onChange={() => setAction('none')}
                      className="accent-[#0078d7]"
                    />
                    <span>Don't Serialize</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      name="serialAction"
                      checked={action === 'increment'}
                      onChange={() => setAction('increment')}
                      className="accent-[#0078d7]"
                    />
                    <span>Increment</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      name="serialAction"
                      checked={action === 'decrement'}
                      onChange={() => setAction('decrement')}
                      className="accent-[#0078d7]"
                    />
                    <span>Decrement</span>
                  </label>
                </div>

                {/* Method & Letters */}
                <div className={`space-y-2.5 ${!isEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <label className="w-24 text-slate-600 text-[11.5px]">Method:</label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as any)}
                      className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7]"
                    >
                      <option value="alphanumeric">Alphabetic and/or Numeric</option>
                      <option value="numeric">Numeric Only</option>
                      <option value="alphabetic">Alphabetic Only</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="w-24 text-slate-600 text-[11.5px]">Letters:</label>
                    <select
                      value={letterCase}
                      onChange={(e) => setLetterCase(e.target.value as any)}
                      disabled={method === 'numeric'}
                      className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7] disabled:bg-slate-100"
                    >
                      <option value="uppercase">Uppercase A-Z</option>
                      <option value="lowercase">Lowercase a-z</option>
                    </select>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-[11.5px]">
                      <input
                        type="checkbox"
                        checked={preserveCharacters}
                        onChange={(e) => setPreserveCharacters(e.target.checked)}
                        className="accent-[#0078d7]"
                      />
                      <span>Preserve the number of characters</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <label className="w-24 text-slate-600 text-[11.5px]">Increment by:</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={incrementBy}
                      onChange={(e) => setIncrementBy(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 border border-[#cbd5e1] rounded px-2 py-0.8 text-[11.5px] text-slate-800 focus:outline-[#0078d7]"
                    />
                  </div>

                  {/* When to Increment Fieldset */}
                  <fieldset className="border border-[#cbd5e1] rounded p-2.5 space-y-2 mt-2">
                    <legend className="text-[11px] font-semibold text-slate-700 px-1">When to Increment</legend>
                    <div className="flex items-center justify-between gap-3">
                      <label className="w-24 text-slate-600 text-[11px]">Event:</label>
                      <select
                        value={event}
                        onChange={(e) => setEvent(e.target.value as any)}
                        className="flex-1 border border-[#cbd5e1] rounded px-2 py-0.8 text-[11px] bg-white text-slate-800"
                      >
                        <option value="standard">Standard (the "Serial Numbers" setting sets event frequency)</option>
                        <option value="item">Per Printed Item</option>
                        <option value="record">Per Record</option>
                        <option value="interval">Event Interval</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-24 text-slate-600 text-[11px]">Event interval:</label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={eventInterval}
                        onChange={(e) => setEventInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-24 border border-[#cbd5e1] rounded px-2 py-0.8 text-[11px] text-slate-800"
                      />
                    </div>
                  </fieldset>

                  {/* Print Quantity Fieldset */}
                  <fieldset className="border border-[#cbd5e1] rounded p-2.5 space-y-1.5 mt-2">
                    <legend className="text-[11px] font-semibold text-slate-700 px-1">Print Quantity</legend>
                    <p className="text-[10.5px] text-slate-500">
                      These controls are global and can also be set from the Print Dialog.
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      <label className="w-24 text-slate-600 text-[11px]">Copies:</label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={copies}
                        onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-24 border border-[#cbd5e1] rounded px-2 py-0.8 text-[11px] text-slate-800"
                      />
                    </div>
                  </fieldset>

                  {/* Preview Sequence Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="px-3 py-1.5 border border-[#94a3b8] hover:bg-slate-100 rounded text-slate-800 text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Preview Sequence...</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'reset' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="w-28 text-slate-600 text-[11.5px]">Reset Rule:</label>
                  <select
                    value={resetRule}
                    onChange={(e) => setResetRule(e.target.value as any)}
                    className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] bg-white text-slate-800 focus:outline-[#0078d7]"
                  >
                    <option value="never">Never</option>
                    <option value="manual">Manual</option>
                    <option value="start">At Print Start</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="record">Record Boundary</option>
                    <option value="change">Value Change</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="w-28 text-slate-600 text-[11.5px]">Reset Value:</label>
                  <input
                    type="text"
                    value={resetValue}
                    onChange={(e) => setResetValue(e.target.value)}
                    placeholder="e.g. 000001 or A"
                    className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] text-slate-800 focus:outline-[#0078d7]"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 space-y-1">
                  <p className="font-semibold">Reset Behavior:</p>
                  <p>When the selected condition occurs, the serial counter resets to the specified Reset Value.</p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="border-t border-[#cbd5e1] bg-[#f1f5f9] px-3 py-2 flex items-center justify-between">
            <button
              onClick={() => alert('BarTender-compatible Serialization Engine documentation.')}
              className="px-3 py-1 border border-[#94a3b8] hover:bg-slate-200 rounded text-slate-700 text-[11.5px] flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Help</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOk}
                className="px-4 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-medium rounded text-[11.5px] shadow-2xs cursor-pointer"
              >
                OK
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1 border border-[#94a3b8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Non-destructive Preview Sequence Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 font-sans select-none animate-in fade-in duration-100">
          <div className="w-[580px] max-w-full bg-white rounded-lg shadow-2xl border border-slate-400 flex flex-col overflow-hidden text-slate-800 text-[12px]">
            <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between">
              <span className="font-semibold text-[12.5px]">Preview Sequence (Non-Destructive)</span>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="w-6 h-5 flex items-center justify-center hover:bg-red-600 text-white rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 max-h-[380px] overflow-y-auto">
              <p className="text-[11px] text-slate-500 mb-2">
                This preview calculates simulated serialization without advancing persistent counter state.
              </p>
              <table className="w-full text-left text-[11.5px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                    <th className="p-1.5 border-r border-slate-300 w-16 text-center">Print #</th>
                    <th className="p-1.5 border-r border-slate-300 w-16 text-center">Record #</th>
                    <th className="p-1.5 border-r border-slate-300 w-16 text-center">Copy #</th>
                    <th className="p-1.5 border-r border-slate-300 font-mono">Serialized Value</th>
                    <th className="p-1.5 font-mono text-emerald-700 font-semibold">Final Value</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item) => (
                    <tr key={item.printIndex} className="border-b border-slate-200 hover:bg-blue-50">
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-600 font-mono">{item.printIndex}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-600 font-mono">{item.recordIndex}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-600 font-mono">{item.copyIndex}</td>
                      <td className="p-1.5 border-r border-slate-200 font-mono font-medium text-slate-900">{item.serializedValue}</td>
                      <td className="p-1.5 font-mono font-bold text-emerald-700">{item.finalValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 flex justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11.5px] font-medium cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
