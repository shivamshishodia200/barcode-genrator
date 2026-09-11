import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Info } from 'lucide-react';
import {
  UNICODE_SUBSETS,
  AVAILABLE_FONTS,
  CONTROL_CHARACTERS,
  ControlCharacterInfo,
  getRecentSymbols,
  addRecentSymbol,
  getCharacterName,
  getUnicodeHex,
  parseUnicodeInput,
} from '../../services/symbolService';

export interface SpecialCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (char: string, size?: string) => void;
  currentFont?: string;
}

export const SpecialCharacterModal: React.FC<SpecialCharacterModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  currentFont = 'Arial',
}) => {
  const [activeTab, setActiveTab] = useState<'symbols' | 'controls'>('symbols');
  const [selectedFont, setSelectedFont] = useState<string>(currentFont);
  const [selectedSubsetId, setSelectedSubsetId] = useState<string>('basic_latin');
  const [selectedChar, setSelectedChar] = useState<string>('©');
  const [unicodeHexInput, setUnicodeHexInput] = useState<string>('00A9');
  const [selectedSize, setSelectedSize] = useState<string>('Auto');
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const [selectedControl, setSelectedControl] = useState<ControlCharacterInfo>(
    CONTROL_CHARACTERS.find((c) => c.abbr === 'GS') || CONTROL_CHARACTERS[0]
  );
  const [controlSearch, setControlSearch] = useState<string>('');

  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Initialize on modal open
  useEffect(() => {
    if (isOpen) {
      setRecentSymbols(getRecentSymbols());
      if (currentFont && AVAILABLE_FONTS.includes(currentFont)) {
        setSelectedFont(currentFont);
      }
      // default selection
      setSelectedChar('©');
      setUnicodeHexInput(getUnicodeHex('©'));
    }
  }, [isOpen, currentFont]);

  // Current subset definition
  const currentSubset = useMemo(() => {
    return UNICODE_SUBSETS.find((s) => s.id === selectedSubsetId) || UNICODE_SUBSETS[0];
  }, [selectedSubsetId]);

  // Generate characters for the current subset
  const subsetCharacters = useMemo(() => {
    const chars: string[] = [];
    for (let code = currentSubset.start; code <= currentSubset.end; code++) {
      try {
        chars.push(String.fromCodePoint(code));
      } catch {
        // skip unassigned / invalid code points
      }
    }
    return chars;
  }, [currentSubset]);

  // Filtered control characters
  const filteredControls = useMemo(() => {
    if (!controlSearch.trim()) return CONTROL_CHARACTERS;
    const q = controlSearch.toLowerCase().trim();
    return CONTROL_CHARACTERS.filter(
      (c) =>
        c.abbr.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.code.toString().includes(q) ||
        c.hex.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [controlSearch]);

  if (!isOpen) return null;

  // Handle character selection in grid
  const handleSelectChar = (char: string) => {
    setSelectedChar(char);
    setUnicodeHexInput(getUnicodeHex(char));
  };

  // Handle hex input change
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setUnicodeHexInput(val);
    const parsed = parseUnicodeInput(val);
    if (parsed.valid && parsed.char) {
      setSelectedChar(parsed.char);
      // Auto-switch subset if character is outside current subset
      const code = parsed.code!;
      const matchSubset = UNICODE_SUBSETS.find((s) => code >= s.start && code <= s.end);
      if (matchSubset && matchSubset.id !== selectedSubsetId) {
        setSelectedSubsetId(matchSubset.id);
      }
    }
  };

  // Insert Action
  const handleInsert = () => {
    if (activeTab === 'symbols') {
      if (selectedChar) {
        onInsert(selectedChar, selectedSize);
        const updated = addRecentSymbol(selectedChar);
        setRecentSymbols(updated);
      }
    } else {
      if (selectedControl) {
        onInsert(selectedControl.char, selectedSize);
      }
    }
  };

  // Double click insert
  const handleDoubleClickChar = (char: string) => {
    handleSelectChar(char);
    onInsert(char, selectedSize);
    const updated = addRecentSymbol(char);
    setRecentSymbols(updated);
  };

  const handleDoubleClickControl = (ctrl: ControlCharacterInfo) => {
    setSelectedControl(ctrl);
    onInsert(ctrl.char, selectedSize);
  };

  // Keyboard navigation for grid
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      handleInsert();
      return;
    }

    if (activeTab === 'symbols' && subsetCharacters.length > 0) {
      const currentIndex = subsetCharacters.indexOf(selectedChar);
      const cols = 16;
      let nextIndex = currentIndex;

      if (e.key === 'ArrowRight') {
        nextIndex = Math.min(subsetCharacters.length - 1, currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        nextIndex = Math.max(0, currentIndex - 1);
      } else if (e.key === 'ArrowDown') {
        nextIndex = Math.min(subsetCharacters.length - 1, currentIndex + cols);
      } else if (e.key === 'ArrowUp') {
        nextIndex = Math.max(0, currentIndex - cols);
      }

      if (nextIndex !== currentIndex && nextIndex >= 0) {
        e.preventDefault();
        handleSelectChar(subsetCharacters[nextIndex]);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/45 z-[9999] flex items-center justify-center select-none"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-[#f0f0f0] border border-[#707070] shadow-2xl rounded-sm w-[640px] max-w-[95vw] flex flex-col overflow-hidden text-[12px] font-sans">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#e6edf8] via-[#d6e3f5] to-[#c5d8f1] border-b border-[#a0b0c6] px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[#003366] font-bold text-sm">Ω</span>
            <span className="font-semibold text-slate-800 text-[12.5px]">Insert Symbols or Special Characters</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-5 flex items-center justify-center bg-[#c92a2a] hover:bg-[#a61e1e] active:bg-[#861818] text-white rounded-xs shadow-xs cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex items-center gap-1 px-3 pt-2 bg-[#f0f0f0] border-b border-[#c0c0c0]">
          <button
            type="button"
            onClick={() => setActiveTab('symbols')}
            className={`px-4 py-1 text-[11.5px] font-medium rounded-t-sm border cursor-pointer ${
              activeTab === 'symbols'
                ? 'bg-white border-[#c0c0c0] border-b-white text-slate-900 shadow-xs translate-y-[1px]'
                : 'bg-[#e4e4e4] border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Symbols
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('controls')}
            className={`px-4 py-1 text-[11.5px] font-medium rounded-t-sm border cursor-pointer ${
              activeTab === 'controls'
                ? 'bg-white border-[#c0c0c0] border-b-white text-slate-900 shadow-xs translate-y-[1px]'
                : 'bg-[#e4e4e4] border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Control Characters
          </button>
        </div>

        {/* TAB 1: SYMBOLS */}
        {activeTab === 'symbols' && (
          <div className="p-3 bg-white space-y-2.5 flex-1 flex flex-col">
            {/* Top Controls: Font & Subset */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className="text-slate-700 font-medium whitespace-nowrap">Font:</label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="flex-1 bg-white border border-[#94a3b8] rounded px-2 py-0.8 text-[11.5px] text-slate-800 outline-none focus:border-[#0078d7]"
                >
                  {AVAILABLE_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-slate-700 font-medium whitespace-nowrap">Subset:</label>
                <select
                  value={selectedSubsetId}
                  onChange={(e) => setSelectedSubsetId(e.target.value)}
                  className="flex-1 bg-white border border-[#94a3b8] rounded px-2 py-0.8 text-[11.5px] text-slate-800 outline-none focus:border-[#0078d7]"
                >
                  {UNICODE_SUBSETS.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Unicode Character Grid */}
            <div
              ref={gridContainerRef}
              className="border border-[#707070] bg-white h-[230px] overflow-y-scroll p-1 shadow-inner focus:outline-none"
              tabIndex={0}
            >
              <div className="grid grid-cols-16 gap-[1px] bg-[#d0d0d0] border border-[#d0d0d0]">
                {subsetCharacters.map((char, idx) => {
                  const isSelected = selectedChar === char;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectChar(char)}
                      onDoubleClick={() => handleDoubleClickChar(char)}
                      style={{ fontFamily: selectedFont === 'System Default' ? 'sans-serif' : selectedFont }}
                      title={`Character: ${char} (U+${getUnicodeHex(char)}) - ${getCharacterName(char)}`}
                      className={`h-7 flex items-center justify-center text-sm cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#0078d7] text-white font-bold ring-1 ring-inset ring-white'
                          : 'bg-white hover:bg-[#dbeafe] text-slate-900'
                      }`}
                    >
                      {char}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Character Information Banner */}
            <div className="flex items-center justify-between px-1 text-[11.5px] border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="font-semibold text-slate-800 truncate">
                  {getCharacterName(selectedChar)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <label className="text-slate-600 font-medium">Unicode:</label>
                <input
                  type="text"
                  maxLength={6}
                  value={unicodeHexInput}
                  onChange={handleHexInputChange}
                  className="w-16 bg-white border border-[#94a3b8] rounded px-1.5 py-0.5 text-center font-mono font-bold text-[11.5px] text-slate-900 focus:outline-[#0078d7]"
                />
              </div>
            </div>

            {/* Recently Used Characters Strip */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 block">Recently Used Characters:</label>
              <div className="flex items-center gap-[2px] overflow-x-auto border border-[#94a3b8] bg-[#f8fafc] p-1 rounded-xs">
                {recentSymbols.slice(0, 22).map((sym, idx) => {
                  const isSelected = selectedChar === sym;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectChar(sym)}
                      onDoubleClick={() => handleDoubleClickChar(sym)}
                      title={`${sym} (U+${getUnicodeHex(sym)}) - ${getCharacterName(sym)}`}
                      className={`min-w-[24px] h-6 flex items-center justify-center text-[12.5px] font-sans border rounded-2xs cursor-pointer ${
                        isSelected
                          ? 'bg-[#0078d7] text-white border-[#005a9e] font-bold'
                          : 'bg-white hover:bg-[#e0eeff] text-slate-800 border-[#cbd5e1]'
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONTROL CHARACTERS */}
        {activeTab === 'controls' && (
          <div className="p-3 bg-white space-y-2.5 flex-1 flex flex-col">
            {/* Search filter for control characters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search control characters (e.g. GS, 29, TAB, LF)..."
                  value={controlSearch}
                  onChange={(e) => setControlSearch(e.target.value)}
                  className="w-full bg-white border border-[#94a3b8] rounded pl-8 pr-2.5 py-1 text-[11.5px] text-slate-800 outline-none focus:border-[#0078d7]"
                />
              </div>
            </div>

            {/* Control Characters Table / List */}
            <div className="border border-[#707070] bg-white h-[255px] overflow-y-auto shadow-inner">
              <table className="w-full text-left text-[11.5px] border-collapse">
                <thead className="bg-[#e9ecef] sticky top-0 border-b border-[#cbd5e1] text-slate-700 font-semibold">
                  <tr>
                    <th className="py-1 px-2.5 w-16">Code</th>
                    <th className="py-1 px-2 w-14">Dec</th>
                    <th className="py-1 px-2 w-14">Hex</th>
                    <th className="py-1 px-2 w-44">Name</th>
                    <th className="py-1 px-2">Description / Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredControls.map((ctrl) => {
                    const isSelected = selectedControl?.code === ctrl.code;
                    return (
                      <tr
                        key={ctrl.code}
                        onClick={() => setSelectedControl(ctrl)}
                        onDoubleClick={() => handleDoubleClickControl(ctrl)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#0078d7] text-white font-medium'
                            : 'hover:bg-[#f1f5f9] text-slate-800'
                        }`}
                      >
                        <td className="py-1 px-2.5 font-mono font-bold">
                          <span
                            className={`px-1.5 py-0.2 rounded-2xs text-[10.5px] ${
                              isSelected ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            &lt;{ctrl.abbr}&gt;
                          </span>
                        </td>
                        <td className="py-1 px-2 font-mono">{ctrl.code}</td>
                        <td className="py-1 px-2 font-mono">0x{ctrl.hex}</td>
                        <td className="py-1 px-2 font-medium">{ctrl.name}</td>
                        <td className="py-1 px-2 text-[11px] truncate max-w-[220px]">
                          {ctrl.barcodeUsage || ctrl.description}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Control Character Detail Banner */}
            {selectedControl && (
              <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded p-2 text-[11px] text-slate-700 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-900">
                    &lt;{selectedControl.abbr}&gt; {selectedControl.name} (ASCII {selectedControl.code}, 0x{selectedControl.hex})
                  </span>
                  <p className="text-slate-600 mt-0.5">
                    {selectedControl.barcodeUsage ? (
                      <span className="text-amber-900 font-medium">{selectedControl.barcodeUsage}</span>
                    ) : (
                      selectedControl.description
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-[11.5px] font-medium text-slate-700">Size:</label>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="bg-white border border-[#94a3b8] rounded px-2 py-0.8 text-[11.5px] text-slate-800 outline-none focus:border-[#0078d7]"
            >
              <option value="Auto">Auto</option>
              {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72].map((sz) => (
                <option key={sz} value={`${sz} pt`}>
                  {sz} pt
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInsert}
              className="px-5 py-1 bg-[#0078d7] hover:bg-[#0063b1] active:bg-[#004e8c] text-white font-medium rounded-xs text-[11.5px] shadow-2xs cursor-pointer min-w-[75px]"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] text-slate-800 font-medium rounded-xs text-[11.5px] shadow-2xs cursor-pointer min-w-[75px]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
