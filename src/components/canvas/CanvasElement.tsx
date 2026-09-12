import React, { useEffect, useRef, useState } from 'react';
import { LabelElement, BarcodeElement, TextElement, ShapeElement, ImageElement, TableElement } from '../../types';
import { renderBarcodeToCanvas } from '../../services/barcodeEngine';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { measureTextObject } from '../../services/textMeasurementEngine';
import { InlineTextEditor } from './InlineTextEditor';
import { Lock } from 'lucide-react';

interface CanvasElementProps {
  element: LabelElement;
  isSelected: boolean;
  isEditing?: boolean;
  onSelect: (e: React.MouseEvent, el: LabelElement) => void;
  onDoubleClick?: (el: LabelElement) => void;
  onStartEdit?: (el: LabelElement) => void;
  onCommitEdit?: (id: string, newText: string) => void;
  onCancelEdit?: () => void;
  onDraftResize?: (id: string, widthMm: number, heightMm: number) => void;
  scale: number; // px per mm
  recordData: Record<string, string>;
  onStartDrag: (e: React.MouseEvent, el: LabelElement) => void;
  onStartResize: (e: React.MouseEvent, handle: string, el: LabelElement) => void;
  onStartRotate: (e: React.MouseEvent, el: LabelElement) => void;
  onContextMenu: (e: React.MouseEvent, el: LabelElement) => void;
  onBindField?: (elementId: string, payload: any) => void;
  labelDimensions?: { width: number; height: number };
}

