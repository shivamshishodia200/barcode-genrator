import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Printer as PrinterIcon,
  X,
  Grid,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { LabelTemplate, LabelElement, BarcodeElement } from '../../types';
import { PrinterModel } from '../../printer/types';
import { PrintPlan, PrintPlanPage, PrintPlanItem, createPrintPlan } from '../../services/printPlanService';
import { renderBarcodeToCanvas } from '../../services/barcodeEngine';

interface PrintPreviewWorkspaceProps {
  template: LabelTemplate;
  printer: PrinterModel;
  effectiveDpi: number | null;
  recordsToPrint: Record<string, any>[];
  copies: number;
  quantitySource: 'manual' | 'database_field';
  selectedQtyColumn?: string;
  serializedLabels?: number;
  startingSlot?: number;
  onClose: () => void;
  onPrint: (plan: PrintPlan) => void;
}

export const PrintPreviewWorkspace: React.FC<PrintPreviewWorkspaceProps> = ({
  template,
  printer,
  effectiveDpi,
  recordsToPrint,
  copies,
  quantitySource,
  selectedQtyColumn,
  serializedLabels = 1,
  startingSlot = 1,
  onClose,
  onPrint,
}) => {
  // 1. Build deterministic immutable print plan
  const printPlan = useMemo(() => {
    return createPrintPlan(template, {
      printer,
      copies,
      recordsToPrint,
      quantitySource,
      selectedQtyColumn,
      serializedLabels,
      startingSlot,
      effectiveDpi,
    });
  }, [
    template,
    printer,
    copies,
    recordsToPrint,
    quantitySource,
    selectedQtyColumn,
    serializedLabels,
    startingSlot,
    effectiveDpi,
  ]);

  // Page navigation state
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [pageInputVal, setPageInputVal] = useState<string>('1');

  // Zoom and viewport state - default to 1.0 (1:1 Actual Physical Size)
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [zoomMode, setZoomMode] = useState<'actual' | 'fit' | 'custom'>('actual');
  const [viewMode, setViewMode] = useState<'single' | 'multi'>('single');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync page input field
  useEffect(() => {
    setPageInputVal(String(currentPageIndex + 1));
  }, [currentPageIndex]);

  const totalPages = Math.max(1, printPlan.totalPages);
  const currentPage: PrintPlanPage | undefined = printPlan.pages[currentPageIndex] || printPlan.pages[0];

  const handleGoToPage = (target1Based: number) => {
    const clamped = Math.max(1, Math.min(totalPages, target1Based));
    setCurrentPageIndex(clamped - 1);
  };

  const handleZoomIn = () => {
    setZoomMode('custom');
    setZoomScale((z) => Math.min(3.0, Math.round((z + 0.1) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoomMode('custom');
    setZoomScale((z) => Math.max(0.15, Math.round((z - 0.1) * 100) / 100));
  };

  const handleZoom100 = () => {
    setZoomMode('actual');
    setZoomScale(1.0);
  };

  const handleFitPage = () => {
    if (!containerRef.current || !currentPage) return;
    const containerW = containerRef.current.clientWidth - 80;
    const containerH = containerRef.current.clientHeight - 80;
    // 1 mm = 3.779527559 px at 96 DPI
    const pagePxW = currentPage.pageWidthMm * 3.779527559;
    const pagePxH = currentPage.pageHeightMm * 3.779527559;

    const scaleW = containerW / pagePxW;
    const scaleH = containerH / pagePxH;
    const fitScale = Math.max(0.2, Math.min(2.5, Math.min(scaleW, scaleH) * 0.95));
    setZoomMode('fit');
    setZoomScale(Math.round(fitScale * 1000) / 1000);
  };

  // Initial sizing on mount: default to 1:1 Actual Size if fits, otherwise fit page
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!containerRef.current || !currentPage) return;
      const containerW = containerRef.current.clientWidth - 80;
      const containerH = containerRef.current.clientHeight - 80;
      const pagePxW = currentPage.pageWidthMm * 3.779527559;
      const pagePxH = currentPage.pageHeightMm * 3.779527559;
      if (pagePxW > containerW || pagePxH > containerH) {
        handleFitPage();
      } else {
        setZoomScale(1.0);
        setZoomMode('actual');
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [currentPage?.pageWidthMm, currentPage?.pageHeightMm]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPageIndex < totalPages - 1) {
          setCurrentPageIndex((p) => p + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPageIndex > 0) {
          setCurrentPageIndex((p) => p - 1);
        }
      } else if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        onPrint(printPlan);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, totalPages, onClose, onPrint, printPlan]);

  // mm to screen px conversion factor (at standard 96 CSS DPI: 1 inch = 25.4mm = 96px => 3.779527559 px/mm)
  const MM_TO_PX = 3.779527559;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#9fbddb] text-slate-800 select-none font-sans overflow-hidden">
      {/* 1. TOP TOOLBAR (Classic BarTender Style Matching Screenshot 4) */}
      <div className="h-9 bg-gradient-to-b from-[#f8faff] to-[#e4edf7] border-b border-[#a4bed8] flex items-center justify-between px-2 shrink-0 shadow-2xs text-xs">
        <div className="flex items-center gap-1">
          {/* Print Button */}
          <button
            type="button"
            onClick={() => onPrint(printPlan)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-blue-50 active:bg-blue-100 border border-[#b4c8dc] hover:border-blue-400 rounded text-slate-800 font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Print this preview run (Ctrl+P)"
          >
            <PrinterIcon className="w-3.5 h-3.5 text-blue-700" />
            <span>Print</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-red-50 active:bg-red-100 border border-[#b4c8dc] hover:border-red-400 rounded text-slate-800 font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Close Print Preview and Return to Editor (Esc)"
          >
            <X className="w-3.5 h-3.5 text-red-600" />
            <span>Close</span>
          </button>

          <div className="h-5 w-px bg-[#cbdbe9] mx-1" />

          {/* Grid Layout Toggle */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'single' ? 'multi' : 'single')}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              viewMode === 'multi'
                ? 'bg-blue-100 border-blue-400 text-blue-800'
                : 'bg-white border-[#b4c8dc] hover:bg-slate-50 text-slate-700'
            }`}
            title="Toggle Multi-Page Sheet Layout"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <div className="h-5 w-px bg-[#cbdbe9] mx-1" />

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 bg-white hover:bg-slate-50 border border-[#b4c8dc] rounded text-slate-700 shadow-2xs cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 bg-white hover:bg-slate-50 border border-[#b4c8dc] rounded text-slate-700 shadow-2xs cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Fit Page */}
          <button
            type="button"
            onClick={handleFitPage}
            className={`p-1.5 border rounded shadow-2xs cursor-pointer transition-colors ${
              zoomMode === 'fit'
                ? 'bg-blue-100 border-blue-400 text-blue-800'
                : 'bg-white hover:bg-slate-50 border-[#b4c8dc] text-slate-700'
            }`}
            title="Fit Entire Page in Window"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
          </button>

          {/* Actual Size 100% (1:1) */}
          <button
            type="button"
            onClick={handleZoom100}
            className={`flex items-center gap-1 px-2 py-1 border rounded shadow-2xs cursor-pointer text-[11px] font-bold transition-colors ${
              Math.abs(zoomScale - 1.0) < 0.02
                ? 'bg-blue-600 border-blue-700 text-white'
                : 'bg-white hover:bg-slate-50 border-[#b4c8dc] text-slate-700'
            }`}
            title="Show Actual Physical Size (1:1 / 100%)"
          >
            <span>1:1</span>
            <span className="text-[10px] hidden sm:inline">Actual Size</span>
          </button>

          {/* Zoom Preset Selector */}
          <select
            value={Math.abs(zoomScale - 1.0) < 0.02 ? '100' : String(Math.round(zoomScale * 100))}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'fit') {
                handleFitPage();
              } else {
                const pct = parseInt(val, 10);
                if (!isNaN(pct)) {
                  setZoomScale(pct / 100);
                  setZoomMode(pct === 100 ? 'actual' : 'custom');
                }
              }
            }}
            className="px-1.5 py-0.5 text-[11px] bg-white border border-[#b4c8dc] rounded text-slate-800 font-medium cursor-pointer shadow-2xs"
            title="Select Zoom Preset"
          >
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100% (Actual Size)</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
            <option value="200">200%</option>
            <option value="fit">Fit Page</option>
          </select>

          <div className="h-5 w-px bg-[#cbdbe9] mx-1" />

          {/* Page Navigation Controls */}
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-[#b4c8dc] rounded shadow-2xs">
            <button
              type="button"
              disabled={currentPageIndex <= 0}
              onClick={() => handleGoToPage(1)}
              className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded text-slate-700 cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={currentPageIndex <= 0}
              onClick={() => handleGoToPage(currentPageIndex)}
              className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded text-slate-700 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-semibold text-slate-600 px-1">Page:</span>
            <input
              type="text"
              value={pageInputVal}
              onChange={(e) => setPageInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const num = parseInt(pageInputVal, 10);
                  if (!isNaN(num)) handleGoToPage(num);
                }
              }}
              onBlur={() => {
                const num = parseInt(pageInputVal, 10);
                if (!isNaN(num)) handleGoToPage(num);
                else setPageInputVal(String(currentPageIndex + 1));
              }}
              className="w-10 px-1 py-0.5 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-blue-500"
            />
            <span className="text-[11px] font-semibold text-slate-600 px-1">
              of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPageIndex >= totalPages - 1}
              onClick={() => handleGoToPage(currentPageIndex + 2)}
              className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded text-slate-700 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={currentPageIndex >= totalPages - 1}
              onClick={() => handleGoToPage(totalPages)}
              className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded text-slate-700 cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right side info summary */}
        <div className="flex items-center gap-3 text-slate-700 text-[11.5px] font-medium pr-2">
          <span>
            Document: <strong>{template.name || 'Document1.btw'}</strong>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            Template Actual Size:
            <strong className="text-blue-900 bg-blue-100/90 px-2 py-0.5 rounded border border-blue-300 font-bold shadow-2xs">
              {template.dimensions.width} × {template.dimensions.height} mm
            </strong>
          </span>
          <span>•</span>
          <span>
            Total Output: <strong>{printPlan.totalLabels} label(s)</strong>
          </span>
        </div>
      </div>

      {/* 2. MAIN PREVIEW CANVAS WORKSPACE */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-8 flex items-center justify-center relative select-none"
        style={{ backgroundColor: '#9fbddb' }}
      >
        {viewMode === 'single' ? (
          // Single Page Physical Sheet View with Real Dimension Metrics
          currentPage && (
            <div className="flex flex-col items-center gap-2">
              {/* Top Dimension Header */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-800 bg-white/95 border border-slate-300 rounded px-2.5 py-0.5 shadow-2xs">
                  ← Width: {currentPage.pageWidthMm} mm ({((currentPage.pageWidthMm / 25.4)).toFixed(2)} in) →
                </span>
                {Math.abs(zoomScale - 1.0) < 0.02 && (
                  <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded px-2 py-0.5 shadow-2xs">
                    ✓ 1:1 Actual Physical Scale
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Left Height Ruler / Indicator */}
                <div className="text-[11px] font-bold text-slate-800 bg-white/95 border border-slate-300 rounded px-1.5 py-2 shadow-2xs [writing-mode:vertical-lr] rotate-180 flex items-center justify-center">
                  ← Height: {currentPage.pageHeightMm} mm ({((currentPage.pageHeightMm / 25.4)).toFixed(2)} in) →
                </div>

                <div
                  className="bg-white relative transition-all origin-center shrink-0 border border-[#7d9ebc]"
                  style={{
                    width: `${currentPage.pageWidthMm * MM_TO_PX * zoomScale}px`,
                    height: `${currentPage.pageHeightMm * MM_TO_PX * zoomScale}px`,
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0,0,0,0.15)',
                  }}
                >
                  {/* Margin Boundary Guides (Light dashed sky-blue border) */}
                  <div
                    className="absolute border border-dashed border-sky-300 pointer-events-none"
                    style={{
                      top: `${(currentPage.margins.top || 0) * MM_TO_PX * zoomScale}px`,
                      left: `${(currentPage.margins.left || 0) * MM_TO_PX * zoomScale}px`,
                      right: `${(currentPage.margins.right || 0) * MM_TO_PX * zoomScale}px`,
                      bottom: `${(currentPage.margins.bottom || 0) * MM_TO_PX * zoomScale}px`,
                    }}
                  />

                  {/* Render all label items positioned on this page */}
                  {currentPage.items.map((item) => {
                    const itemLeftPx = item.xOffsetMm * MM_TO_PX * zoomScale;
                    const itemTopPx = item.yOffsetMm * MM_TO_PX * zoomScale;
                    const itemWidthPx = item.widthMm * MM_TO_PX * zoomScale;
                    const itemHeightPx = item.heightMm * MM_TO_PX * zoomScale;

                    const shape = printPlan.pageSetup.shape;
                    const cornerRadiusPx = (printPlan.pageSetup.cornerRadius || 2.5) * MM_TO_PX * zoomScale;
                    const borderRadiusStyle =
                      shape === 'ellipse' || shape === 'circle'
                        ? '50%'
                        : shape === 'rounded-rectangle'
                        ? `${cornerRadiusPx}px`
                        : '0px';

                    return (
                      <div
                        key={item.itemIndex}
                        className="absolute bg-white overflow-hidden border border-slate-700/80 shadow-2xs hover:border-blue-600 transition-colors"
                        style={{
                          left: `${itemLeftPx}px`,
                          top: `${itemTopPx}px`,
                          width: `${itemWidthPx}px`,
                          height: `${itemHeightPx}px`,
                          borderRadius: borderRadiusStyle,
                        }}
                      >
                        {/* Render Template Elements inside this Label Slot */}
                        <div
                          className="w-full h-full relative"
                          style={{
                            transform: `scale(${zoomScale})`,
                            transformOrigin: 'top left',
                            width: `${item.widthMm * MM_TO_PX}px`,
                            height: `${item.heightMm * MM_TO_PX}px`,
                          }}
                        >
                          {template.elements.map((el) => {
                            const evaluatedVal = item.evaluatedValues[el.id] !== undefined
                              ? item.evaluatedValues[el.id]
                              : (el as any).value || (el as any).content || '';

                            return (
                              <PreviewElementSlot
                                key={el.id}
                                element={el}
                                evaluatedValue={evaluatedVal}
                                record={item.record}
                                zoomScale={zoomScale}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        ) : (
          // Multi-Page Grid View
          <div className="flex flex-wrap gap-8 items-center justify-center p-4">
            {printPlan.pages.map((p) => (
              <div
                key={p.pageIndex}
                onClick={() => {
                  setCurrentPageIndex(p.pageIndex);
                  setViewMode('single');
                }}
                className={`bg-white relative cursor-pointer border transition-all ${
                  p.pageIndex === currentPageIndex
                    ? 'ring-4 ring-blue-500 border-blue-600 shadow-2xl'
                    : 'hover:ring-2 hover:ring-blue-300 border-[#7d9ebc] shadow-lg'
                }`}
                style={{
                  width: `${p.pageWidthMm * MM_TO_PX * (zoomScale * 0.4)}px`,
                  height: `${p.pageHeightMm * MM_TO_PX * (zoomScale * 0.4)}px`,
                }}
              >
                <div className="absolute top-1 left-2 text-[10px] font-bold text-slate-500 font-mono">
                  Page {p.pageNumber}
                </div>
                {p.items.map((item) => (
                  <div
                    key={item.itemIndex}
                    className="absolute bg-white border border-slate-400"
                    style={{
                      left: `${item.xOffsetMm * MM_TO_PX * (zoomScale * 0.4)}px`,
                      top: `${item.yOffsetMm * MM_TO_PX * (zoomScale * 0.4)}px`,
                      width: `${item.widthMm * MM_TO_PX * (zoomScale * 0.4)}px`,
                      height: `${item.heightMm * MM_TO_PX * (zoomScale * 0.4)}px`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. BOTTOM STATUS BAR (Exact Match to Screenshot 4) */}
      <div className="h-6 bg-gradient-to-b from-[#e8edf5] to-[#d8e3f0] border-t border-[#a4bed8] flex items-center justify-between px-2 text-[11px] text-slate-800 shrink-0 select-none shadow-inner font-sans">
        <div className="flex items-center gap-3">
          {/* Yellow Highlighted Tab Badge (Screenshot 4) */}
          <div className="bg-[#fff1a8] text-[#7a5b00] border-t border-l border-r border-[#d4b94f] px-3 py-0.5 rounded-t font-bold shadow-2xs -mb-1 text-[11px]">
            Print Preview
          </div>

          <div className="flex items-center gap-1 font-sans">
            <span className="text-slate-500">Printer:</span>
            <span className="font-semibold text-slate-900">{printer.name}</span>
          </div>

          <span className="text-slate-400">•</span>

          <div className="flex items-center gap-1 font-sans">
            <span className="text-slate-500">Page Size:</span>
            <span className="font-semibold text-slate-900">
              {currentPage?.pageSizeName || 'Letter'}
            </span>
          </div>

          <span className="text-slate-400">•</span>

          <div className="flex items-center gap-1 font-sans">
            <span className="text-slate-500">Item Width:</span>
            <span className="font-semibold text-slate-900">{template.dimensions.width}mm</span>
          </div>

          <span className="text-slate-400">•</span>

          <div className="flex items-center gap-1 font-sans">
            <span className="text-slate-500">Item Height:</span>
            <span className="font-semibold text-slate-900">{template.dimensions.height}mm</span>
          </div>

          <span className="text-slate-400">•</span>

          <div className="flex items-center gap-1 font-sans">
            <span className="text-slate-500">Scale Mode:</span>
            <span className={`font-semibold ${Math.abs(zoomScale - 1.0) < 0.02 ? 'text-emerald-700 font-bold' : 'text-slate-900'}`}>
              {Math.abs(zoomScale - 1.0) < 0.02 ? '1:1 (Actual Physical Size)' : `${Math.round(zoomScale * 100)}%`}
            </span>
          </div>
        </div>

        {/* Right Status info */}
        <div className="flex items-center gap-3 font-sans">
          <span>
            Zoom: <strong>{Math.round(zoomScale * 100 * 10) / 10}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * PreviewElementSlot renders an individual element with real high-DPI barcode and vector graphics
 */
const PreviewElementSlot: React.FC<{
  element: LabelElement;
  evaluatedValue: string;
  record: Record<string, any>;
  zoomScale: number;
}> = ({ element, evaluatedValue, record }) => {
  const MM_TO_PX = 3.779527559;

  const leftPx = element.x * MM_TO_PX;
  const topPx = element.y * MM_TO_PX;
  const widthPx = element.width * MM_TO_PX;
  const heightPx = element.height * MM_TO_PX;

  const rotation = element.rotation || 0;
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const elAny = element as any;
  const elType = element.type as string;

  useEffect(() => {
    if (elType === 'barcode' && barcodeCanvasRef.current) {
      renderBarcodeToCanvas(
        barcodeCanvasRef.current,
        {
          ...(element as BarcodeElement),
          value: evaluatedValue || elAny.value || '12345678',
        },
        2.5,
        { record }
      ).catch((err) => {
        console.warn('[Preview] Barcode render fallback:', err);
      });
    }
  }, [element, evaluatedValue, record, elType]);

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      {elType === 'barcode' ? (
        <div
          className={`w-full h-full flex items-center justify-center ${
            elAny.borderType === 'ellipse' ? 'rounded-full' : ''
          }`}
          style={{
            backgroundColor:
              elAny.borderFillColor && elAny.borderFillColor !== 'None'
                ? elAny.borderFillColor
                : 'transparent',
            borderWidth: elAny.borderType && elAny.borderType !== 'none' ? `${elAny.borderThickness || 1}px` : '0px',
            borderColor: elAny.borderColor || '#000000',
            borderStyle: elAny.borderDashStyle || 'solid',
            borderRadius: elAny.borderType === 'ellipse' ? '50%' : elAny.cornerRadius ? `${elAny.cornerRadius * MM_TO_PX}px` : undefined,
            padding: elAny.borderPadding !== undefined ? `${elAny.borderPadding * MM_TO_PX}px` : '2px',
          }}
        >
          <canvas
            ref={barcodeCanvasRef}
            className="w-full h-full object-contain pointer-events-none"
          />
        </div>
      ) : elType === 'text' ? (
        <div
          className="w-full h-full flex items-center justify-start"
          style={{
            fontFamily: elAny.fontFamily || 'Arial, sans-serif',
            fontSize: `${(elAny.fontSize || 12) * 1.333}px`,
            fontWeight: elAny.fontWeight || 'normal',
            fontStyle: elAny.fontStyle || 'normal',
            textAlign: elAny.textAlign || 'left',
            color: elAny.color || '#000000',
            lineHeight: 1.15,
            wordBreak: 'break-word',
            justifyContent:
              elAny.textAlign === 'center'
                ? 'center'
                : elAny.textAlign === 'right'
                ? 'flex-end'
                : 'flex-start',
          }}
        >
          {evaluatedValue}
        </div>
      ) : elType === 'shape' || elType === 'rectangle' ? (
        <div
          className="w-full h-full"
          style={{
            backgroundColor: elAny.fillColor || 'transparent',
            borderWidth: `${elAny.borderWidth || 1}px`,
            borderColor: elAny.borderColor || '#000000',
            borderStyle: elAny.borderStyle || 'solid',
            borderRadius: `${elAny.cornerRadius || 0}px`,
          }}
        />
      ) : elType === 'circle' || elType === 'ellipse' ? (
        <div
          className="w-full h-full rounded-full"
          style={{
            backgroundColor: elAny.fillColor || 'transparent',
            borderWidth: `${elAny.borderWidth || 1}px`,
            borderColor: elAny.borderColor || '#000000',
            borderStyle: elAny.borderStyle || 'solid',
          }}
        />
      ) : elType === 'line' ? (
        <div
          className="w-full"
          style={{
            height: `${elAny.borderWidth || 1}px`,
            backgroundColor: elAny.borderColor || '#000000',
            marginTop: `${heightPx / 2}px`,
          }}
        />
      ) : elType === 'image' ? (
        elAny.url || elAny.src ? (
          <img
            src={elAny.url || elAny.src}
            alt=""
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
            [Image]
          </div>
        )
      ) : (
        <div className="w-full h-full border border-slate-200 text-[10px] p-0.5 truncate">
          {evaluatedValue}
        </div>
      )}
    </div>
  );
};
