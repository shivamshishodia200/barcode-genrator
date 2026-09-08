import React, { useRef, useState, useEffect } from 'react';
import { UnitType, CanvasGuide } from '../../types';
import {
  getVisibleRulerTicks,
  unitToScreenPx,
  screenPxToMm,
  MM_PER_INCH,
  BASE_DPI,
} from '../../services/rulerEngine';

export interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  widthMm: number;
  heightMm: number;
  zoom: number;
  unit: UnitType;
  cursorX: number; // in mm
  cursorY: number; // in mm
  panX: number; // Screen pixel pos of doc X=0
  panY: number; // Screen pixel pos of doc Y=0
  guides?: CanvasGuide[];
  onAddGuide?: (type: 'horizontal' | 'vertical', positionMm: number) => void;
  onGuideDragStart?: (type: 'horizontal' | 'vertical', initialPosMm: number) => void;
}

export const Ruler: React.FC<RulerProps> = ({
  orientation,
  widthMm,
  heightMm,
  zoom,
  unit,
  cursorX,
  cursorY,
  panX,
  panY,
  guides = [],
  onAddGuide,
  onGuideDragStart,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportLengthPx, setViewportLengthPx] = useState(800);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverPosMm, setHoverPosMm] = useState<number | null>(null);

  const isHorizontal = orientation === 'horizontal';
  const panOffset = isHorizontal ? panX : panY;
  const docDimensionMm = isHorizontal ? widthMm : heightMm;
  const cursorMm = isHorizontal ? cursorX : cursorY;

  // Track ruler element size dynamically with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const len = isHorizontal ? el.clientWidth : el.clientHeight;
      if (len > 0) {
        setViewportLengthPx(len);
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isHorizontal]);

  // Compute all visible ticks using shared ruler engine
  const ticks = getVisibleRulerTicks({
    viewportLengthPx,
    panOffset,
    zoom,
    unit,
    docDimensionMm,
  });

  // Calculate document start/end in screen pixels for active label region highlight
  const docStartPx = unitToScreenPx(0, unit, zoom, panOffset);
  const docDimensionUnit = unit === 'inch' ? docDimensionMm / MM_PER_INCH : unit === 'px' ? docDimensionMm * (BASE_DPI / MM_PER_INCH) : docDimensionMm;
  const docEndPx = unitToScreenPx(docDimensionUnit, unit, zoom, panOffset);

  // Dynamic cursor indicator screen position
  const cursorScreenPx = unitToScreenPx(
    unit === 'inch' ? cursorMm / MM_PER_INCH : unit === 'px' ? cursorMm * (BASE_DPI / MM_PER_INCH) : cursorMm,
    unit,
    zoom,
    panOffset
  );

  // Relevant guides for this ruler orientation
  const relevantGuides = guides.filter(g =>
    isHorizontal ? g.type === 'vertical' : g.type === 'horizontal'
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mousePx = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top;
    const clickedMm = screenPxToMm(mousePx, zoom, panOffset);
    const roundedMm = Math.round(clickedMm * 10) / 10;

    if (onGuideDragStart) {
      onGuideDragStart(isHorizontal ? 'horizontal' : 'vertical', roundedMm);
    } else if (onAddGuide) {
      onAddGuide(isHorizontal ? 'vertical' : 'horizontal', roundedMm);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mousePx = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top;
    const curMm = screenPxToMm(mousePx, zoom, panOffset);
    setHoverPosMm(Math.round(curMm * 10) / 10);
  };

  if (isHorizontal) {
    return (
      <div
        ref={containerRef}
        className="w-full h-5 bg-[#dbe4ef] border-b border-[#cbd5e1] relative overflow-hidden select-none cursor-crosshair font-sans"
        title="Horizontal Ruler — Click to place a vertical guide line"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setHoverPosMm(null);
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
      >
        {/* Document In-Bounds Highlight Region */}
        <div
          className="absolute top-0 bottom-0 bg-[#eef3f9] pointer-events-none border-x border-slate-300/60"
          style={{
            left: `${Math.max(0, docStartPx)}px`,
            width: `${Math.max(0, docEndPx - docStartPx)}px`,
          }}
        />

        {/* Ticks */}
        {ticks.map((tick, idx) => {
          const isMajor = tick.type === 'major';
          const isMedium = tick.type === 'medium';
          const heightPx = isMajor ? 8 : isMedium ? 5.5 : 3.5;
          const isZero = tick.isOrigin;

          return (
            <React.Fragment key={`h-frag-${idx}-${tick.unitValue}`}>
              {/* Tick Line */}
              <div
                className="absolute bottom-0 pointer-events-none"
                style={{
                  left: `${tick.screenPos}px`,
                  height: `${heightPx}px`,
                  width: '1px',
                  backgroundColor: isZero ? '#1d4ed8' : isMajor ? '#334155' : '#64748b',
                  zIndex: isZero ? 6 : isMajor ? 4 : 2,
                }}
              />
              {/* Numeric Label placed cleanly at top of ruler */}
              {isMajor && tick.label !== undefined && (
                <div
                  className={`absolute pointer-events-none select-none text-[9px] font-medium leading-none ${
                    isZero
                      ? 'text-blue-700 font-bold z-10'
                      : tick.isInDocument
                      ? 'text-slate-800'
                      : 'text-slate-500'
                  }`}
                  style={{
                    left: `${tick.screenPos + 2}px`,
                    top: '2px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tick.label}
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Guide Markers on Ruler */}
        {relevantGuides.map((guide) => {
          const guidePx = unitToScreenPx(
            unit === 'inch' ? guide.position / MM_PER_INCH : unit === 'px' ? guide.position * (BASE_DPI / MM_PER_INCH) : guide.position,
            unit,
            zoom,
            panOffset
          );
          return (
            <div
              key={`guide-${guide.id}`}
              className="absolute top-0 bottom-0 w-px bg-cyan-600 z-10 pointer-events-none shadow-xs"
              style={{ left: `${guidePx}px` }}
            >
              <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full -translate-x-[2px] -translate-y-0.5" />
            </div>
          );
        })}

        {/* Live Cursor Tracking Hairline */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-600 z-20 pointer-events-none"
          style={{ left: `${cursorScreenPx}px` }}
        />

        {/* Hover Tooltip position readout */}
        {isHovered && hoverPosMm !== null && (
          <div
            className="absolute top-0 bg-slate-900/90 text-white text-[8px] font-mono px-1 rounded-xs pointer-events-none z-30 transform -translate-x-1/2"
            style={{ left: `${cursorScreenPx}px` }}
          >
            {hoverPosMm}{unit}
          </div>
        )}
      </div>
    );
  }

  // Vertical Ruler
  return (
    <div
      ref={containerRef}
      className="w-5 h-full bg-[#dbe4ef] border-r border-[#cbd5e1] relative overflow-hidden select-none cursor-crosshair shrink-0 font-sans"
      title="Vertical Ruler — Click to place a horizontal guide line"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoverPosMm(null);
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
    >
      {/* Document In-Bounds Highlight Region */}
      <div
        className="absolute left-0 right-0 bg-[#eef3f9] pointer-events-none border-y border-slate-300/60"
        style={{
          top: `${Math.max(0, docStartPx)}px`,
          height: `${Math.max(0, docEndPx - docStartPx)}px`,
        }}
      />

      {/* Ticks & Numeric Labels */}
      {ticks.map((tick, idx) => {
        const isMajor = tick.type === 'major';
        const isMedium = tick.type === 'medium';
        const widthPx = isMajor ? 8 : isMedium ? 5.5 : 3.5;
        const isZero = tick.isOrigin;

        return (
          <React.Fragment key={`v-frag-${idx}-${tick.unitValue}`}>
            {/* Tick Line */}
            <div
              className="absolute right-0 pointer-events-none"
              style={{
                top: `${tick.screenPos}px`,
                width: `${widthPx}px`,
                height: '1px',
                backgroundColor: isZero ? '#1d4ed8' : isMajor ? '#334155' : '#64748b',
                zIndex: isZero ? 6 : isMajor ? 4 : 2,
              }}
            />
            {/* Numeric Label placed on the left side of the vertical ruler */}
            {isMajor && tick.label !== undefined && (
              <div
                className={`absolute pointer-events-none select-none text-[8.5px] font-medium leading-none ${
                  isZero
                    ? 'text-blue-700 font-bold z-10'
                    : tick.isInDocument
                    ? 'text-slate-800'
                    : 'text-slate-500'
                }`}
                style={{
                  left: '1.5px',
                  top: `${tick.screenPos - 4}px`,
                  whiteSpace: 'nowrap',
                }}
              >
                {tick.label}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Guide Markers on Ruler */}
      {relevantGuides.map((guide) => {
        const guidePx = unitToScreenPx(
          unit === 'inch' ? guide.position / MM_PER_INCH : unit === 'px' ? guide.position * (BASE_DPI / MM_PER_INCH) : guide.position,
          unit,
          zoom,
          panOffset
        );
        return (
          <div
            key={`guide-${guide.id}`}
            className="absolute left-0 right-0 h-px bg-cyan-600 z-10 pointer-events-none shadow-xs"
            style={{ top: `${guidePx}px` }}
          >
            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full -translate-y-[2px] -translate-x-0.5" />
          </div>
        );
      })}

      {/* Live Cursor Tracking Hairline */}
      <div
        className="absolute left-0 right-0 h-px bg-red-600 z-20 pointer-events-none"
        style={{ top: `${cursorScreenPx}px` }}
      />
    </div>
  );
};

export const HorizontalRuler: React.FC<Omit<RulerProps, 'orientation'>> = (props) => (
  <Ruler {...props} orientation="horizontal" />
);

export const VerticalRuler: React.FC<Omit<RulerProps, 'orientation'>> = (props) => (
  <Ruler {...props} orientation="vertical" />
);

export interface RulerCornerProps {
  unit: UnitType;
  onToggleUnit?: () => void;
}

export const RulerCorner: React.FC<RulerCornerProps> = ({ unit, onToggleUnit }) => {
  return (
    <div
      onClick={onToggleUnit}
      className={`w-5 h-5 bg-[#d8e2ee] border-r border-b border-[#cbd5e1] shrink-0 flex items-center justify-center text-[8px] font-sans font-bold text-slate-700 select-none ${
        onToggleUnit ? 'hover:bg-[#c9d8e8] cursor-pointer active:bg-[#b8cde2]' : 'cursor-default'
      }`}
      title={onToggleUnit ? `Measurement Unit: ${unit} (Click to toggle)` : `Unit: ${unit}`}
    >
      {unit}
    </div>
  );
};