export const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  isSelected,
  isEditing = false,
  onSelect,
  onDoubleClick,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDraftResize,
  scale,
  recordData,
  onStartDrag,
  onStartResize,
  onStartRotate,
  onContextMenu,
  onBindField,
  labelDimensions,
}) => {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [barcodeRenderError, setBarcodeRenderError] = useState(false);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const evaluatedContent = evaluateElementData(element, { record: recordData });
  const isLocked = !!element.locked;
  const isEditable = !isLocked && (element.editable !== undefined ? element.editable : element.isEditable !== undefined ? element.isEditable : true);
  const allowMove = isEditable && element.allowMove !== false;
  const allowResize = isEditable && element.allowResize !== false;
  const allowRotate = isEditable && element.allowRotate !== false;
  const isMissingField = typeof evaluatedContent === 'string' && evaluatedContent.startsWith('⚠ Missing Field');

  const isTextEl = element.type === 'text';
  const textEl = isTextEl ? (element as TextElement) : null;
  const isTextAutoSize =
    isTextEl &&
    textEl &&
    textEl.autoSize !== false &&
    (textEl.autoSize === true ||
      textEl.autoSizeConfig?.enabled === true ||
      textEl.textType === 'single-line' ||
      !textEl.textType ||
      textEl.textFormatType === 'single-line');

  let dynamicWidth = element.width;
  let dynamicHeight = element.height;

  if (isTextAutoSize && textEl) {
    const isParagraph = textEl.textFormatType === 'paragraph' || textEl.textType === 'paragraph';
    const dims = measureTextObject({
      text: typeof evaluatedContent === 'string' ? evaluatedContent : textEl.text,
      fontFamily: textEl.fontFamily,
      fontSize: textEl.fontSize,
      fontWeight: textEl.fontWeight,
      fontStyle: textEl.fontStyle,
      letterSpacing: textEl.letterSpacing,
      lineHeight: textEl.lineHeight,
      fontWidthScale: textEl.fontWidthScale,
      textType: textEl.textType,
      textFormatType: textEl.textFormatType,
      multiline: textEl.multiline,
      wrap: textEl.wrap || textEl.wordWrap,
      containerWidthMm: isParagraph && textEl.width > 0 ? textEl.width : undefined,
      borderConfig: textEl.borderConfig,
    });
    dynamicWidth = isParagraph && textEl.width > 0 ? textEl.width : dims.width;
    dynamicHeight = dims.height;
  }

  // Position & Dimensions in screen pixels
  const leftPx = element.x * scale;
  const topPx = element.y * scale;
  const widthPx = dynamicWidth * scale;
  const heightPx = dynamicHeight * scale;

  // Out of bounds detection
  const isOutOfBounds = labelDimensions
    ? element.x < 0 ||
      element.y < 0 ||
      element.x + dynamicWidth > labelDimensions.width ||
      element.y + dynamicHeight > labelDimensions.height
    : false;

  // Re-render barcode when value or element specs change
  useEffect(() => {
    if (element.type === 'barcode' && barcodeCanvasRef.current) {
      const barcodeEl = element as BarcodeElement;
      renderBarcodeToCanvas(
        barcodeCanvasRef.current,
        barcodeEl,
        2,
        { record: recordData }
      )
        .then(() => setBarcodeRenderError(false))
        .catch(() => setBarcodeRenderError(true));
    }
  }, [element, recordData, scale]);

  if (!element.visible) return null;

  return (
    <div
      id={`canvas-el-${element.id}`}
      className={`absolute select-none transition-all duration-75 ${
        isEditing
          ? 'ring-1 ring-[#16a34a] ring-offset-1 shadow-sm bg-white/40'
          : isDragOverTarget
          ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)] bg-emerald-50/25'
          : isMissingField
          ? 'ring-2 ring-red-500 bg-red-50/20'
          : !allowMove
          ? isLocked ? 'cursor-not-allowed ring-1 ring-amber-400/50' : 'cursor-default'
          : 'cursor-move'
      } ${
        isSelected && !isEditing && !isDragOverTarget && !isMissingField
          ? isLocked ? 'ring-2 ring-amber-500 shadow-xs' : 'ring-1 ring-[#16a34a] shadow-xs'
          : !isEditing && !isDragOverTarget && !isMissingField ? 'hover:ring-1 hover:ring-[#93c5fd]' : ''
      }`}
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        transform: `rotate(${element.rotation || 0}deg)`,
        transformOrigin: 'center center',
        opacity: element.opacity !== undefined ? element.opacity : 1,
        zIndex: isDragOverTarget ? 999 : element.zIndex,
      }}
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.stopPropagation();
          onSelect(e, element);
          if (allowMove && !isEditing) {
            onStartDrag(e, element);
          }
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e, element);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(e, element);
        onContextMenu(e, element);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (element.type === 'text' && onStartEdit) {
          onStartEdit(element);
        } else if (onDoubleClick) {
          onDoubleClick(element);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/json')) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          if (!isDragOverTarget) setIsDragOverTarget(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverTarget(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverTarget(false);
        try {
          const raw = e.dataTransfer.getData('application/json');
          if (!raw) return;
          const payload = JSON.parse(raw);
          if (payload.type === 'database-field' && onBindField) {
            onBindField(element.id, payload);
          }
        } catch (err) {
          console.error('Error binding dropped field to element:', err);
        }
      }}
    >
      {/* Visual Indicator when hovering over compatible drop target */}
      {isDragOverTarget && (
        <div className="absolute -top-6 left-1/2 -translate-y-1/2 bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none z-50">
          ✓ Drop to bind {element.type === 'barcode' ? 'Barcode' : 'Text'}
        </div>
      )}

      {/* Out of Bounds Warning Badge */}
      {isOutOfBounds && isSelected && !isEditing && (
        <div className="absolute -top-6 left-0 bg-amber-600 text-white font-semibold text-[9.5px] px-1.5 py-0.5 rounded shadow z-50 whitespace-nowrap flex items-center gap-1 pointer-events-none ring-1 ring-white/50">
          <span>⚠ {element.type === 'barcode' ? 'Barcode extends outside printable area' : 'Object extends outside printable area'}</span>
        </div>
      )}

      {/* Element Content Rendering */}
      {element.type === 'text' && (() => {
        const textEl = element as TextElement;

        // Render live Inline Text Editor if actively editing
        if (isEditing && onCommitEdit && onCancelEdit) {
          return (
            <InlineTextEditor
              element={textEl}
              scale={scale}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              onDraftDimensionsChange={onDraftResize}
            />
          );
        }

        // Border configuration
        const border = textEl.borderConfig;
        const hasBorder = border && border.type !== 'none';
        const isEllipseBorder = border?.type === 'ellipse';
        const borderStyle = border?.dashStyle || 'solid';
        const borderWidthPx = (border?.thickness || 1) * (scale / 3.78) * 0.35;
        const cornerRadiusPx = (border?.cornerSize || 0) * scale;
        const borderFill = border?.fillColor && (border?.fillTransparency ?? 0) < 100 ? border.fillColor : 'transparent';

        // Margins in screen pixels
        const mTop = (border?.marginTop || 0) * scale;
        const mLeft = (border?.marginLeft || 0) * scale;
        const mBottom = (border?.marginBottom || 0) * scale;
        const mRight = (border?.marginRight || 0) * scale;

        // Arc Text rendering with SVG Path
        if (textEl.textFormatType === 'arc' || textEl.textType === 'arc') {
          const pathId = `arc-path-${textEl.id}`;
          const arc = textEl.arcConfig || {
            radius: textEl.arcRadius || 50,
            startAngle: textEl.arcStartAngle || 0,
            sweepAngle: textEl.arcSweepAngle || 180,
            direction: textEl.arcDirection || 'clockwise',
            insidePath: !!textEl.arcInsidePath,
            characterSpacing: textEl.arcCharacterSpacing || 1,
          };

          const rad = arc.radius * scale;
          const cx = widthPx / 2;
          const cy = heightPx / 2;
          const startRad = (arc.startAngle * Math.PI) / 180;
          const sweepRad = (arc.sweepAngle * Math.PI) / 180;
          const endAngle = arc.direction === 'counter-clockwise' ? arc.startAngle - arc.sweepAngle : arc.startAngle + arc.sweepAngle;
          const endRad = (endAngle * Math.PI) / 180;

          const x1 = cx + rad * Math.cos(startRad);
          const y1 = cy + rad * Math.sin(startRad);
          const x2 = cx + rad * Math.cos(endRad);
          const y2 = cy + rad * Math.sin(endRad);
          const largeArc = arc.sweepAngle > 180 ? 1 : 0;
          const sweepFlag = arc.direction === 'counter-clockwise' ? 0 : 1;

          const pathData = `M ${x1},${y1} A ${rad},${rad} 0 ${largeArc} ${sweepFlag} ${x2},${y2}`;

          return (
            <div
              className={`w-full h-full overflow-hidden flex items-center justify-center ${
                isEllipseBorder ? 'rounded-full' : ''
              }`}
              style={{
                border: hasBorder ? `${borderWidthPx}px ${borderStyle} ${border?.color || '#000'}` : undefined,
                borderRadius: !isEllipseBorder && cornerRadiusPx > 0 ? `${cornerRadiusPx}px` : undefined,
                backgroundColor: borderFill !== 'transparent' ? borderFill : textEl.whiteOnBlack ? '#000000' : textEl.backgroundColor || 'transparent',
                paddingTop: `${mTop}px`,
                paddingLeft: `${mLeft}px`,
                paddingBottom: `${mBottom}px`,
                paddingRight: `${mRight}px`,
              }}
            >
              <svg className="w-full h-full" viewBox={`0 0 ${widthPx} ${heightPx}`} preserveAspectRatio="xMidYMid meet">
                <path id={pathId} d={pathData} fill="none" stroke="transparent" />
                <text
                  fill={textEl.whiteOnBlack ? '#ffffff' : textEl.color || '#000000'}
                  fontSize={(textEl.fontSize || 10) * (25.4 / 72) * scale}
                  fontFamily={textEl.fontFamily || 'Arial, sans-serif'}
                  fontWeight={textEl.fontWeight || 'normal'}
                  fontStyle={textEl.fontStyle || 'normal'}
                  letterSpacing={textEl.letterSpacing || 1}
                >
                  <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                    {evaluatedContent}
                  </textPath>
                </text>
              </svg>
            </div>
          );
        }

        // Standard Font Size in screen pixels (1 pt = 25.4/72 mm * scale)
        const baseFontSizePx = (textEl.fontSize || 10) * (25.4 / 72) * scale;
        let effectiveFontSize = baseFontSizePx;

        // Explicit Auto-Fit font scaling only when enabled on a fixed-size container (autoFit === true && !isTextAutoSize)
        if (textEl.autoFit && !isTextAutoSize && evaluatedContent) {
          const maxW = Math.max(10, widthPx - mLeft - mRight);
          const maxH = Math.max(10, heightPx - mTop - mBottom);
          const textLength = evaluatedContent.length || 1;
          const approxCharWidthRatio = 0.55;
          const minSz = (textEl.autoSizeConfig?.minFontSize ?? textEl.minFontSize ?? 6) * (25.4 / 72) * scale;
          const maxSz = (textEl.autoSizeConfig?.maxFontSize ?? textEl.maxFontSize ?? 720) * (25.4 / 72) * scale;

          if (!textEl.multiline && textEl.textType !== 'multi-line' && textEl.textFormatType !== 'paragraph') {
            const estimatedWidth = textLength * effectiveFontSize * approxCharWidthRatio;
            if (estimatedWidth > maxW && maxW > 0) {
              const widthRatio = maxW / estimatedWidth;
              effectiveFontSize = Math.max(minSz, Math.min(maxSz, effectiveFontSize * widthRatio));
            }
            if (effectiveFontSize * 1.2 > maxH && maxH > 0) {
              effectiveFontSize = Math.max(minSz, Math.min(maxSz, maxH * 0.75));
            }
          } else {
            const charsPerLine = Math.max(1, Math.floor(maxW / (effectiveFontSize * approxCharWidthRatio)));
            const estimatedLines = Math.ceil(textLength / charsPerLine);
            const estimatedHeight = estimatedLines * effectiveFontSize * (textEl.lineHeight || 1.15);
            if (estimatedHeight > maxH && maxH > 0) {
              const heightRatio = Math.sqrt(maxH / estimatedHeight);
              effectiveFontSize = Math.max(minSz, Math.min(maxSz, effectiveFontSize * heightRatio));
            }
          }
        }

        // HTML & Word Processor Rich Text Markup Container
        if (textEl.textType === 'html' || textEl.textType === 'word-processor' || textEl.textType === 'rtf' || textEl.textType === 'xaml' || textEl.richContentHtml) {
          let htmlToRender = textEl.richContentHtml || evaluatedContent;
          if (textEl.textType === 'rtf' && htmlToRender.startsWith('{\\rtf')) {
            htmlToRender = htmlToRender
              .replace(/\{\\rtf1[^\\]*/g, '')
              .replace(/\\b\s*(.*?)\\b0/g, '<b>$1</b>')
              .replace(/\\i\s*(.*?)\\i0/g, '<i>$1</i>')
              .replace(/\\par/g, '<br/>')
              .replace(/[\{\}]/g, '');
          }

          return (
            <div
              className={`w-full h-full overflow-hidden p-0.5 ${isEllipseBorder ? 'rounded-full' : ''}`}
              style={{
                fontFamily: textEl.fontFamily || 'Arial, sans-serif',
                fontSize: `${effectiveFontSize}px`,
                color: textEl.whiteOnBlack ? '#ffffff' : textEl.color || '#000000',
                backgroundColor: borderFill !== 'transparent' ? borderFill : textEl.whiteOnBlack ? '#000000' : textEl.backgroundColor || 'transparent',
                lineHeight: textEl.lineHeight || 1.25,
                border: hasBorder ? `${borderWidthPx}px ${borderStyle} ${border?.color || '#000'}` : undefined,
                borderRadius: !isEllipseBorder && cornerRadiusPx > 0 ? `${cornerRadiusPx}px` : undefined,
                paddingTop: `${mTop}px`,
                paddingLeft: `${mLeft}px`,
                paddingBottom: `${mBottom}px`,
                paddingRight: `${mRight}px`,
              }}
              dangerouslySetInnerHTML={{ __html: htmlToRender }}
            />
          );
        }

        // Standard Single-Line / Paragraph / Multi-Line text
        const isUnderline = textEl.underline || textEl.textDecoration === 'underline';
        const isStrikeout = textEl.strikeout || textEl.textDecoration === 'line-through';
        const textDecor = isUnderline && isStrikeout ? 'underline line-through' : isUnderline ? 'underline' : isStrikeout ? 'line-through' : 'none';
        const fontScale = (textEl.fontWidthScale || 100) / 100;

        return (
          <div
            className={`w-full h-full overflow-hidden flex ${isEllipseBorder ? 'rounded-full' : ''}`}
            style={{
              fontFamily: textEl.fontFamily || 'Arial, sans-serif',
              fontSize: `${effectiveFontSize}px`,
              fontWeight: textEl.fontWeight || 'normal',
              fontStyle: textEl.fontStyle || 'normal',
              textDecoration: textDecor,
              color: textEl.whiteOnBlack ? '#ffffff' : textEl.color || '#000000',
              backgroundColor: borderFill !== 'transparent' ? borderFill : textEl.whiteOnBlack ? '#000000' : textEl.backgroundColor || 'transparent',
              letterSpacing: `${textEl.letterSpacing || 0}px`,
              lineHeight: textEl.lineHeight || 1.15,
              transform: fontScale !== 1 ? `scaleX(${fontScale})` : undefined,
              transformOrigin: textEl.textAlign === 'center' ? 'center' : textEl.textAlign === 'right' ? 'right' : 'left',
              border: hasBorder ? `${borderWidthPx}px ${borderStyle} ${border?.color || '#000'}` : undefined,
              borderRadius: !isEllipseBorder && cornerRadiusPx > 0 ? `${cornerRadiusPx}px` : undefined,
              paddingTop: `${mTop}px`,
              paddingLeft: `${mLeft}px`,
              paddingBottom: `${mBottom}px`,
              paddingRight: `${mRight}px`,
              justifyContent:
                textEl.textAlign === 'center' || textEl.horizontalAlignment === 'center'
                  ? 'center'
                  : textEl.textAlign === 'right' || textEl.horizontalAlignment === 'right'
                  ? 'flex-end'
                  : 'flex-start',
              alignItems:
                textEl.verticalAlign === 'middle' || textEl.verticalAlignment === 'middle'
                  ? 'center'
                  : textEl.verticalAlign === 'bottom' || textEl.verticalAlignment === 'bottom'
                  ? 'flex-end'
                  : 'flex-start',
              whiteSpace: textEl.multiline || textEl.textType === 'multi-line' || textEl.textFormatType === 'paragraph' ? 'pre-wrap' : 'nowrap',
            }}
          >
            {evaluatedContent}
          </div>
        );
      })()}

      {element.type === 'barcode' && (() => {
        const barcodeEl = element as BarcodeElement;
        const hasBorder = barcodeEl.borderType && barcodeEl.borderType !== 'none';
        const isEllipse = barcodeEl.borderType === 'ellipse';
        const cornerPx = barcodeEl.cornerRadius ? barcodeEl.cornerRadius * scale : 0;
        const padPx = barcodeEl.borderPadding !== undefined ? barcodeEl.borderPadding * scale : 2;

        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center overflow-hidden ${
              isEllipse ? 'rounded-full' : ''
            }`}
            style={{
              backgroundColor:
                barcodeEl.borderFillColor && barcodeEl.borderFillColor !== 'None'
                  ? barcodeEl.borderFillColor
                  : 'rgba(255, 255, 255, 0.6)',
              borderWidth: hasBorder ? `${Math.max(1, (barcodeEl.borderThickness || 1) * scale * 0.75)}px` : '0px',
              borderColor: barcodeEl.borderColor || '#000000',
              borderStyle: barcodeEl.borderDashStyle || 'solid',
              borderRadius: isEllipse ? '50%' : cornerPx > 0 ? `${cornerPx}px` : undefined,
              padding: `${padPx}px`,
            }}
          >
            <canvas
              ref={barcodeCanvasRef}
              className="max-w-full max-h-full object-contain p-1"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        );
      })()}

      {element.type === 'shape' && (
        <div className="w-full h-full">
          {(element as ShapeElement).shapeType === 'rectangle' && (
            <div
              className="w-full h-full"
              style={{
                backgroundColor: (element as ShapeElement).fillColor || 'transparent',
                borderColor: (element as ShapeElement).strokeColor || '#000000',
                borderWidth: `${(element as ShapeElement).strokeWidth * scale}px`,
                borderStyle: (element as ShapeElement).strokeStyle || 'solid',
                borderRadius: `${(element as ShapeElement).cornerRadius * scale}px`,
              }}
            />
          )}

          {(element as ShapeElement).shapeType === 'circle' && (
            <div
              className="w-full h-full rounded-full"
              style={{
                backgroundColor: (element as ShapeElement).fillColor || 'transparent',
                borderColor: (element as ShapeElement).strokeColor || '#000000',
                borderWidth: `${(element as ShapeElement).strokeWidth * scale}px`,
                borderStyle: (element as ShapeElement).strokeStyle || 'solid',
              }}
            />
          )}

          {(element as ShapeElement).shapeType === 'line' && (
            <div
              className="w-full h-0 border-t"
              style={{
                borderColor: (element as ShapeElement).strokeColor || '#000000',
                borderTopWidth: `${(element as ShapeElement).strokeWidth * scale}px`,
                borderStyle: (element as ShapeElement).strokeStyle || 'solid',
                marginTop: `${heightPx / 2}px`,
              }}
            />
          )}
        </div>
      )}

      {element.type === 'image' && (
        <div className="w-full h-full overflow-hidden">
          <img
            src={(element as ImageElement).src}
            alt={element.name}
            className="w-full h-full pointer-events-none"
            style={{
              objectFit: (element as ImageElement).objectFit || 'contain',
              filter: `${(element as ImageElement).grayscale ? 'grayscale(100%)' : ''} ${(element as ImageElement).invert ? 'invert(100%)' : ''}`,
            }}
          />
        </div>
      )}

      {/* Lock Indicator */}
      {isLocked && (
        <div
          title="Field Locked (Fixed Layout / Immutable)"
          className="absolute top-1 right-1 bg-amber-500 text-white p-0.5 rounded shadow-xs z-30 flex items-center justify-center ring-1 ring-white/50"
        >
          <Lock className="w-3 h-3" />
        </div>
      )}

      {/* Resize Handles if selected, not actively editing, and allowed */}
      {isSelected && !isEditing && allowResize && (
        <>
          {/* Top-Left */}
          <div
            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-nwse-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-left', element);
            }}
          />
          {/* Top-Center */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-ns-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-center', element);
            }}
          />
          {/* Top-Right */}
          <div
            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-nesw-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'top-right', element);
            }}
          />
          {/* Middle-Left */}
          <div
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-ew-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'middle-left', element);
            }}
          />
          {/* Middle-Right */}
          <div
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-ew-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'middle-right', element);
            }}
          />
          {/* Bottom-Left */}
          <div
            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-nesw-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-left', element);
            }}
          />
          {/* Bottom-Center */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-ns-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-center', element);
            }}
          />
          {/* Bottom-Right */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#16a34a] rounded-xs cursor-nwse-resize z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(e, 'bottom-right', element);
            }}
          />
        </>
      )}

      {/* Rotate Handle if selected, not editing, and allowed */}
      {isSelected && !isEditing && allowRotate && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20"
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartRotate(e, element);
          }}
        >
          <div className="w-3.5 h-3.5 bg-emerald-600 rounded-full border-2 border-white shadow-xs" />
          <div className="w-0.5 h-3.5 bg-emerald-600" />
        </div>
      )}
    </div>
  );
};
