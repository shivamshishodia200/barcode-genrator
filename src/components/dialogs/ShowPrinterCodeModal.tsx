import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode } from 'lucide-react';

export interface ShowPrinterCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawCode: string;
  format: string;
  printerName: string;
}

export const ShowPrinterCodeModal: React.FC<ShowPrinterCodeModalProps> = ({
  isOpen,
  onClose,
  rawCode,
  format,
  printerName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleSaveAs = () => {
    const ext = format.toLowerCase() === 'zpl' ? 'zpl' : format.toLowerCase() === 'tspl' ? 'txt' : 'prn';
    const blob = new Blob([rawCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PrintJob_${format.toUpperCase()}_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lineCount = rawCode.split('\n').length;
  const byteCount = new Blob([rawCode]).size;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 select-none font-sans text-xs">
      <div className="w-[640px] max-w-[95vw] h-[520px] max-h-[90vh] bg-[#f4f7fb] border border-[#7d9ebc] rounded-md shadow-2xl overflow-hidden flex flex-col text-slate-800">
        {/* Title Bar */}
        <div className="h-8 bg-gradient-to-r from-[#e8edf5] to-[#d8e3f0] border-b border-[#b8c9db] flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-800 text-[12px]">
              Generated Printer Code [{format.toUpperCase()}] &mdash; {printerName}
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

        {/* Info Header */}
        <div className="px-3 py-1.5 bg-[#fafcff] border-b border-[#cbdbe9] flex items-center justify-between text-[11px] text-slate-600 shrink-0">
          <div>
            Format: <span className="font-bold text-slate-800 uppercase">{format}</span> | Lines: <span className="font-semibold">{lineCount}</span> | Size: <span className="font-semibold">{byteCount} bytes</span>
          </div>
          <div className="text-slate-500 italic">
            Read-only native printer instruction stream
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-3 bg-white overflow-hidden flex flex-col min-h-0">
          <textarea
            readOnly
            value={rawCode}
            className="w-full h-full p-2.5 bg-[#1e222b] text-[#7ee787] font-mono text-[11.5px] rounded border border-[#cbdbe9] focus:outline-none resize-none selection:bg-blue-600 selection:text-white"
          />
        </div>

        {/* Bottom Actions */}
        <div className="h-11 bg-[#f4f7fb] border-t border-[#cbdbe9] px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-[#a4bed8] rounded text-slate-800 text-[11px] font-medium shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Code'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAs}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-[#a4bed8] rounded text-slate-800 text-[11px] font-medium shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Save As...</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] hover:from-white hover:to-[#ebf3fc] border border-[#a4bed8] rounded text-slate-800 text-[11.5px] font-medium shadow-2xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
