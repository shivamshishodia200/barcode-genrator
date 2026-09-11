import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TextElement,
  DataSourceItem,
  DataSourceType,
  SerializationConfig,
  TransformConfig,
  BorderConfig,
  ArcConfig,
  AutoSizeConfig,
  ReferencePoint,
} from '../../types';
import { evaluateElementData, evaluateTextElement, formatCustomDate } from '../../services/dataSourceEngine';
import { SerializationModal } from './SerializationModal';
import {
  SuppressionModal,
  CharacterFilterModal,
  TruncationModal,
  CharacterLengthModal,
  CharacterTemplateModal,
  SearchReplaceModal,
  ScriptTransformModal,
  PrefixSuffixModal,
} from './TransformSubModals';
import {
  X,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Lock,
  Search,
  Sparkles,
  Layers,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { DatabaseFieldSourceConfig } from './DatabaseFieldSourceConfig';
import { NewDataSourceWizardModal } from './NewDataSourceWizardModal';
import { SpecialCharacterModal } from './SpecialCharacterModal';

interface TextPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: TextElement | null;
  onUpdateElement: (id: string, updates: Partial<TextElement>) => void;
  availableVariables?: Array<{ name: string; label?: string; sampleValue?: string }>;
  datasets?: any[];
  currentRecord?: Record<string, any>;
  currentConnection?: any;
  onConnectDataset?: (dataset: any) => void;
}

type TextCategory =
  | 'font'
  | 'text-format'
  | 'border'
  | 'position'
  | 'datasources'
  | 'datasource-item';

