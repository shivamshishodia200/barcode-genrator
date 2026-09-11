import React, { useState } from 'react';
import { X, Code2, Plus, Trash2, Check } from 'lucide-react';

export interface CodeModifierRule {
  find: string;
  replace: string;
}

export interface PrinterCodeModifierConfig {
  enabled: boolean;
  prefix: string;
  suffix: string;
  rules: CodeModifierRule[];
}

export interface PrinterCodeModifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PrinterCodeModifierConfig;
  onSaveConfig: (config: PrinterCodeModifierConfig) => void;
}

export const PrinterCodeModifierModal: React.FC<PrinterCodeModifierModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [enabled, setEnabled] = useState(config.enabled ?? false);
  const [prefix, setPrefix] = useState(config.prefix || '');
  const [suffix, setSuffix] = useState(config.suffix || '');
  const [rules, setRules] = useState<CodeModifierRule[]>(config.rules || []);

  if (!isOpen) return null;

  const handleAddRule = () => {
    setRules([...rules, { find: '', replace: '' }]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: 'find' | 'replace', value: string) => {
    const next = [...rules];
    next[index] = { ...next[index], [field]: value };
    setRules(next);
  };

  const handleSave = () => {
    onSaveConfig({
      enabled,
      prefix,
      suffix,
      rules: rules.filter((r) => r.find.trim().length > 0),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 select-none font-sans text-xs">
      <div className="w-[520px] max-w-[95vw] bg-[#f4f7fb] border border-[#7d9ebc] rounded-md shadow-2xl overflow-hidden flex flex-col text-slate-800">
        {/* Title Bar */}
        <div className="h-8 bg-gradient-to-r from-[#e8edf5] to-[#d8e3f0] border-b border-[#b8c9db] flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-800 text-[12px]">
              Printer Code Modifier
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-red-600 hover:text-white rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 bg-white space-y-3 flex-1 overflow-y-auto">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-[11.5px]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-[#a4bed8] text-blue-600"
            />
            <span>Enable Printer Code Modification on Job Dispatch</span>
          </label>

          <div className="space-y-2.5 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Prefix Commands (Prepended to top of job):
              </label>
              <textarea
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. ^XA^PW800"
                rows={2}
                className="w-full p-2 bg-white border border-[#a4bed8] rounded font-mono text-[11px] focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Suffix Commands (Appended to end of job):
              </label>
              <textarea
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="e.g. ^XZ"
                rows={2}
                className="w-full p-2 bg-white border border-[#a4bed8] rounded font-mono text-[11px] focus:outline-blue-500"
              />
            </div>

            {/* Find and Replace Table */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Command Substitution Rules:
                </label>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#f0f5fc] hover:bg-[#e2eefb] border border-[#a4bed8] rounded text-blue-700 font-medium text-[10.5px]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Rule</span>
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="p-2.5 bg-slate-50 border border-dashed border-[#cbdbe9] rounded text-center text-slate-500 text-[11px]">
                  No substitution rules configured.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {rules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Find command / text"
                        value={rule.find}
                        onChange={(e) => handleRuleChange(idx, 'find', e.target.value)}
                        className="flex-1 px-2 py-1 bg-white border border-[#a4bed8] rounded font-mono text-[11px]"
                      />
                      <span className="text-slate-400 font-bold">&rarr;</span>
                      <input
                        type="text"
                        placeholder="Replace with"
                        value={rule.replace}
                        onChange={(e) => handleRuleChange(idx, 'replace', e.target.value)}
                        className="flex-1 px-2 py-1 bg-white border border-[#a4bed8] rounded font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="h-11 bg-[#f4f7fb] border-t border-[#cbdbe9] px-3 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1 bg-[#1973e8] hover:bg-[#1557b0] text-white border border-[#1350a2] rounded text-[11.5px] font-bold shadow-2xs transition-colors cursor-pointer"
          >
            Save Changes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
