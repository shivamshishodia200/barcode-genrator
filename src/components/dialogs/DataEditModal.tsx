import React, { useState, useEffect, useRef } from 'react';
import { BarcodeElement, TextElement, LabelElement, DataSourceItem } from '../../types';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { X, HelpCircle } from 'lucide-react';
import { SpecialCharacterModal } from './SpecialCharacterModal';

interface DataEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: LabelElement | null;
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void;
  onOpenDataSources?: (element: LabelElement) => void;
}

/**
 * BarTender-Style Classic "Data Edit" Dialog
 * Activated by the Data Edit Tool in the toolbar when clicking any barcode or text object.
 * Allows instant direct editing of embedded data with immediate canvas reflection and Undo/Redo.
 * Features the [Data Source...] button to seamlessly navigate to full Barcode Properties,
 * and the [ Ω ] button to insert special Unicode symbols and control characters.
 */
export const DataEditModal: React.FC<DataEditModalProps> = ({
  isOpen,
  onClose,
  element,
  onUpdateElement,
  onOpenDataSources,
}) => {
  const [dataValue, setDataValue] = useState<string>('');
  const [isSpecialCharModalOpen, setIsSpecialCharModalOpen] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && element) {
      if (element.dataSources && element.dataSources.length > 0) {
        setDataValue(element.dataSources[0]?.value ?? '');
      } else if (element.type === 'barcode') {
        setDataValue((element as BarcodeElement).value || '');
      } else if (element.type === 'text') {
        setDataValue((element as TextElement).text || '');
      } else {
        setDataValue((element as any).value || (element as any).content || '');
      }
    }
  }, [isOpen, element]);

  if (!isOpen || !element) return null;

  const handleInsertSymbol = (symbol: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? dataValue.length;
      const end = textarea.selectionEnd ?? dataValue.length;
      const nextVal = dataValue.substring(0, start) + symbol + dataValue.substring(end);
      setDataValue(nextVal);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = start + symbol.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    } else {
      setDataValue((prev) => prev + symbol);
    }
  };

  const handleOk = () => {
    const trimmedVal = dataValue;
    let updatedDsList: DataSourceItem[] | undefined = undefined;

    if (element.dataSources && element.dataSources.length > 0) {
      updatedDsList = element.dataSources.map((ds, idx) => {
        if (idx === 0) {
          // If serialization is enabled, update base value safely without deleting settings
          const currentSerial = ds.serialization || ds.transformConfig?.serialization;
          return {
            ...ds,
            value: trimmedVal,
            ...(currentSerial
              ? {
                  serialization: {
                    ...currentSerial,
                    currentValue: trimmedVal,
                  },
                }
              : {}),
            ...(ds.transformConfig
              ? {
                  transformConfig: {
                    ...ds.transformConfig,
                    ...(currentSerial
                      ? {
                          serialization: {
                            ...currentSerial,
                            currentValue: trimmedVal,
                          },
                        }
                      : {}),
                  },
                }
              : {}),
          };
        }
        return ds;
      });
    } else {
      const newDs: DataSourceItem = {
        id: `ds-${Date.now()}`,
        name: 'Embedded Data',
        type: 'embedded',
        value: trimmedVal,
        enabled: true,
      };
      updatedDsList = [newDs];
    }

    const simulatedEl = { ...element, dataSources: updatedDsList };
    const compiled = evaluateElementData(simulatedEl as any);

    onUpdateElement(element.id, {
      dataSources: updatedDsList,
      ...(element.type === 'barcode' ? { value: compiled || trimmedVal } : {}),
      ...(element.type === 'text' ? { text: compiled || trimmedVal } : {}),
    });

    onClose();
  };

  const handleOpenDataSources = () => {
    onClose();
    if (onOpenDataSources && element) {
      onOpenDataSources(element);
    }
  };

  const handleHelp = () => {
    alert(
      'Data Edit Tool:\n\nAllows quick modification of the primary embedded value for barcode and text objects.\nClick "Ω" to insert Unicode symbols / control characters.\nClick "Data Source..." to configure Advanced Data Sources, Symbology, Transforms, or Serialization.'
    );
  };

  const elementFont = (element as any).fontFamily || 'Arial';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none font-sans"
      onClick={onClose}
    >
      <div
        className="w-[440px] max-w-full bg-[#f0f4f9] rounded-sm shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Classic Windows Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1 flex items-center justify-between">
          <span className="font-semibold text-slate-900 text-[12px]">Data Edit</span>
          <button
            onClick={onClose}
            className="w-7 h-4.5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs shadow-xs cursor-pointer"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11.5px] font-medium text-slate-700">Embedded Data</label>
            <button
              type="button"
              title="Insert Symbols or Special Characters"
              onClick={() => setIsSpecialCharModalOpen(true)}
              className="px-2 py-0.5 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-sm cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <span>Ω</span>
              <span className="text-[10.5px] font-sans font-normal text-slate-700">Symbols...</span>
            </button>
          </div>
          <div className="flex items-start gap-2.5">
            <textarea
              ref={textareaRef}
              rows={4}
              value={dataValue}
              onChange={(e) => setDataValue(e.target.value)}
              autoFocus
              className="flex-1 bg-white border border-[#94a3b8] rounded-xs p-2 font-mono text-sm text-slate-900 focus:outline-[#0078d7] resize-none"
              placeholder="Enter embedded data..."
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                title="Insert Symbols or Special Characters"
                onClick={() => setIsSpecialCharModalOpen(true)}
                className="w-9 h-8 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-base cursor-pointer shadow-2xs flex items-center justify-center"
              >
                Ω
              </button>
              <button
                type="button"
                onClick={handleOpenDataSources}
                className="px-3 py-1.5 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-slate-800 text-[11px] font-medium shadow-2xs cursor-pointer whitespace-nowrap"
              >
                Data Source...
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-center gap-2">
          <button
            onClick={handleOk}
            className="px-6 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-medium rounded-xs text-[11.5px] shadow-2xs cursor-pointer min-w-[75px]"
          >
            OK
          </button>
          <button
            onClick={onClose}
            className="px-6 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] text-slate-800 font-medium rounded-xs text-[11.5px] shadow-2xs cursor-pointer min-w-[75px]"
          >
            Cancel
          </button>
          <button
            onClick={handleHelp}
            className="px-6 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] text-slate-800 font-medium rounded-xs text-[11.5px] shadow-2xs cursor-pointer min-w-[75px]"
          >
            Help
          </button>
        </div>
      </div>

      {/* Insert Symbols or Special Characters Modal */}
      <SpecialCharacterModal
        isOpen={isSpecialCharModalOpen}
        onClose={() => setIsSpecialCharModalOpen(false)}
        onInsert={handleInsertSymbol}
        currentFont={elementFont}
      />
    </div>
  );
};