export const TextPropertiesModal: React.FC<TextPropertiesModalProps> = ({
  isOpen,
  onClose,
  element,
  onUpdateElement,
  availableVariables = [],
  datasets,
  currentRecord,
  currentConnection,
  onConnectDataset,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TextCategory>('datasource-item');
  const [activeDsIndex, setActiveDsIndex] = useState<number>(0);
  const [activeDsTab, setActiveDsTab] = useState<'source' | 'type' | 'transforms'>('source');

  // Font sub-tabs
  const [fontSubTab, setFontSubTab] = useState<'style' | 'outline' | 'width' | 'advanced'>('style');
  // Text Format sub-tabs
  const [formatSubTab, setFormatSubTab] = useState<'autosize' | 'tabs' | 'effects'>('autosize');

  // Working Draft State (reverts on Cancel/X, commits on OK)
  const [draftElement, setDraftElement] = useState<TextElement | null>(null);

  // System fonts
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [fontSearch, setFontSearch] = useState('');

  // Transform Sub-Modal controls
  const [activeTransformModal, setActiveTransformModal] = useState<
    'suppression' | 'filter' | 'truncation' | 'length' | 'template' | 'searchReplace' | 'script' | 'serialization' | 'prefixSuffix' | null
  >(null);

  // New Data Source Wizard
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  // Insert Symbols or Special Characters Modal
  const [isSpecialCharModalOpen, setIsSpecialCharModalOpen] = useState<boolean>(false);
  const embeddedTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertSpecialChar = (symbol: string) => {
    const textarea = embeddedTextareaRef.current;
    const currentVal = activeDataSource.value || '';
    if (textarea) {
      const start = textarea.selectionStart ?? currentVal.length;
      const end = textarea.selectionEnd ?? currentVal.length;
      const nextVal = currentVal.substring(0, start) + symbol + currentVal.substring(end);
      updateActiveDs({ value: nextVal });
      setTimeout(() => {
        if (embeddedTextareaRef.current) {
          embeddedTextareaRef.current.focus();
          const newPos = start + symbol.length;
          embeddedTextareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    } else {
      updateActiveDs({ value: currentVal + symbol });
    }
  };

  // Physical units for position
  const [posUnit, setPosUnit] = useState<'mm' | 'cm' | 'inch'>('mm');

  // Load system fonts via IPC on mount
  useEffect(() => {
    let isMounted = true;
    const loadFonts = async () => {
      try {
        const electronAPI = (window as any).electronAPI;
        const barcodeFlow = (window as any).barcodeFlow;
        let list: string[] = [];
        if (electronAPI?.getFonts) {
          list = await electronAPI.getFonts();
        } else if (barcodeFlow?.fonts?.list) {
          list = await barcodeFlow.fonts.list();
        }
        if (isMounted && list && list.length > 0) {
          setSystemFonts(list);
        }
      } catch (err) {
        console.warn('Could not enumerate system fonts over IPC:', err);
      }
    };
    loadFonts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize draft copy on element change or modal open
  useEffect(() => {
    if (element && isOpen) {
      const copy: TextElement = JSON.parse(JSON.stringify(element));

      // Ensure dataSources array is populated
      if (!copy.dataSources || copy.dataSources.length === 0) {
        copy.dataSources = [
          {
            id: `ds-${Date.now()}`,
            name: 'Sample Text',
            type: copy.dataBinding ? 'variable' : 'embedded',
            value: copy.text || 'Sample Text',
            variableName: copy.dataBinding ? copy.dataBinding.replace(/[{}]/g, '') : undefined,
            enabled: true,
          },
        ];
      }

      // Ensure borderConfig exists
      if (!copy.borderConfig) {
        copy.borderConfig = {
          type: copy.borderType || 'none',
          thickness: copy.borderThickness || 1,
          color: copy.borderColor || '#000000',
          transparency: 0,
          dashStyle: copy.borderDashStyle || 'solid',
          compoundStyle: 'single',
          joinType: copy.borderJoinType || 'mitered',
          fillColor: copy.borderFillColor || '#ffffff',
          fillTransparency: 100,
          cornerType: copy.borderCornerType || 'square',
          cornerSize: copy.borderCornerSize || 0,
          marginTop: copy.borderMargins?.top || 0,
          marginLeft: copy.borderMargins?.left || 0,
          marginBottom: copy.borderMargins?.bottom || 0,
          marginRight: copy.borderMargins?.right || 0,
          sides: copy.borderSides || { top: true, right: true, bottom: true, left: true },
        };
      }

      // Ensure arcConfig exists
      if (!copy.arcConfig) {
        copy.arcConfig = {
          radius: copy.arcRadius || 50,
          startAngle: copy.arcStartAngle || 0,
          sweepAngle: copy.arcSweepAngle || 180,
          direction: copy.arcDirection || 'clockwise',
          insidePath: !!copy.arcInsidePath,
          characterSpacing: copy.arcCharacterSpacing || 1,
        };
      }

      // Ensure autoSizeConfig exists
      if (!copy.autoSizeConfig) {
        copy.autoSizeConfig = {
          enabled: !!copy.autoSize || !!copy.autoFit,
          minFontSize: copy.minFontSize || 6,
          maxFontSize: copy.maxFontSize || 720,
          minWidthScale: copy.minWidthScale || 50,
          maxWidthScale: copy.maxWidthScale || 200,
          objectWidth: copy.width || 40,
          objectHeight: copy.height || 15,
          horizontalAlignment: copy.horizontalAlignment || copy.textAlign || 'left',
          verticalAlignment: copy.verticalAlignment || copy.verticalAlign || 'top',
        };
      }

      setDraftElement(copy);
      setActiveDsIndex(0);
      setSelectedCategory('datasource-item');
    }
  }, [element, isOpen]);

  if (!isOpen || !draftElement) return null;

  const dataSources = draftElement.dataSources || [];
  const currentDsIndex = Math.max(0, Math.min(activeDsIndex, dataSources.length - 1));
  const activeDataSource: DataSourceItem = dataSources[currentDsIndex] || {
    id: 'ds-default',
    name: 'Embedded Source',
    type: 'embedded',
    value: 'Sample Text',
    enabled: true,
  };

  // Helper to update draft
  const updateDraft = (updates: Partial<TextElement>) => {
    setDraftElement((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      // Re-evaluate combined text
      const compiled = evaluateTextElement(updated, { record: currentRecord, datasets });
      updated.text = compiled;
      return updated;
    });
  };

  // Helper to update active data source
  const updateActiveDs = (dsUpdates: Partial<DataSourceItem>) => {
    const updatedSources = dataSources.map((ds, idx) => (idx === currentDsIndex ? { ...ds, ...dsUpdates } : ds));
    updateDraft({ dataSources: updatedSources });
  };

  // Commit changes to canvas
  const handleCommit = () => {
    if (draftElement && element) {
      onUpdateElement(element.id, draftElement);
      onClose();
    }
  };

  // Cancel & Revert
  const handleCancel = () => {
    onClose();
  };

  // Data Source List Operations
  const handleOpenWizard = () => {
    setIsWizardOpen(true);
  };

  const handleWizardAddDataSource = (newDs: DataSourceItem) => {
    const nextList = [...dataSources, newDs];
    updateDraft({ dataSources: nextList });
    setActiveDsIndex(nextList.length - 1);
    setSelectedCategory('datasource-item');
  };

  const handleAddDataSource = (type: DataSourceType = 'embedded') => {
    handleOpenWizard();
  };

  const handleDeleteDataSource = () => {
    if (dataSources.length <= 1) {
      alert('A text object must have at least one data source.');
      return;
    }
    const nextList = dataSources.filter((_, idx) => idx !== currentDsIndex);
    updateDraft({ dataSources: nextList });
    setActiveDsIndex(Math.max(0, currentDsIndex - 1));
  };

  const handleDuplicateDataSource = () => {
    const clone: DataSourceItem = {
      ...JSON.parse(JSON.stringify(activeDataSource)),
      id: `ds-${Date.now()}`,
      name: `${activeDataSource.name} (Copy)`,
    };
    const nextList = [...dataSources.slice(0, currentDsIndex + 1), clone, ...dataSources.slice(currentDsIndex + 1)];
    updateDraft({ dataSources: nextList });
    setActiveDsIndex(currentDsIndex + 1);
  };

  const handleMoveDataSource = (direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? currentDsIndex - 1 : currentDsIndex + 1;
    if (targetIdx < 0 || targetIdx >= dataSources.length) return;
    const nextList = [...dataSources];
    const temp = nextList[currentDsIndex];
    nextList[currentDsIndex] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    updateDraft({ dataSources: nextList });
    setActiveDsIndex(targetIdx);
  };

  // Filtered fonts
  const standardFonts = [
    'Arial',
    'Arial Black',
    'Arial Narrow',
    'Arial Rounded MT Bold',
    'Bahnschrift',
    'Calibri',
    'Cambria',
    'Candara',
    'Century Gothic',
    'Comic Sans MS',
    'Consolas',
    'Courier New',
    'Franklin Gothic Medium',
    'Georgia',
    'Impact',
    'Lucida Console',
    'Microsoft Sans Serif',
    'Segoe UI',
    'Tahoma',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
  ];
  const allAvailableFonts = systemFonts.length > 0 ? systemFonts : standardFonts;
  const filteredFonts = allAvailableFonts.filter((f) => f.toLowerCase().includes(fontSearch.toLowerCase()));

  // Summaries for Transform tab buttons
  const tc = activeDataSource.transformConfig || {};
  const suppressionSummary = tc.suppression && tc.suppression.type !== 'never' ? tc.suppression.type : '<None>';
  const filterSummary = tc.characterFilter && tc.characterFilter.type !== 'none' ? tc.characterFilter.type : '<None>';
  const truncSummary = tc.truncation && tc.truncation.type !== 'none' ? `${tc.truncation.type} (${tc.truncation.count})` : '<None>';
  const lengthSummary = tc.characterLength && (tc.characterLength.min || tc.characterLength.max) ? `Min: ${tc.characterLength.min || 0}, Max: ${tc.characterLength.max || '∞'}` : '<None>';
  const templateSummary = tc.characterTemplate?.template ? tc.characterTemplate.template : '<None>';
  const searchReplaceSummary = tc.searchReplace && tc.searchReplace.length > 0 ? `${tc.searchReplace.length} rule(s)` : '<None>';
  const scriptSummary = tc.script?.code ? tc.script.language || 'script' : '<None>';
  const serialSummary = activeDataSource.serialization && activeDataSource.serialization.action !== 'none'
    ? `${activeDataSource.serialization.action} by ${activeDataSource.serialization.incrementBy || 1}`
    : '<None>';
  const prefixSuffixSummary = activeDataSource.prefixSuffix && (activeDataSource.prefixSuffix.prefix || activeDataSource.prefixSuffix.suffix)
    ? `"${activeDataSource.prefixSuffix.prefix || ''}" ... "${activeDataSource.prefixSuffix.suffix || ''}"`
    : '<None>';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      <div
        className="w-[880px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <Type className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              Text Object Properties — [{draftElement.name}]
            </span>
          </div>

          <button
            onClick={handleCancel}
            title="Close / Cancel"
            className="w-8 h-5 flex items-center justify-center bg-[#e03131] hover:bg-[#c92a2a] text-white rounded-xs ml-1 shadow-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="flex flex-1 min-h-[500px] max-h-[580px] bg-white">
          {/* LEFT SIDEBAR: Object Tree */}
          <div className="w-64 bg-[#f8fafc] border-r border-[#cbd5e1] flex flex-col justify-between select-none">
            <div className="p-2 space-y-0.5 text-[11.5px] overflow-y-auto max-h-[440px]">
              {/* Root Object */}
              <div
                onClick={() => setSelectedCategory('font')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs cursor-pointer font-bold text-slate-900 hover:bg-[#e2e8f0]"
              >
                <span className="text-pink-600 font-serif font-bold text-xs">A</span>
                <span>{draftElement.name}</span>
              </div>

              {/* Font */}
              <div
                onClick={() => setSelectedCategory('font')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                  selectedCategory === 'font'
                    ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                    : 'text-slate-700 hover:bg-[#f1f5f9]'
                }`}
              >
                <span className="font-serif font-bold text-[11px] text-pink-500">Aᵃ</span>
                <span>Font</span>
              </div>

              {/* Text Format */}
              <div
                onClick={() => setSelectedCategory('text-format')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                  selectedCategory === 'text-format'
                    ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                    : 'text-slate-700 hover:bg-[#f1f5f9]'
                }`}
              >
                <AlignLeft className="w-3 h-3 text-slate-500" />
                <span>Text Format</span>
              </div>

              {/* Border */}
              <div
                onClick={() => setSelectedCategory('border')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                  selectedCategory === 'border'
                    ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                    : 'text-slate-700 hover:bg-[#f1f5f9]'
                }`}
              >
                <div className="w-3 h-3 border border-slate-500 rounded-xs" />
                <span>Border</span>
              </div>

              {/* Position */}
              <div
                onClick={() => setSelectedCategory('position')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-0.8 rounded-xs cursor-pointer ${
                  selectedCategory === 'position'
                    ? 'bg-[#0078d7] text-white font-medium shadow-2xs'
                    : 'text-slate-700 hover:bg-[#f1f5f9]'
                }`}
              >
                <Settings className="w-3 h-3 text-slate-500" />
                <span>Position</span>
              </div>

              {/* Data Sources Root */}
              <div
                onClick={() => setSelectedCategory('datasources')}
                className={`flex items-center gap-1.5 pl-6 pr-2 py-1 rounded-xs cursor-pointer font-bold ${
                  selectedCategory === 'datasources'
                    ? 'bg-[#0078d7] text-white shadow-2xs'
                    : 'text-slate-900 hover:bg-[#e2e8f0]'
                }`}
              >
                <span className="bg-slate-300 text-slate-800 text-[9px] px-1 py-0.2 rounded font-mono font-bold">ab</span>
                <span>Data Sources</span>
              </div>

              {/* Data Source Items */}
              {dataSources.map((ds, idx) => {
                const isSelected = selectedCategory === 'datasource-item' && currentDsIndex === idx;
                return (
                  <div
                    key={ds.id || idx}
                    onClick={() => {
                      setActiveDsIndex(idx);
                      setSelectedCategory('datasource-item');
                    }}
                    className={`flex items-center gap-1.5 pl-10 pr-2 py-0.8 rounded-xs cursor-pointer truncate ${
                      isSelected
                        ? 'bg-[#0078d7] text-white font-semibold shadow-2xs'
                        : 'text-slate-700 hover:bg-[#f1f5f9]'
                    }`}
                  >
                    <span className="text-[10px] text-blue-600 font-mono">▪</span>
                    <span className="truncate">{ds.name || ds.value || `Source ${idx + 1}`}</span>
                  </div>
                );
              })}
            </div>

            {/* Tree Toolbar Controls */}
            <div className="p-1.5 border-t border-[#cbd5e1] bg-[#eef2f6] flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(true)}
                  title="New Data Source"
                  className="p-1 border border-[#cbd5e1] hover:bg-white rounded text-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDataSource}
                  title="Delete Data Source"
                  className="p-1 border border-[#cbd5e1] hover:bg-white rounded text-slate-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
                <button
                  type="button"
                  onClick={handleDuplicateDataSource}
                  title="Duplicate Data Source"
                  className="p-1 border border-[#cbd5e1] hover:bg-white rounded text-slate-700 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-600" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveDataSource('up')}
                  disabled={currentDsIndex <= 0}
                  title="Move Up"
                  className="p-1 border border-[#cbd5e1] hover:bg-white rounded text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDataSource('down')}
                  disabled={currentDsIndex >= dataSources.length - 1}
                  title="Move Down"
                  className="p-1 border border-[#cbd5e1] hover:bg-white rounded text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT MAIN PANEL */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-white p-4">
            {/* 1. FONT TAB */}
            {selectedCategory === 'font' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-3">
                  {/* Typeface Search & List */}
                  <div className="col-span-6 space-y-1.5">
                    <label className="text-[11.5px] text-slate-700 font-medium">Typeface:</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fontSearch || draftElement.fontFamily}
                        onChange={(e) => setFontSearch(e.target.value)}
                        placeholder="Search font..."
                        className="w-full border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] focus:outline-[#0078d7]"
                      />
                    </div>
                    <div className="h-36 border border-[#cbd5e1] rounded overflow-y-auto bg-white p-1 space-y-0.5">
                      {filteredFonts.map((f) => (
                        <div
                          key={f}
                          onClick={() => {
                            updateDraft({ fontFamily: f });
                            setFontSearch('');
                          }}
                          className={`px-2 py-1 text-[11.5px] rounded-xs cursor-pointer truncate ${
                            draftElement.fontFamily === f
                              ? 'bg-[#ffe8a1] text-slate-900 font-semibold'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                          style={{ fontFamily: f }}
                        >
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Font Style */}
                  <div className="col-span-3 space-y-1.5">
                    <label className="text-[11.5px] text-slate-700 font-medium">Font Style:</label>
                    <div className="h-[178px] border border-[#cbd5e1] rounded overflow-y-auto bg-white p-1 space-y-0.5">
                      {[
                        { id: 'regular', label: 'Regular', weight: 'normal', style: 'normal' },
                        { id: 'italic', label: 'Italic', weight: 'normal', style: 'italic' },
                        { id: 'bold', label: 'Bold', weight: 'bold', style: 'normal' },
                        { id: 'bold-italic', label: 'Bold Italic', weight: 'bold', style: 'italic' },
                      ].map((st) => {
                        const isCurrent =
                          (draftElement.fontWeight === 'bold' ? 'bold' : 'normal') === st.weight &&
                          (draftElement.fontStyle === 'italic' ? 'italic' : 'normal') === st.style;
                        return (
                          <div
                            key={st.id}
                            onClick={() =>
                              updateDraft({
                                fontWeight: st.weight as any,
                                fontStyle: st.style as any,
                              })
                            }
                            className={`px-2 py-1 text-[11.5px] rounded-xs cursor-pointer ${
                              isCurrent
                                ? 'bg-[#0078d7] text-white font-medium'
                                : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            {st.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Point Size */}
                  <div className="col-span-3 space-y-1.5">
                    <label className="text-[11.5px] text-slate-700 font-medium">Point Size:</label>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={draftElement.fontSize}
                      onChange={(e) => updateDraft({ fontSize: Math.max(1, parseFloat(e.target.value) || 12) })}
                      className="w-full border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px]"
                    />
                    <div className="h-[142px] border border-[#cbd5e1] rounded overflow-y-auto bg-white p-1 space-y-0.5">
                      {[6, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map((sz) => (
                        <div
                          key={sz}
                          onClick={() => updateDraft({ fontSize: sz })}
                          className={`px-2 py-0.8 text-[11.5px] rounded-xs cursor-pointer ${
                            draftElement.fontSize === sz
                              ? 'bg-[#0078d7] text-white font-medium'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          {sz}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Font Sub-Tabs */}
                <div className="border border-[#cbd5e1] rounded p-3 bg-[#f8fafc] space-y-3">
                  <div className="flex border-b border-[#cbd5e1] pb-1.5 gap-4 text-[11.5px]">
                    {['style', 'outline', 'width', 'advanced'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFontSubTab(st as any)}
                        className={`capitalize font-medium pb-0.5 cursor-pointer ${
                          fontSubTab === st
                            ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {fontSubTab === 'style' && (
                    <div className="grid grid-cols-2 gap-4 text-[11.5px]">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!draftElement.underline || draftElement.textDecoration === 'underline'}
                            onChange={(e) =>
                              updateDraft({
                                underline: e.target.checked,
                                textDecoration: e.target.checked ? 'underline' : 'none',
                              })
                            }
                            className="accent-[#0078d7]"
                          />
                          <span>Underline</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!draftElement.strikeout || draftElement.textDecoration === 'line-through'}
                            onChange={(e) =>
                              updateDraft({
                                strikeout: e.target.checked,
                                textDecoration: e.target.checked ? 'line-through' : 'none',
                              })
                            }
                            className="accent-[#0078d7]"
                          />
                          <span>Strikeout</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!draftElement.whiteOnBlack}
                            onChange={(e) =>
                              updateDraft({
                                whiteOnBlack: e.target.checked,
                                color: e.target.checked ? '#ffffff' : '#000000',
                                backgroundColor: e.target.checked ? '#000000' : 'transparent',
                              })
                            }
                            className="accent-[#0078d7]"
                          />
                          <span>White On Black</span>
                        </label>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Foreground Color:</span>
                          <input
                            type="color"
                            value={draftElement.color || '#000000'}
                            onChange={(e) => updateDraft({ color: e.target.value })}
                            className="w-10 h-6 border border-slate-300 rounded cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Background Color:</span>
                          <input
                            type="color"
                            value={draftElement.backgroundColor && draftElement.backgroundColor !== 'transparent' ? draftElement.backgroundColor : '#ffffff'}
                            onChange={(e) => updateDraft({ backgroundColor: e.target.value })}
                            className="w-10 h-6 border border-slate-300 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {fontSubTab === 'width' && (
                    <div className="space-y-2 text-[11.5px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-700">Font Width Scaling (%):</span>
                        <input
                          type="number"
                          min={25}
                          max={400}
                          value={draftElement.fontWidthScale || 100}
                          onChange={(e) => updateDraft({ fontWidthScale: Math.max(25, parseInt(e.target.value, 10) || 100) })}
                          className="w-20 border border-[#cbd5e1] rounded px-2 py-0.5 text-right"
                        />
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={200}
                        value={draftElement.fontWidthScale || 100}
                        onChange={(e) => updateDraft({ fontWidthScale: parseInt(e.target.value, 10) })}
                        className="w-full accent-[#0078d7]"
                      />
                    </div>
                  )}

                  {fontSubTab === 'outline' && (
                    <div className="space-y-2 text-[11.5px]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!draftElement.textOutline?.enabled}
                          onChange={(e) =>
                            updateDraft({
                              textOutline: {
                                enabled: e.target.checked,
                                color: draftElement.textOutline?.color || '#000000',
                                width: draftElement.textOutline?.width || 1,
                              },
                            })
                          }
                          className="accent-[#0078d7]"
                        />
                        <span>Enable Text Outline</span>
                      </label>
                      {draftElement.textOutline?.enabled && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="flex items-center justify-between">
                            <span>Outline Color:</span>
                            <input
                              type="color"
                              value={draftElement.textOutline.color}
                              onChange={(e) =>
                                updateDraft({
                                  textOutline: { ...draftElement.textOutline!, color: e.target.value },
                                })
                              }
                              className="w-10 h-6 border rounded"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Outline Width:</span>
                            <input
                              type="number"
                              min={0.5}
                              max={10}
                              step={0.5}
                              value={draftElement.textOutline.width}
                              onChange={(e) =>
                                updateDraft({
                                  textOutline: { ...draftElement.textOutline!, width: parseFloat(e.target.value) || 1 },
                                })
                              }
                              className="w-16 border rounded px-1.5 py-0.5"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. TEXT FORMAT TAB */}
            {selectedCategory === 'text-format' && (
              <div className="space-y-4">
                {/* Format Type Selection */}
                <div className="flex items-center gap-6 pb-2 border-b border-slate-200">
                  <span className="text-[11.5px] text-slate-700 font-medium">Type:</span>
                  {[
                    { id: 'single-line', label: 'Single Line' },
                    { id: 'paragraph', label: 'Paragraph' },
                    { id: 'arc', label: 'Arc' },
                  ].map((fmt) => (
                    <label key={fmt.id} className="flex items-center gap-1.5 cursor-pointer text-[12px] text-slate-800">
                      <input
                        type="radio"
                        name="textFormatType"
                        checked={(draftElement.textFormatType || draftElement.textType || 'single-line') === fmt.id}
                        onChange={() =>
                          updateDraft({
                            textFormatType: fmt.id as any,
                            textType: fmt.id as any,
                            multiline: fmt.id === 'paragraph',
                            wordWrap: fmt.id === 'paragraph',
                          })
                        }
                        className="accent-[#0078d7]"
                      />
                      <span>{fmt.label}</span>
                    </label>
                  ))}
                </div>

                {/* Sub Tabs: Auto Size, Tabs, Effects, Arc */}
                <div className="border border-[#cbd5e1] rounded p-3 bg-[#f8fafc] space-y-3">
                  <div className="flex border-b border-[#cbd5e1] pb-1.5 gap-4 text-[11.5px]">
                    <button
                      type="button"
                      onClick={() => setFormatSubTab('autosize')}
                      className={`font-medium pb-0.5 cursor-pointer ${
                        formatSubTab === 'autosize'
                          ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Auto Size
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatSubTab('tabs')}
                      className={`font-medium pb-0.5 cursor-pointer ${
                        formatSubTab === 'tabs'
                          ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tabs
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatSubTab('effects')}
                      className={`font-medium pb-0.5 cursor-pointer ${
                        formatSubTab === 'effects'
                          ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Effects
                    </button>
                  </div>

                  {/* Arc Specific Configuration */}
                  {(draftElement.textFormatType === 'arc' || draftElement.textType === 'arc') && (
                    <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded space-y-2.5 text-[11.5px]">
                      <p className="font-semibold text-blue-900">Arc Geometry Properties:</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-600">Radius (mm):</label>
                          <input
                            type="number"
                            min={5}
                            max={500}
                            value={draftElement.arcConfig?.radius || 50}
                            onChange={(e) =>
                              updateDraft({
                                arcConfig: { ...draftElement.arcConfig!, radius: parseFloat(e.target.value) || 50 },
                                arcRadius: parseFloat(e.target.value) || 50,
                              })
                            }
                            className="w-full border rounded px-2 py-0.8 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600">Start Angle (°):</label>
                          <input
                            type="number"
                            min={0}
                            max={360}
                            value={draftElement.arcConfig?.startAngle || 0}
                            onChange={(e) =>
                              updateDraft({
                                arcConfig: { ...draftElement.arcConfig!, startAngle: parseFloat(e.target.value) || 0 },
                                arcStartAngle: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full border rounded px-2 py-0.8 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600">Sweep Angle (°):</label>
                          <input
                            type="number"
                            min={10}
                            max={360}
                            value={draftElement.arcConfig?.sweepAngle || 180}
                            onChange={(e) =>
                              updateDraft({
                                arcConfig: { ...draftElement.arcConfig!, sweepAngle: parseFloat(e.target.value) || 180 },
                                arcSweepAngle: parseFloat(e.target.value) || 180,
                              })
                            }
                            className="w-full border rounded px-2 py-0.8 bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-6 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draftElement.arcConfig?.direction === 'counter-clockwise'}
                            onChange={(e) =>
                              updateDraft({
                                arcConfig: {
                                  ...draftElement.arcConfig!,
                                  direction: e.target.checked ? 'counter-clockwise' : 'clockwise',
                                },
                              })
                            }
                            className="accent-[#0078d7]"
                          />
                          <span>Counter-Clockwise</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!draftElement.arcConfig?.insidePath}
                            onChange={(e) =>
                              updateDraft({
                                arcConfig: { ...draftElement.arcConfig!, insidePath: e.target.checked },
                                arcInsidePath: e.target.checked,
                              })
                            }
                            className="accent-[#0078d7]"
                          />
                          <span>Render Inside Path</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {formatSubTab === 'autosize' && (
                    <div className="space-y-3 text-[11.5px]">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={!!draftElement.autoSize || !!draftElement.autoFit}
                          onChange={(e) =>
                            updateDraft({
                              autoSize: e.target.checked,
                              autoFit: e.target.checked,
                              autoSizeConfig: { ...draftElement.autoSizeConfig!, enabled: e.target.checked },
                            })
                          }
                          className="accent-[#0078d7]"
                        />
                        <span>Auto Size (Fit text into bounding box dynamically)</span>
                      </label>

                      <fieldset className="border border-[#cbd5e1] rounded p-2.5 space-y-2">
                        <legend className="text-[11px] font-semibold text-slate-700 px-1">Font Point Size Limits</legend>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Minimum:</span>
                            <input
                              type="number"
                              min={1}
                              max={720}
                              value={draftElement.autoSizeConfig?.minFontSize || 6}
                              onChange={(e) =>
                                updateDraft({
                                  autoSizeConfig: { ...draftElement.autoSizeConfig!, minFontSize: parseFloat(e.target.value) || 6 },
                                  minFontSize: parseFloat(e.target.value) || 6,
                                })
                              }
                              className="w-20 border rounded px-1.5 py-0.5 bg-white text-right"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Maximum:</span>
                            <input
                              type="number"
                              min={1}
                              max={720}
                              value={draftElement.autoSizeConfig?.maxFontSize || 720}
                              onChange={(e) =>
                                updateDraft({
                                  autoSizeConfig: { ...draftElement.autoSizeConfig!, maxFontSize: parseFloat(e.target.value) || 720 },
                                  maxFontSize: parseFloat(e.target.value) || 720,
                                })
                              }
                              className="w-20 border rounded px-1.5 py-0.5 bg-white text-right"
                            />
                          </div>
                        </div>
                      </fieldset>

                      {/* Alignment */}
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="text-slate-600 block mb-1">Horizontal Alignment:</label>
                          <div className="flex items-center border border-[#cbd5e1] rounded bg-white p-0.5">
                            {[
                              { id: 'left', icon: AlignLeft },
                              { id: 'center', icon: AlignCenter },
                              { id: 'right', icon: AlignRight },
                              { id: 'justify', icon: AlignJustify },
                            ].map((al) => {
                              const Icon = al.icon;
                              const isCur = draftElement.textAlign === al.id;
                              return (
                                <button
                                  key={al.id}
                                  type="button"
                                  onClick={() => updateDraft({ textAlign: al.id as any, horizontalAlignment: al.id as any })}
                                  className={`flex-1 py-1 flex items-center justify-center rounded-xs cursor-pointer ${
                                    isCur ? 'bg-[#0078d7] text-white' : 'hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="text-slate-600 block mb-1">Vertical Alignment:</label>
                          <select
                            value={draftElement.verticalAlign || 'top'}
                            onChange={(e) => updateDraft({ verticalAlign: e.target.value as any, verticalAlignment: e.target.value as any })}
                            className="w-full border border-[#cbd5e1] rounded px-2 py-1 bg-white"
                          >
                            <option value="top">Top</option>
                            <option value="middle">Middle / Center</option>
                            <option value="bottom">Bottom</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {formatSubTab === 'effects' && (
                    <div className="space-y-2 text-[11.5px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Line Spacing / Height:</span>
                        <input
                          type="number"
                          step={0.05}
                          min={0.8}
                          max={3}
                          value={draftElement.lineHeight || 1.15}
                          onChange={(e) => updateDraft({ lineHeight: parseFloat(e.target.value) || 1.15 })}
                          className="w-20 border rounded px-1.5 py-0.5 bg-white text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Letter Spacing (px):</span>
                        <input
                          type="number"
                          min={-5}
                          max={30}
                          value={draftElement.letterSpacing || 0}
                          onChange={(e) => updateDraft({ letterSpacing: parseFloat(e.target.value) || 0 })}
                          className="w-20 border rounded px-1.5 py-0.5 bg-white text-right"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. BORDER TAB */}
            {selectedCategory === 'border' && (
              <div className="space-y-4">
                {/* Border Type Radio */}
                <div className="flex items-center gap-6 pb-2 border-b border-slate-200">
                  <span className="text-[11.5px] text-slate-700 font-medium">Border Type:</span>
                  {[
                    { id: 'none', label: 'None' },
                    { id: 'rectangle', label: 'Rectangle' },
                    { id: 'ellipse', label: 'Ellipse' },
                  ].map((bt) => (
                    <label key={bt.id} className="flex items-center gap-1.5 cursor-pointer text-[12px] text-slate-800">
                      <input
                        type="radio"
                        name="borderType"
                        checked={(draftElement.borderConfig?.type || 'none') === bt.id}
                        onChange={() =>
                          updateDraft({
                            borderConfig: { ...draftElement.borderConfig!, type: bt.id as any },
                            borderType: bt.id as any,
                          })
                        }
                        className="accent-[#0078d7]"
                      />
                      <span>{bt.label}</span>
                    </label>
                  ))}
                </div>

                {/* Border Properties Grid */}
                <div className={`grid grid-cols-2 gap-4 ${draftElement.borderConfig?.type === 'none' ? 'opacity-40 pointer-events-none' : ''}`}>
                  {/* Margins */}
                  <fieldset className="border border-[#cbd5e1] rounded p-2.5 space-y-2">
                    <legend className="text-[11px] font-semibold text-slate-700 px-1">Margins (mm)</legend>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-slate-500">Top:</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={draftElement.borderConfig?.marginTop || 0}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, marginTop: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full border rounded px-1.5 py-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500">Left:</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={draftElement.borderConfig?.marginLeft || 0}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, marginLeft: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full border rounded px-1.5 py-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500">Bottom:</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={draftElement.borderConfig?.marginBottom || 0}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, marginBottom: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full border rounded px-1.5 py-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500">Right:</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={draftElement.borderConfig?.marginRight || 0}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, marginRight: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full border rounded px-1.5 py-0.5"
                        />
                      </div>
                    </div>
                  </fieldset>

                  {/* Line Properties */}
                  <fieldset className="border border-[#cbd5e1] rounded p-2.5 space-y-2">
                    <legend className="text-[11px] font-semibold text-slate-700 px-1">Line Properties</legend>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Thickness (pt):</span>
                        <input
                          type="number"
                          step={0.5}
                          min={0.5}
                          max={20}
                          value={draftElement.borderConfig?.thickness || 1}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, thickness: parseFloat(e.target.value) || 1 },
                            })
                          }
                          className="w-16 border rounded px-1.5 py-0.5 text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Color:</span>
                        <input
                          type="color"
                          value={draftElement.borderConfig?.color || '#000000'}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, color: e.target.value },
                            })
                          }
                          className="w-8 h-5 border rounded"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Dash Style:</span>
                        <select
                          value={draftElement.borderConfig?.dashStyle || 'solid'}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, dashStyle: e.target.value as any },
                            })
                          }
                          className="border rounded px-1.5 py-0.5 bg-white"
                        >
                          <option value="solid">Solid</option>
                          <option value="dashed">Dashed</option>
                          <option value="dotted">Dotted</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Join Type:</span>
                        <select
                          value={draftElement.borderConfig?.joinType || 'mitered'}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, joinType: e.target.value as any },
                            })
                          }
                          className="border rounded px-1.5 py-0.5 bg-white"
                        >
                          <option value="mitered">Mitered</option>
                          <option value="round">Round</option>
                          <option value="bevel">Bevel</option>
                        </select>
                      </div>
                    </div>
                  </fieldset>

                  {/* Fill Properties */}
                  <fieldset className="border border-[#cbd5e1] rounded p-2.5 space-y-2 col-span-2">
                    <legend className="text-[11px] font-semibold text-slate-700 px-1">Fill & Box Options</legend>
                    <div className="grid grid-cols-2 gap-4 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Fill Color:</span>
                        <input
                          type="color"
                          value={draftElement.borderConfig?.fillColor || '#ffffff'}
                          onChange={(e) =>
                            updateDraft({
                              borderConfig: { ...draftElement.borderConfig!, fillColor: e.target.value },
                            })
                          }
                          className="w-8 h-5 border rounded"
                        />
                      </div>
                      {draftElement.borderConfig?.type === 'rectangle' && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Corner Radius (mm):</span>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={draftElement.borderConfig?.cornerSize || 0}
                            onChange={(e) =>
                              updateDraft({
                                borderConfig: { ...draftElement.borderConfig!, cornerSize: parseFloat(e.target.value) || 0 },
                              })
                            }
                            className="w-16 border rounded px-1.5 py-0.5 text-right"
                          />
                        </div>
                      )}
                    </div>
                  </fieldset>
                </div>
              </div>
            )}

            {/* 4. POSITION TAB */}
            {selectedCategory === 'position' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-[11.5px] text-slate-700 font-medium">Position & Dimensions:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Units:</span>
                    <select
                      value={posUnit}
                      onChange={(e) => setPosUnit(e.target.value as any)}
                      className="border border-[#cbd5e1] rounded px-1.5 py-0.5 text-[11px] bg-white"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="inch">inches</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11.5px]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">X Position:</span>
                      <input
                        type="number"
                        step={0.1}
                        value={draftElement.x}
                        onChange={(e) => updateDraft({ x: parseFloat(e.target.value) || 0 })}
                        className="w-24 border rounded px-2 py-0.8 text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Y Position:</span>
                      <input
                        type="number"
                        step={0.1}
                        value={draftElement.y}
                        onChange={(e) => updateDraft({ y: parseFloat(e.target.value) || 0 })}
                        className="w-24 border rounded px-2 py-0.8 text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Width:</span>
                      <input
                        type="number"
                        step={0.1}
                        min={1}
                        value={draftElement.width}
                        onChange={(e) => updateDraft({ width: Math.max(1, parseFloat(e.target.value) || 10) })}
                        className="w-24 border rounded px-2 py-0.8 text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Height:</span>
                      <input
                        type="number"
                        step={0.1}
                        min={1}
                        value={draftElement.height}
                        onChange={(e) => updateDraft({ height: Math.max(1, parseFloat(e.target.value) || 5) })}
                        className="w-24 border rounded px-2 py-0.8 text-right"
                      />
                    </div>
                  </div>

                  {/* 9 Reference Points Grid */}
                  <div className="space-y-2">
                    <span className="text-slate-700 font-medium">Reference Point:</span>
                    <div className="grid grid-cols-3 gap-1.5 w-36 h-36 border border-slate-300 rounded p-1.5 bg-slate-50">
                      {[
                        'top-left', 'top-center', 'top-right',
                        'center-left', 'center', 'center-right',
                        'bottom-left', 'bottom-center', 'bottom-right'
                      ].map((rp) => {
                        const isCur = (draftElement.referencePoint || 'top-left') === rp;
                        return (
                          <button
                            key={rp}
                            type="button"
                            onClick={() => updateDraft({ referencePoint: rp as ReferencePoint })}
                            className={`flex items-center justify-center rounded-xs cursor-pointer ${
                              isCur ? 'bg-[#0078d7] text-white shadow-xs' : 'bg-white border border-slate-200 hover:bg-slate-200'
                            }`}
                            title={rp}
                          >
                            <div className={`w-2 h-2 rounded-full ${isCur ? 'bg-white' : 'bg-slate-400'}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Rotation & Locking */}
                <div className="border-t border-slate-200 pt-3 space-y-3 text-[11.5px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-medium">Rotation (0–359°):</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={359}
                        value={draftElement.rotation || 0}
                        onChange={(e) => updateDraft({ rotation: parseInt(e.target.value, 10) || 0 })}
                        className="w-48 accent-[#0078d7]"
                      />
                      <input
                        type="number"
                        min={0}
                        max={359}
                        value={draftElement.rotation || 0}
                        onChange={(e) => updateDraft({ rotation: Math.min(359, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right"
                      />
                      <span>°</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={!!draftElement.locked}
                        onChange={(e) => updateDraft({ locked: e.target.checked })}
                        className="accent-[#0078d7]"
                      />
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Lock Object (Prevents moving, resizing, or accidental deletion)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 5. DATA SOURCES ROOT OVERVIEW */}
            {selectedCategory === 'datasources' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-[12px] font-semibold text-slate-800">Data Sources List</span>
                  <button
                    type="button"
                    onClick={() => setIsWizardOpen(true)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11.5px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Data Source</span>
                  </button>
                </div>

                <p className="text-[11.5px] text-slate-600">
                  Multiple data sources are evaluated and concatenated in exact top-to-bottom order:
                </p>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded font-mono text-[12px] text-slate-900 font-semibold">
                  Result: <span className="text-emerald-700">{draftElement.text}</span>
                </div>

                <div className="space-y-2">
                  {dataSources.map((ds, idx) => (
                    <div
                      key={ds.id || idx}
                      onClick={() => {
                        setActiveDsIndex(idx);
                        setSelectedCategory('datasource-item');
                      }}
                      className="p-2.5 bg-white border border-slate-300 rounded hover:border-blue-500 cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{ds.name || `Source ${idx + 1}`}</p>
                          <p className="text-[11px] text-slate-500">
                            Type: <span className="capitalize font-medium">{ds.type}</span> | Value:{' '}
                            <span className="font-mono text-blue-700">{ds.value || '(Empty)'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. DATA SOURCE ITEM TAB */}
            {selectedCategory === 'datasource-item' && (
              <div className="space-y-3">
                {/* Header Tabs: Data Source | Data Type | Transforms */}
                <div className="flex border-b border-[#cbd5e1] gap-1 pb-0">
                  {[
                    { id: 'source', label: 'Data Source' },
                    { id: 'type', label: 'Data Type' },
                    { id: 'transforms', label: 'Transforms' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDsTab(tab.id as any)}
                      className={`px-3 py-1.5 text-[11.5px] font-medium border-t border-x rounded-t cursor-pointer ${
                        activeDsTab === tab.id
                          ? 'bg-white border-[#cbd5e1] text-slate-900 font-semibold shadow-2xs'
                          : 'border-transparent text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Sub-Tab 1: Source */}
                {activeDsTab === 'source' && (
                  <div className="space-y-3.5 pt-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="w-24 text-slate-600 font-medium">Source Type:</label>
                      <select
                        value={activeDataSource.type}
                        onChange={(e) => updateActiveDs({ type: e.target.value as any })}
                        className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 text-[11.5px] bg-white font-medium"
                      >
                        <option value="embedded">Embedded Data</option>
                        <option value="database-field">Database Field</option>
                        <option value="variable">Named Data Source / Variable</option>
                        <option value="clock">Date / Time (Clock)</option>
                        <option value="formula">Formula Expression</option>
                        <option value="serial">Serialization / Counter</option>
                        <option value="system">System Variable</option>
                        <option value="script">Script Engine</option>
                      </select>
                    </div>

                    {/* Source Specific Editor */}
                    {activeDataSource.type === 'embedded' && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-slate-600 font-medium">Embedded Text Value:</label>
                          <button
                            type="button"
                            title="Insert Symbols or Special Characters"
                            onClick={() => setIsSpecialCharModalOpen(true)}
                            className="px-2 py-0.5 bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-sm cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>Ω</span>
                            <span className="text-[10.5px] font-sans font-normal text-slate-700">Special Characters...</span>
                          </button>
                        </div>
                        <div className="flex items-start gap-2">
                          <textarea
                            ref={embeddedTextareaRef}
                            rows={4}
                            value={activeDataSource.value || ''}
                            onChange={(e) => updateActiveDs({ value: e.target.value })}
                            className="flex-1 border border-[#cbd5e1] rounded p-2 text-[12px] font-mono focus:outline-[#0078d7]"
                            placeholder="Enter embedded text value..."
                          />
                          <button
                            type="button"
                            title="Insert Symbols or Special Characters"
                            onClick={() => setIsSpecialCharModalOpen(true)}
                            className="w-8 h-8 self-stretch bg-[#f8fafc] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] border border-[#94a3b8] rounded-xs text-[#003366] font-serif font-bold text-lg cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
                          >
                            Ω
                          </button>
                        </div>
                      </div>
                    )}

                    {activeDataSource.type === 'database-field' && (
                      <DatabaseFieldSourceConfig
                        dataSource={activeDataSource}
                        onUpdate={updateActiveDs}
                        datasets={datasets}
                        currentRecord={currentRecord}
                        currentConnection={currentConnection}
                        onConnectDatasetToTemplate={onConnectDataset}
                      />
                    )}

                    {activeDataSource.type === 'clock' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <label className="w-24 text-slate-600">Date Format:</label>
                          <input
                            type="text"
                            value={activeDataSource.dateFormat || 'YYYY-MM-DD'}
                            onChange={(e) => updateActiveDs({ dateFormat: e.target.value })}
                            className="flex-1 border rounded px-2 py-1 font-mono text-[11.5px]"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-500">Offset Days:</label>
                            <input
                              type="number"
                              value={activeDataSource.dateOffsetDays || 0}
                              onChange={(e) => updateActiveDs({ dateOffsetDays: parseInt(e.target.value, 10) || 0 })}
                              className="w-full border rounded px-1.5 py-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500">Offset Months:</label>
                            <input
                              type="number"
                              value={activeDataSource.dateOffsetMonths || 0}
                              onChange={(e) => updateActiveDs({ dateOffsetMonths: parseInt(e.target.value, 10) || 0 })}
                              className="w-full border rounded px-1.5 py-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500">Offset Years:</label>
                            <input
                              type="number"
                              value={activeDataSource.dateOffsetYears || 0}
                              onChange={(e) => updateActiveDs({ dateOffsetYears: parseInt(e.target.value, 10) || 0 })}
                              className="w-full border rounded px-1.5 py-0.5"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeDataSource.type === 'formula' && (
                      <div className="space-y-1.5">
                        <label className="text-slate-600 font-medium">Formula Expression (e.g. [Price] * 1.18):</label>
                        <input
                          type="text"
                          value={activeDataSource.formulaExpression || activeDataSource.value || ''}
                          onChange={(e) => updateActiveDs({ formulaExpression: e.target.value, value: e.target.value })}
                          placeholder="e.g. [Price] * [Quantity]"
                          className="w-full border border-[#cbd5e1] rounded px-2 py-1.5 font-mono text-[12px]"
                        />
                      </div>
                    )}

                    {activeDataSource.type === 'system' && (
                      <div className="flex items-center justify-between gap-3">
                        <label className="w-24 text-slate-600">System Field:</label>
                        <select
                          value={activeDataSource.systemVarName || 'SYSTEM.DATE'}
                          onChange={(e) => updateActiveDs({ systemVarName: e.target.value as any })}
                          className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 bg-white"
                        >
                          <option value="SYSTEM.DATE">Current Date</option>
                          <option value="SYSTEM.TIME">Current Time</option>
                          <option value="SYSTEM.USER">Logged-in User</option>
                          <option value="SYSTEM.PRINTER">Active Printer</option>
                          <option value="SYSTEM.JOB_ID">Job Identifier</option>
                          <option value="SYSTEM.PAGE_NUMBER">Page Number</option>
                          <option value="SYSTEM.TOTAL_PAGES">Total Pages</option>
                          <option value="SYSTEM.RECORD_NUMBER">Current Record Number</option>
                          <option value="SYSTEM.TOTAL_RECORDS">Total Database Records</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-Tab 2: Data Type */}
                {activeDsTab === 'type' && (
                  <div className="space-y-3.5 pt-2 text-[11.5px]">
                    <div className="flex items-center justify-between gap-3">
                      <label className="w-28 text-slate-600 font-medium">Data Type:</label>
                      <select
                        value={activeDataSource.dataType || 'text'}
                        onChange={(e) => updateActiveDs({ dataType: e.target.value as any })}
                        className="flex-1 border border-[#cbd5e1] rounded px-2 py-1 bg-white font-medium"
                      >
                        <option value="text">Text (String)</option>
                        <option value="number">Number</option>
                        <option value="integer">Integer</option>
                        <option value="decimal">Decimal</option>
                        <option value="currency">Currency</option>
                        <option value="date">Date</option>
                        <option value="time">Time</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>

                    {(activeDataSource.dataType === 'number' ||
                      activeDataSource.dataType === 'decimal' ||
                      activeDataSource.dataType === 'currency') && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span>Decimal Places:</span>
                          <input
                            type="number"
                            min={0}
                            max={6}
                            value={activeDataSource.numberFormat?.decimalPlaces ?? 2}
                            onChange={(e) =>
                              updateActiveDs({
                                numberFormat: {
                                  ...activeDataSource.numberFormat,
                                  decimalPlaces: parseInt(e.target.value, 10) || 0,
                                },
                              })
                            }
                            className="w-16 border rounded px-1.5 py-0.5 text-right bg-white"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Minimum Digits / Leading Zeros:</span>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={activeDataSource.numberFormat?.leadingZeros ?? 0}
                            onChange={(e) =>
                              updateActiveDs({
                                numberFormat: {
                                  ...activeDataSource.numberFormat,
                                  leadingZeros: parseInt(e.target.value, 10) || 0,
                                },
                              })
                            }
                            className="w-16 border rounded px-1.5 py-0.5 text-right bg-white"
                          />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!activeDataSource.numberFormat?.thousandSeparator}
                            onChange={(e) =>
                              updateActiveDs({
                                numberFormat: {
                                  ...activeDataSource.numberFormat,
                                  thousandSeparator: e.target.checked,
                                },
                              })
                            }
                            className="accent-[#0078d7]"
                          />
                          <span>Use 1000 Separator (,)</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-Tab 3: Transforms */}
                {activeDsTab === 'transforms' && (
                  <div className="space-y-2 pt-1 text-[11.5px]">
                    {[
                      { id: 'suppression', label: 'Suppression:', summary: suppressionSummary, modal: 'suppression' },
                      { id: 'filter', label: 'Character Filter:', summary: filterSummary, modal: 'filter' },
                      { id: 'truncation', label: 'Truncation:', summary: truncSummary, modal: 'truncation' },
                      { id: 'length', label: 'Number of Characters:', summary: lengthSummary, modal: 'length' },
                      { id: 'template', label: 'Character Template:', summary: templateSummary, modal: 'template' },
                      { id: 'searchReplace', label: 'Search and Replace:', summary: searchReplaceSummary, modal: 'searchReplace' },
                      { id: 'script', label: 'VB / JS Script:', summary: scriptSummary, modal: 'script' },
                      { id: 'serialization', label: 'Serialization:', summary: serialSummary, modal: 'serialization' },
                      { id: 'prefixSuffix', label: 'Prefix and Suffix:', summary: prefixSuffixSummary, modal: 'prefixSuffix' },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-1.5 border-b border-slate-100 hover:bg-slate-50 rounded">
                        <span className="w-36 text-slate-700 font-medium">{item.label}</span>
                        <span className="flex-1 text-slate-500 font-mono truncate text-[11px]">{item.summary}</span>
                        <button
                          type="button"
                          onClick={() => setActiveTransformModal(item.modal as any)}
                          className="px-2.5 py-0.8 bg-white border border-[#94a3b8] hover:bg-slate-100 rounded text-slate-800 text-[11px] font-medium shadow-2xs cursor-pointer"
                        >
                          Configure...
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#cbd5e1] bg-[#f1f5f9] px-3 py-2 flex items-center justify-between">
          <button
            onClick={() => alert('BarTender-compatible Enterprise Text Properties documentation.')}
            className="px-3 py-1 border border-[#94a3b8] hover:bg-slate-200 rounded text-slate-700 text-[11.5px] flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Help</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCommit}
              className="px-5 py-1 bg-[#0078d7] hover:bg-[#0063b1] text-white font-semibold rounded text-[11.5px] shadow-2xs cursor-pointer"
            >
              OK
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-1 border border-[#94a3b8] hover:bg-slate-200 text-slate-700 font-medium rounded text-[11.5px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modals for Transforms and Serialization */}
      {activeTransformModal === 'serialization' && (
        <SerializationModal
          isOpen={true}
          onClose={() => setActiveTransformModal(null)}
          initialConfig={activeDataSource.serialization}
          initialValue={activeDataSource.value || '000001'}
          prefix={activeDataSource.prefixSuffix?.prefix || ''}
          suffix={activeDataSource.prefixSuffix?.suffix || ''}
          onApply={(config) => updateActiveDs({ serialization: config })}
        />
      )}

      {activeTransformModal === 'suppression' && (
        <SuppressionModal
          isOpen={true}
          title="Data Source Suppression"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.suppression}
          onApply={(up) => updateActiveDs({ transformConfig: { ...activeDataSource.transformConfig, ...up } })}
        />
      )}

      {activeTransformModal === 'filter' && (
        <CharacterFilterModal
          isOpen={true}
          title="Character Filter"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.characterFilter}
          onApply={(up) => updateActiveDs({ transformConfig: { ...activeDataSource.transformConfig, ...up } })}
        />
      )}

      {activeTransformModal === 'truncation' && (
        <TruncationModal
          isOpen={true}
          title="Character Truncation"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.truncation}
          onApply={(up) => updateActiveDs({ transformConfig: { ...activeDataSource.transformConfig, ...up } })}
        />
      )}

      {activeTransformModal === 'length' && (
        <CharacterLengthModal
          isOpen={true}
          title="Number of Characters & Padding"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.characterLength}
          onApply={(up) => updateActiveDs({ transformConfig: { ...activeDataSource.transformConfig, ...up } })}
        />
      )}

      {activeTransformModal === 'template' && (
        <CharacterTemplateModal
          isOpen={true}
          title="Character Template Masking"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.characterTemplate}
          onApply={(up) => updateActiveDs({ transformConfig: { ...activeDataSource.transformConfig, ...up } })}
        />
      )}

      {activeTransformModal === 'searchReplace' && (
        <SearchReplaceModal
          isOpen={true}
          title="Search and Replace Rules"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.searchReplace}
          onApply={(up) => updateActiveDs({ transformConfig: { ...activeDataSource.transformConfig, ...up } })}
        />
      )}

      {activeTransformModal === 'script' && (
        <ScriptTransformModal
          isOpen={true}
          title="Script Transform Engine"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.transformConfig?.script}
          onApply={(up) => updateActiveDs({ transformConfig: { ...activeDataSource.transformConfig, ...up } })}
        />
      )}

      {activeTransformModal === 'prefixSuffix' && (
        <PrefixSuffixModal
          isOpen={true}
          title="Prefix and Suffix"
          onClose={() => setActiveTransformModal(null)}
          initial={activeDataSource.prefixSuffix}
          onApply={(up) => updateActiveDs({ prefixSuffix: up.prefixSuffix, transformConfig: { ...activeDataSource.transformConfig, prefixSuffix: up.prefixSuffix } })}
        />
      )}

      {/* New Data Source Wizard Modal */}
      <NewDataSourceWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onAddDataSource={handleWizardAddDataSource}
        datasets={datasets}
        existingCount={dataSources.length}
      />

      {/* Insert Symbols or Special Characters Modal */}
      <SpecialCharacterModal
        isOpen={isSpecialCharModalOpen}
        onClose={() => setIsSpecialCharModalOpen(false)}
        onInsert={handleInsertSpecialChar}
        currentFont={draftElement?.fontFamily || 'Arial'}
      />
    </div>
  );
};
