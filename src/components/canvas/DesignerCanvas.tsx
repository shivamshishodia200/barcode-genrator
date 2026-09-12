import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LabelTemplate, LabelElement, TextElement, CanvasGuide, ViewportState, OpenDocument } from '../../types';
import { measureTextObject } from '../../services/textMeasurementEngine';
import { evaluateElementData } from '../../services/dataSourceEngine';
import { HorizontalRuler, VerticalRuler, RulerCorner } from './Rulers';
import { CanvasElement } from './CanvasElement';
import { ContextMenu } from './ContextMenu';
import { RightVerticalToolbar } from './RightVerticalToolbar';
import { DocumentTabBar } from './DocumentTabBar';
import { Printer, Plus, ZoomIn, ZoomOut, Target, Maximize2, FileText, FolderOpen, ChevronDown, Check, Scan, MoveHorizontal, Frame } from 'lucide-react';

interface DesignerCanvasProps {
  template: LabelTemplate;
  selectedElementIds: string[];
  onSelectElements: (ids: string[]) => void;
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void;
  onUpdateMultipleElements: (updates: { id: string; updates: Partial<LabelElement> }[]) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onLockToggle: () => void;
  onOpenProperties?: () => void;
  onOpenBarcodePicker: () => void;
  onOpenBarcodeProperties?: () => void;
  onOpenPageSetup?: () => void;
  onInsertElementAt?: (el: Partial<LabelElement>, xMm: number, yMm: number) => void;
  onInsertPresetAt?: (presetKey: string, xMm: number, yMm: number) => void;
  onBindElementToField?: (elementId: string, payload: any) => void;
  onInsertBoundElementAt?: (payload: any, xMm: number, yMm: number, asType?: 'text' | 'barcode' | 'qr') => void;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  recordData: Record<string, string>;
  onCursorMove?: (xMm: number, yMm: number) => void;
  // Multi-Document Tabs
  documents?: OpenDocument[];
  activeInstanceId?: string | null;
  onSelectTab?: (instanceId: string) => void;
  onCloseTab?: (instanceId: string) => void;
  onNewTemplate?: () => void;
  onNewForm?: () => void;
  onOpenDocument?: () => void;
  onSaveDoc?: (instanceId: string) => void;
  onSaveAll?: () => void;
  onDuplicateDoc?: (instanceId: string) => void;
  onCloseOthers?: (instanceId: string) => void;
  onCloseAll?: () => void;
  activePrinterName?: string;
  activeTool?: string;
  onDataEditElement?: (element: LabelElement) => void;
}

export const DesignerCanvas: React.FC<DesignerCanvasProps> = ({
  template,
  selectedElementIds,
  onSelectElements,
  onUpdateElement,
  onUpdateMultipleElements,
  onDeleteSelected,
  onDuplicateSelected,
  onCut,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onGroup,
  onUngroup,
  onLockToggle,
  onOpenProperties,
  onOpenBarcodePicker,
  onOpenBarcodeProperties,
  onOpenPageSetup,
  onInsertElementAt,
  onInsertPresetAt,
  onBindElementToField,
  onInsertBoundElementAt,
  viewport,
  setViewport,
  recordData,
  onCursorMove,
  documents,
  activeInstanceId,
  onSelectTab,
  onCloseTab,
  onNewTemplate,
  onNewForm,
  onOpenDocument,
  onSaveDoc,
  onSaveAll,
  onDuplicateDoc,
  onCloseOthers,
  onCloseAll,
  activePrinterName,
  activeTool,
  onDataEditElement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorMm, setCursorMm] = useState({ x: 10.9, y: 22.1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Dragging elements state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragInitialElements, setDragInitialElements] = useState<{ id: string; x: number; y: number }[]>([]);

  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeInitialState, setResizeInitialState] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [resizingElementId, setResizingElementId] = useState<string | null>(null);

  // Rotation state
  const [isRotating, setIsRotating] = useState(false);
  const [rotatingElementId, setRotatingElementId] = useState<string | null>(null);
  const [rotateCenter, setRotateCenter] = useState<{ x: number; y: number } | null>(null);

  // Selection box state
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Interactive guides state
  const [guides, setGuides] = useState<CanvasGuide[]>([
    { id: 'g1', type: 'vertical', position: 10 },
    { id: 'g2', type: 'horizontal', position: 10 },
  ]);

  // Inline direct text editing state
  const [editingElementId, setEditingElementId] = useState<string | null>(null);

  // Exit edit mode if edited element is deselected
  useEffect(() => {
    if (editingElementId && !selectedElementIds.includes(editingElementId)) {
      setEditingElementId(null);
    }
  }, [selectedElementIds, editingElementId]);

  const handleStartTextEdit = useCallback((el: LabelElement) => {
    if (el.locked || el.isEditable === false || el.editable === false) return;
    if (el.type !== 'text') return;

    // Check if element is data-bound
    const isDataBound = Boolean(
      el.dataBinding ||
      (el.dataSources && el.dataSources.length > 0 && el.dataSources.some(ds => ds.type !== 'embedded' && ds.enabled !== false)) ||
      (el.dataSources && el.dataSources.length > 1)
    );

    if (isDataBound) {
      if (onDataEditElement) {
        onDataEditElement(el);
      } else if (onOpenProperties) {
        onOpenProperties();
      }
      return;
    }

    setEditingElementId(el.id);
  }, [onDataEditElement, onOpenProperties]);

  const handleCommitInlineText = useCallback((id: string, newText: string) => {
    const targetEl = template.elements.find((e) => e.id === id);
    if (!targetEl || targetEl.type !== 'text') {
      setEditingElementId(null);
      return;
    }

    const textEl = targetEl as TextElement;
    if (textEl.text === newText) {
      setEditingElementId(null);
      return;
    }

    const updates: Partial<TextElement> = {
      text: newText,
    };

    if (textEl.dataSources && textEl.dataSources.length === 1 && textEl.dataSources[0].type === 'embedded') {
      updates.dataSources = [{ ...textEl.dataSources[0], value: newText }];
    }

    const isAutoSizeActive =
      textEl.autoSize !== false &&
      (textEl.autoSize === true ||
        textEl.autoSizeConfig?.enabled === true ||
        textEl.textType === 'single-line' ||
        !textEl.textType ||
        textEl.textFormatType === 'single-line');

    if (isAutoSizeActive) {
      const isParagraph = textEl.textFormatType === 'paragraph' || textEl.textType === 'paragraph';
      const dims = measureTextObject({
        text: newText,
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
      updates.width = isParagraph && textEl.width > 0 ? textEl.width : dims.width;
      updates.height = dims.height;
      updates.autoSize = true;
    }

    onUpdateElement(id, updates);
    setEditingElementId(null);
  }, [template.elements, onUpdateElement]);

  const handleCancelInlineText = useCallback(() => {
    setEditingElementId(null);
  }, []);

  const handleDraftResize = useCallback((id: string, widthMm: number, heightMm: number) => {
    onUpdateElement(id, { width: widthMm, height: heightMm, autoSize: true });
  }, [onUpdateElement]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: LabelElement | null } | null>(null);

  // BarTender style Zoom popup menu state
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setIsZoomMenuOpen(false);
      }
    };
    if (isZoomMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isZoomMenuOpen]);

  // 1mm in screen pixels at 100% zoom = 3.7795px
  const baseScale = 3.7795;
  const scale = baseScale * viewport.zoom;

  // Selected Element
  const selectedElement = template.elements.find(el => selectedElementIds.includes(el.id)) || null;

  // Center label in the workspace viewport
  const centerInView = useCallback((customZoom?: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    setViewport(prev => {
      const currentZoom = customZoom !== undefined ? customZoom : prev.zoom;
      const currentScale = baseScale * currentZoom;
      const labelWidth = template.dimensions.width * currentScale;
      const labelHeight = template.dimensions.height * currentScale;

      // Center label precisely in the viewport
      const targetPanX = Math.round((containerWidth - labelWidth) / 2);
      const targetPanY = Math.round((containerHeight - labelHeight) / 2);

      return {
        ...prev,
        zoom: currentZoom,
        panX: targetPanX,
        panY: targetPanY,
      };
    });
  }, [template.dimensions.width, template.dimensions.height, setViewport]);

  // Zoom In (Centered on viewport)
  const handleZoomIn = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    setViewport(v => {
      const nextZoom = Math.min(32, Number((v.zoom * 1.25).toFixed(2)));
      const factor = nextZoom / v.zoom;
      const cX = containerWidth / 2;
      const cY = containerHeight / 2;
      const nextPanX = Math.round(cX - (cX - v.panX) * factor);
      const nextPanY = Math.round(cY - (cY - v.panY) * factor);
      return { ...v, zoom: nextZoom, panX: nextPanX, panY: nextPanY };
    });
  }, [setViewport]);

  // Zoom Out (Centered on viewport)
  const handleZoomOut = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    setViewport(v => {
      const nextZoom = Math.max(0.1, Number((v.zoom / 1.25).toFixed(2)));
      const factor = nextZoom / v.zoom;
      const cX = containerWidth / 2;
      const cY = containerHeight / 2;
      const nextPanX = Math.round(cX - (cX - v.panX) * factor);
      const nextPanY = Math.round(cY - (cY - v.panY) * factor);
      return { ...v, zoom: nextZoom, panX: nextPanX, panY: nextPanY };
    });
  }, [setViewport]);

  // Fit label to workspace with padding
  const fitToWindow = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const availW = Math.max(100, containerWidth - 60);
    const availH = Math.max(100, containerHeight - 60);

    const baseW = template.dimensions.width * baseScale;
    const baseH = template.dimensions.height * baseScale;

    const zoomW = availW / baseW;
    const zoomH = availH / baseH;
    const targetZoom = Math.max(0.1, Math.min(10.0, Number(Math.min(zoomW, zoomH).toFixed(2))));

    centerInView(targetZoom);
  }, [template.dimensions.width, template.dimensions.height, centerInView]);

  // Fit label width in window
  const fitTemplateWidthInWindow = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const availW = Math.max(100, containerWidth - 60);
    const baseW = template.dimensions.width * baseScale;
    const targetZoom = Math.max(0.1, Math.min(10.0, Number((availW / baseW).toFixed(2))));

    const labelHeight = template.dimensions.height * baseScale * targetZoom;
    const targetPanX = Math.round((containerWidth - baseW * targetZoom) / 2);
    const targetPanY = labelHeight < containerHeight ? Math.round((containerHeight - labelHeight) / 2) : 30;

    setViewport(v => ({
      ...v,
      zoom: targetZoom,
      panX: targetPanX,
      panY: targetPanY,
    }));
  }, [template.dimensions.width, template.dimensions.height, setViewport]);

  // Fit all objects in window
  const fitAllObjectsInWindow = useCallback(() => {
    if (!containerRef.current || template.elements.length === 0) {
      fitToWindow();
      return;
    }
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    template.elements.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    const bboxW = Math.max(5, maxX - minX);
    const bboxH = Math.max(5, maxY - minY);
    const centerObjX = (minX + maxX) / 2;
    const centerObjY = (minY + maxY) / 2;

    const availW = Math.max(100, containerWidth - 80);
    const availH = Math.max(100, containerHeight - 80);

    const baseW = bboxW * baseScale;
    const baseH = bboxH * baseScale;

    const targetZoom = Math.max(0.1, Math.min(16.0, Number(Math.min(availW / baseW, availH / baseH).toFixed(2))));

    const targetPanX = Math.round(containerWidth / 2 - centerObjX * baseScale * targetZoom);
    const targetPanY = Math.round(containerHeight / 2 - centerObjY * baseScale * targetZoom);

    setViewport(v => ({
      ...v,
      zoom: targetZoom,
      panX: targetPanX,
      panY: targetPanY,
    }));
  }, [template.elements, fitToWindow, setViewport]);

  // Zoom to selection / rectangle
  const zoomToSelection = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const selectedEls = template.elements.filter(el => selectedElementIds.includes(el.id));
    if (selectedEls.length === 0) {
      fitToWindow();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedEls.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    const bboxW = Math.max(5, maxX - minX);
    const bboxH = Math.max(5, maxY - minY);
    const centerSelX = (minX + maxX) / 2;
    const centerSelY = (minY + maxY) / 2;

    const availW = Math.max(100, containerWidth - 80);
    const availH = Math.max(100, containerHeight - 80);

    const baseW = bboxW * baseScale;
    const baseH = bboxH * baseScale;

    const targetZoom = Math.max(0.1, Math.min(24.0, Number(Math.min(availW / baseW, availH / baseH).toFixed(2))));

    const targetPanX = Math.round(containerWidth / 2 - centerSelX * baseScale * targetZoom);
    const targetPanY = Math.round(containerHeight / 2 - centerSelY * baseScale * targetZoom);

    setViewport(v => ({
      ...v,
      zoom: targetZoom,
      panX: targetPanX,
      panY: targetPanY,
    }));
  }, [selectedElementIds, template.elements, fitToWindow, setViewport]);

  // Auto-fit & center canvas ONLY on initial load and template ID change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToWindow();
    }, 80);
    return () => clearTimeout(timer);
  }, [template.id]);

  // Track spacebar for pan tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Snap helper function with fine precision (0.5mm on grid, 0.1mm free)
  const snapValue = useCallback((val: number, gridSizeMm: number = 0.5) => {
    if (!viewport.snapToGrid) return Number((Math.round(val * 10) / 10).toFixed(1));
    return Number((Math.round(val / gridSizeMm) * gridSizeMm).toFixed(1));
  }, [viewport.snapToGrid]);

  // Handle Mouse Move over workspace
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to mm on canvas
    const xMm = (mouseX - viewport.panX) / scale;
    const yMm = (mouseY - viewport.panY) / scale;
    const roundedX = Math.round(xMm * 10) / 10;
    const roundedY = Math.round(yMm * 10) / 10;
    setCursorMm({ x: roundedX, y: roundedY });
    onCursorMove?.(roundedX, roundedY);

    // 1. Panning Workspace
    if (isPanning) {
      setViewport(prev => ({
        ...prev,
        panX: prev.panX + (e.clientX - panStart.x),
        panY: prev.panY + (e.clientY - panStart.y),
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 2. Dragging Elements with smooth delta & unbounded movement beyond label boundaries
    if (isDragging && dragInitialElements.length > 0) {
      const deltaX = (e.clientX - dragStartPos.x) / scale;
      const deltaY = (e.clientY - dragStartPos.y) / scale;

      const updates = dragInitialElements.map(item => {
        const targetX = item.x + deltaX;
        const targetY = item.y + deltaY;

        return {
          id: item.id,
          updates: {
            x: snapValue(targetX),
            y: snapValue(targetY),
          },
        };
      });
      onUpdateMultipleElements(updates);
      return;
    }

    // 3. Resizing Element
    if (isResizing && resizingElementId && resizeInitialState && resizeHandle) {
      const deltaX = (e.clientX - dragStartPos.x) / scale;
      const deltaY = (e.clientY - dragStartPos.y) / scale;
      let { x, y, w, h } = resizeInitialState;

      if (resizeHandle.includes('right')) w = Math.max(2, snapValue(w + deltaX));
      if (resizeHandle.includes('bottom')) h = Math.max(2, snapValue(h + deltaY));
      if (resizeHandle.includes('left')) {
        const newW = Math.max(2, snapValue(w - deltaX));
        x = snapValue(x + (w - newW));
        w = newW;
      }
      if (resizeHandle.includes('top')) {
        const newH = Math.max(2, snapValue(h - deltaY));
        y = snapValue(y + (h - newH));
        h = newH;
      }

      const targetEl = template.elements.find((el) => el.id === resizingElementId);
      if (targetEl && targetEl.type === 'text') {
        const textEl = targetEl as TextElement;
        const isParagraph = textEl.textFormatType === 'paragraph' || textEl.textType === 'paragraph';

        // In paragraph mode with horizontal resize only, reflow height dynamically
        if (
          isParagraph &&
          (resizeHandle === 'middle-left' || resizeHandle === 'middle-right') &&
          textEl.autoSize !== false
        ) {
          const dims = measureTextObject({
            text: evaluateElementData(textEl, { record: recordData }),
            fontFamily: textEl.fontFamily,
            fontSize: textEl.fontSize,
            fontWeight: textEl.fontWeight,
            fontStyle: textEl.fontStyle,
            letterSpacing: textEl.letterSpacing,
            lineHeight: textEl.lineHeight,
            fontWidthScale: textEl.fontWidthScale,
            textType: textEl.textType,
            textFormatType: textEl.textFormatType,
            multiline: true,
            wrap: true,
            containerWidthMm: w,
            borderConfig: textEl.borderConfig,
          });
          h = dims.height;
          onUpdateElement(resizingElementId, { x, y, width: w, height: h, autoSize: true });
        } else {
          // Explicit manual resize disables Auto Size
          onUpdateElement(resizingElementId, { x, y, width: w, height: h, autoSize: false, autoFit: false });
        }
      } else {
        onUpdateElement(resizingElementId, { x, y, width: w, height: h });
      }
      return;
    }

    // 4. Rotating Element
    if (isRotating && rotatingElementId && rotateCenter) {
      const angleRad = Math.atan2(e.clientY - rotateCenter.y, e.clientX - rotateCenter.x);
      let angleDeg = Math.round((angleRad * 180) / Math.PI + 90);
      if (angleDeg < 0) angleDeg += 360;
      if (e.shiftKey) {
        angleDeg = Math.round(angleDeg / 15) * 15;
      }
      onUpdateElement(rotatingElementId, { rotation: angleDeg % 360 });
      return;
    }

    // 5. Box Selecting
    if (isBoxSelecting && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    }
  };

  // Mouse Up End Actions
  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);

    if (isBoxSelecting && selectionBox && containerRef.current) {
      const dragDist = Math.hypot(selectionBox.startX - selectionBox.currentX, selectionBox.startY - selectionBox.currentY);
      // Only perform multi-element bounding box selection if user actively dragged > 4px
      if (dragDist > 4) {
        const rect = containerRef.current.getBoundingClientRect();
        const minX = (Math.min(selectionBox.startX, selectionBox.currentX) - rect.left - viewport.panX) / scale;
        const maxX = (Math.max(selectionBox.startX, selectionBox.currentX) - rect.left - viewport.panX) / scale;
        const minY = (Math.min(selectionBox.startY, selectionBox.currentY) - rect.top - viewport.panY) / scale;
        const maxY = (Math.max(selectionBox.startY, selectionBox.currentY) - rect.top - viewport.panY) / scale;

        const hitElements = template.elements.filter(
          el => el.x < maxX && el.x + el.width > minX && el.y < maxY && el.y + el.height > minY
        );
        onSelectElements(hitElements.map(el => el.id));
      }
    }
    setIsBoxSelecting(false);
    setSelectionBox(null);
  };

  // Start Canvas Background Mouse Down (Pan or Box Select or Deselect)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 0) {
      const target = e.target as HTMLElement;
      const isElementClick = target.closest('[id^="canvas-el-"]');
      if (isElementClick) {
        return; // Clicked on element, do not trigger background deselection or box select
      }
      if (!e.shiftKey) {
        onSelectElements([]);
      }
      setIsBoxSelecting(true);
      setSelectionBox({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    }
  };

  // Mouse Wheel Zoom / Pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setViewport(prev => ({
        ...prev,
        zoom: Math.max(0.1, Math.min(8, Number((prev.zoom + delta).toFixed(2)))),
      }));
    } else {
      setViewport(prev => ({
        ...prev,
        panX: prev.panX - e.deltaX * 0.5,
        panY: prev.panY - e.deltaY * 0.5,
      }));
    }
  };

  // Element Selection with Group Awareness
  const handleElementSelect = (e: React.MouseEvent, element: LabelElement) => {
    e.stopPropagation();
    if (activeTool === 'data-edit') {
      onSelectElements([element.id]);
      if (onDataEditElement) {
        onDataEditElement(element);
      }
      return;
    }

    const targetGroupIds = element.groupId
      ? template.elements.filter((el) => el.groupId === element.groupId).map((el) => el.id)
      : [element.id];

    if (e.shiftKey) {
      const allSelected = targetGroupIds.every((id) => selectedElementIds.includes(id));
      if (allSelected) {
        onSelectElements(selectedElementIds.filter((id) => !targetGroupIds.includes(id)));
      } else {
        onSelectElements(Array.from(new Set([...selectedElementIds, ...targetGroupIds])));
      }
    } else {
      // Direct click selects this element or its group cleanly
      onSelectElements(targetGroupIds);
    }
  };

  // Start Dragging Selected Element(s)
  const handleStartDrag = (e: React.MouseEvent, element: LabelElement) => {
    if (activeTool === 'data-edit') {
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });

    const targetGroupIds = element.groupId
      ? template.elements.filter((el) => el.groupId === element.groupId).map((el) => el.id)
      : [element.id];

    const activeIds = selectedElementIds.includes(element.id)
      ? Array.from(new Set([...selectedElementIds, ...targetGroupIds]))
      : targetGroupIds;

    const initials = template.elements
      .filter((el) => activeIds.includes(el.id) && !el.locked)
      .map((el) => ({ id: el.id, x: el.x, y: el.y }));

    setDragInitialElements(initials);
  };

  // Start Resizing Handle
  const handleStartResize = (e: React.MouseEvent, handle: string, element: LabelElement) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizingElementId(element.id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setResizeInitialState({ x: element.x, y: element.y, w: element.width, h: element.height });
  };

  // Start Rotation
  const handleStartRotate = (e: React.MouseEvent, element: LabelElement) => {
    e.stopPropagation();
    setIsRotating(true);
    setRotatingElementId(element.id);

    const elDom = document.getElementById(`canvas-el-${element.id}`);
    if (elDom) {
      const rect = elDom.getBoundingClientRect();
      setRotateCenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
  };

  // Alignment Helpers from Right Dock
  const handleAlign = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedElementIds.length) return;
    const selected = template.elements.filter(el => selectedElementIds.includes(el.id));
    if (selected.length === 1) {
      // Align to page bounds
      const el = selected[0];
      let updates: Partial<LabelElement> = {};
      if (alignment === 'left') updates.x = 0;
      if (alignment === 'center') updates.x = (template.dimensions.width - el.width) / 2;
      if (alignment === 'right') updates.x = template.dimensions.width - el.width;
      if (alignment === 'top') updates.y = 0;
      if (alignment === 'middle') updates.y = (template.dimensions.height - el.height) / 2;
      if (alignment === 'bottom') updates.y = template.dimensions.height - el.height;
      onUpdateElement(el.id, updates);
    } else {
      // Align relative to each other
      const minX = Math.min(...selected.map(e => e.x));
      const maxX = Math.max(...selected.map(e => e.x + e.width));
      const minY = Math.min(...selected.map(e => e.y));
      const maxY = Math.max(...selected.map(e => e.y + e.height));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const updates = selected.map(el => {
        let u: Partial<LabelElement> = {};
        if (alignment === 'left') u.x = minX;
        if (alignment === 'center') u.x = centerX - el.width / 2;
        if (alignment === 'right') u.x = maxX - el.width;
        if (alignment === 'top') u.y = minY;
        if (alignment === 'middle') u.y = centerY - el.height / 2;
        if (alignment === 'bottom') u.y = maxY - el.height;
        return { id: el.id, updates: u };
      });
      onUpdateMultipleElements(updates);
    }
  };

  const handleCenterPage = (axis: 'h' | 'v' | 'both') => {
    if (!selectedElementIds.length) return;
    const selected = template.elements.filter(el => selectedElementIds.includes(el.id));
    selected.forEach(el => {
      let updates: Partial<LabelElement> = {};
      if (axis === 'h' || axis === 'both') {
        updates.x = Number(((template.dimensions.width - el.width) / 2).toFixed(2));
      }
      if (axis === 'v' || axis === 'both') {
        updates.y = Number(((template.dimensions.height - el.height) / 2).toFixed(2));
      }
      onUpdateElement(el.id, updates);
    });
  };

  const handleDistribute = (axis: 'horizontal' | 'vertical') => {
    const selected = template.elements.filter(el => selectedElementIds.includes(el.id));
    if (selected.length < 3) return;
    if (axis === 'horizontal') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const minX = sorted[0].x;
      const maxX = sorted[sorted.length - 1].x;
      const totalSpan = maxX - minX;
      const step = totalSpan / (sorted.length - 1);
      const updates = sorted.map((el, i) => ({ id: el.id, updates: { x: Number((minX + i * step).toFixed(2)) } }));
      onUpdateMultipleElements(updates);
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const minY = sorted[0].y;
      const maxY = sorted[sorted.length - 1].y;
      const totalSpan = maxY - minY;
      const step = totalSpan / (sorted.length - 1);
      const updates = sorted.map((el, i) => ({ id: el.id, updates: { y: Number((minY + i * step).toFixed(2)) } }));
      onUpdateMultipleElements(updates);
    }
  };

  const handleRotateDock = (deltaDeg: number) => {
    if (!selectedElementIds.length) return;
    const selected = template.elements.filter(el => selectedElementIds.includes(el.id));
    selected.forEach(el => {
      onUpdateElement(el.id, { rotation: ((el.rotation || 0) + deltaDeg) % 360 });
    });
  };

  if (documents && documents.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-[#9fbddb] select-none h-full relative overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-white/50 border border-white/80 rounded-2xl flex items-center justify-center mb-4 shadow-sm backdrop-blur-xs">
            <FileText className="w-8 h-8 text-slate-700" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No document is open</h3>
          <p className="text-xs text-slate-700 mb-6 max-w-sm">
            Create a new BarcodeFlow label template or open an existing file to start designing.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onNewTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Document</span>
            </button>
            {onOpenDocument && (
              <button
                onClick={onOpenDocument}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-emerald-700" />
                <span>Open Document...</span>
              </button>
            )}
          </div>
        </div>
        {/* Bottom Status Bar */}
        <div className="h-5 bg-[#e4ebf5] border-t border-[#cbd5e1] flex items-center justify-between px-2 text-[10.5px] text-slate-600">
          <span>Ready</span>
          <span>BarcodeFlow Enterprise Suite v2.5.0</span>
        </div>
      </div>
    );
  }

  const labelWidthPx = template.dimensions.width * scale;
  const labelHeightPx = template.dimensions.height * scale;

  // Determine label physical shape and corner radius
  const rawShape = (template as any).shape || (template.dimensions as any)?.shape || 'rectangle';
  const labelShape = rawShape === 'rounded' || rawShape === 'round-rectangle' ? 'rounded' : rawShape;
  const rawCornerRadiusMm = (template as any).cornerRadius ?? (template.dimensions as any)?.cornerRadius ?? (labelShape === 'rounded' ? 1.5 : 0);

  let sheetBorderRadius = '0px';
  let innerBorderRadius = '0px';

  if (labelShape === 'circle' || labelShape === 'ellipse' || labelShape === 'oval') {
    sheetBorderRadius = '50%';
    innerBorderRadius = '50%';
  } else if (labelShape === 'rounded') {
    const radiusPx = Math.max(0, rawCornerRadiusMm * scale);
    sheetBorderRadius = `${radiusPx}px`;
    innerBorderRadius = `${Math.max(0, radiusPx - 2)}px`;
  } else {
    // 'rectangle' -> sharp 90-degree square corners
    sheetBorderRadius = '0px';
    innerBorderRadius = '0px';
  }

  // Status Bar Metrics & Unit Scaling
  const unitLabel = viewport.unit === 'inch' ? 'in' : viewport.unit;
  const unitMultiplier = viewport.unit === 'inch' ? 1 / 25.4 : viewport.unit === 'px' ? 96 / 25.4 : 1;
  const unitDecimals = viewport.unit === 'inch' ? 3 : viewport.unit === 'px' ? 0 : 1;
  const formatUnitVal = (valMm: number) => (valMm * unitMultiplier).toFixed(unitDecimals);

  // Selected Object Identification & Bounding Box
  let objectLabel = 'Object: None (Label Page)';
  let coordX = '0.0';
  let coordY = '0.0';
  let angleStr = '0.0°';
  let widthStr = formatUnitVal(template.dimensions.width);
  let heightStr = formatUnitVal(template.dimensions.height);
  let xDimDisplay = '--';

  if (selectedElementIds.length === 1 && selectedElement) {
    objectLabel = `Object: ${selectedElement.name}`;
    coordX = formatUnitVal(selectedElement.x);
    coordY = formatUnitVal(selectedElement.y);
    angleStr = `${(selectedElement.rotation || 0).toFixed(1)}°`;
    widthStr = formatUnitVal(selectedElement.width);
    heightStr = formatUnitVal(selectedElement.height);

    if (selectedElement.type === 'barcode') {
      const rawModuleWidth = (selectedElement as any).moduleWidth || (selectedElement as any).xDimension || (selectedElement.width / 50);
      const xDimMm = typeof rawModuleWidth === 'number' ? rawModuleWidth : parseFloat(rawModuleWidth) || 0.33;
      xDimDisplay = `${(xDimMm * unitMultiplier).toFixed(2)}${unitLabel}`;
    }
  } else if (selectedElementIds.length > 1) {
    const selectedList = template.elements.filter(e => selectedElementIds.includes(e.id));
    if (selectedList.length > 0) {
      const minX = Math.min(...selectedList.map(e => e.x));
      const minY = Math.min(...selectedList.map(e => e.y));
      const maxX = Math.max(...selectedList.map(e => e.x + e.width));
      const maxY = Math.max(...selectedList.map(e => e.y + e.height));
      objectLabel = `Object: ${selectedElementIds.length} Objects Selected`;
      coordX = formatUnitVal(minX);
      coordY = formatUnitVal(minY);
      angleStr = '--';
      widthStr = formatUnitVal(maxX - minX);
      heightStr = formatUnitVal(maxY - minY);
    }
  } else {
    // When no object is selected, show label origin (0.0, 0.0)
    coordX = '0.0';
    coordY = '0.0';
    angleStr = '0.0°';
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#9fbddb] relative overflow-hidden select-none">
      {/* 1. Top Horizontal Ruler */}
      {viewport.showRulers && (
        <div className="flex h-5 bg-[#e4ebf5]">
          <RulerCorner
            unit={viewport.unit}
            onToggleUnit={() => setViewport(v => ({ ...v, unit: v.unit === 'mm' ? 'inch' : 'mm' }))}
          />
          <div className="flex-1 overflow-hidden">
            <HorizontalRuler
              widthMm={template.dimensions.width}
              heightMm={template.dimensions.height}
              zoom={viewport.zoom}
              unit={viewport.unit}
              cursorX={cursorMm.x}
              cursorY={cursorMm.y}
              panX={viewport.panX}
              panY={viewport.panY}
              guides={guides}
              onAddGuide={(type, pos) => setGuides(g => [...g, { id: `g-${Date.now()}`, type, position: pos }])}
            />
          </div>
          {/* Top-right filler for right toolbar width */}
          <div className="w-8 h-5 bg-[#e4ebf5] border-b border-l border-[#cbd5e1] shrink-0" />
        </div>
      )}

      {/* 2. Main Workspace Stage (Canvas + Right Dock) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Vertical Ruler */}
        {viewport.showRulers && (
          <div className="w-5 h-full shrink-0 overflow-hidden bg-[#e4ebf5]">
            <VerticalRuler
              widthMm={template.dimensions.width}
              heightMm={template.dimensions.height}
              zoom={viewport.zoom}
              unit={viewport.unit}
              cursorX={cursorMm.x}
              cursorY={cursorMm.y}
              panX={viewport.panX}
              panY={viewport.panY}
              guides={guides}
              onAddGuide={(type, pos) => setGuides(g => [...g, { id: `g-${Date.now()}`, type, position: pos }])}
            />
          </div>
        )}

        {/* Interactive Infinite Canvas Container (Steel Blue Background) */}
        <div
          ref={containerRef}
          className={`flex-1 h-full bg-[#9fbddb] relative overflow-hidden ${
            isSpacePressed || isPanning
              ? 'cursor-grab active:cursor-grabbing'
              : activeTool === 'data-edit'
              ? 'cursor-cell'
              : 'cursor-default'
          }`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate precise drop coordinate in mm on the label sheet
            const rawX = (mouseX - viewport.panX) / scale;
            const rawY = (mouseY - viewport.panY) / scale;
            const dropX = Math.max(0, snapValue(rawX));
            const dropY = Math.max(0, snapValue(rawY));

            try {
              const rawData = e.dataTransfer.getData('application/json');
              if (!rawData) return;
              const payload = JSON.parse(rawData);

              if (payload.type === 'database-field' && onInsertBoundElementAt) {
                onInsertBoundElementAt(payload, dropX, dropY, payload.suggestedType);
              } else if (payload.type === 'element' && payload.data && onInsertElementAt) {
                onInsertElementAt(payload.data, dropX, dropY);
              } else if (payload.type === 'preset' && payload.presetKey && onInsertPresetAt) {
                onInsertPresetAt(payload.presetKey, dropX, dropY);
              }
            } catch (err) {
              console.error('Error handling canvas drop:', err);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, element: null });
          }}
        >
          {/* Workspace Pan/Zoom Container */}
          <div
            className="absolute transition-transform duration-0 ease-linear origin-top-left"
            style={{
              transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
            }}
          >
            {/* The Die-Cut Label Sheet */}
            <div
              id="label-canvas-page"
              className="relative shadow-xl transition-all duration-75 border border-slate-300"
              style={{
                width: `${labelWidthPx}px`,
                height: `${labelHeightPx}px`,
                borderRadius: sheetBorderRadius,
                backgroundColor:
                  template.background?.showInDesigner && template.background?.useColor && template.background?.color
                    ? template.background.color
                    : '#ffffff',
                backgroundImage:
                  template.background?.showInDesigner && template.background?.useImage && template.background?.imageUrl
                    ? `url('${template.background.imageUrl}')`
                    : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Optional Grid Overlay */}
              {viewport.showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-30 overflow-hidden"
                  style={{
                    borderRadius: sheetBorderRadius,
                    backgroundImage: `
                      linear-gradient(to right, #94a3b8 1px, transparent 1px),
                      linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
                    `,
                    backgroundSize: `${viewport.gridSize * scale}px ${viewport.gridSize * scale}px`,
                  }}
                />
              )}

              {/* Optional Margin & Bleed Guides */}
              {viewport.showMargins && (
                <>
                  {/* Safe Zone Inner Border */}
                  <div
                    className="absolute pointer-events-none border border-dashed border-emerald-400"
                    style={{
                      top: `${template.margins.top * scale}px`,
                      left: `${template.margins.left * scale}px`,
                      right: `${template.margins.right * scale}px`,
                      bottom: `${template.margins.bottom * scale}px`,
                      borderRadius: innerBorderRadius,
                    }}
                  />
                </>
              )}

              {/* Render All Label Elements */}
              {template.elements.map((el) => (
                <CanvasElement
                  key={el.id}
                  element={el}
                  isSelected={selectedElementIds.includes(el.id)}
                  isEditing={editingElementId === el.id}
                  onSelect={handleElementSelect}
                  onDoubleClick={() => {
                    if (el.type === 'text') {
                      handleStartTextEdit(el);
                    } else if (el.type === 'barcode' && onOpenBarcodeProperties) {
                      onOpenBarcodeProperties();
                    } else if (onOpenProperties) {
                      onOpenProperties();
                    }
                  }}
                  onStartEdit={handleStartTextEdit}
                  onCommitEdit={handleCommitInlineText}
                  onCancelEdit={handleCancelInlineText}
                  onDraftResize={handleDraftResize}
                  scale={scale}
                  recordData={recordData}
                  onStartDrag={handleStartDrag}
                  onStartResize={handleStartResize}
                  onStartRotate={handleStartRotate}
                  onContextMenu={(e, element) => {
                    if (!selectedElementIds.includes(element.id)) {
                      onSelectElements([element.id]);
                    }
                    setContextMenu({ x: e.clientX, y: e.clientY, element });
                  }}
                  onBindField={onBindElementToField}
                  labelDimensions={{ width: template.dimensions.width, height: template.dimensions.height }}
                />
              ))}

              {/* Dynamic Interactive Guidelines */}
              {viewport.showGuides &&
                guides.map((g) => {
                  const posPx = g.position * scale;
                  return g.type === 'vertical' ? (
                    <div
                      key={g.id}
                      className="absolute top-0 bottom-0 w-px bg-cyan-500 z-40 pointer-events-none"
                      style={{ left: `${posPx}px` }}
                    />
                  ) : (
                    <div
                      key={g.id}
                      className="absolute left-0 right-0 h-px bg-cyan-500 z-40 pointer-events-none"
                      style={{ top: `${posPx}px` }}
                    />
                  );
                })}
            </div>
          </div>

          {/* Rubberband Selection Box */}
          {isBoxSelecting && selectionBox && (
            <div
              className="fixed bg-green-500/20 border border-green-600 pointer-events-none z-50 rounded-xs"
              style={{
                left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
              }}
            />
          )}
        </div>

        {/* 3. Right Vertical Toolbar (Alignment & Transformation Dock) */}
        <RightVerticalToolbar
          onAlign={handleAlign}
          onDistribute={handleDistribute}
          onRotate={handleRotateDock}
          onCenterPage={handleCenterPage}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
          onLockToggle={onLockToggle}
          hasSelection={selectedElementIds.length > 0}
          isLocked={selectedElement?.locked}
        />
      </div>

      {/* 4. Bottom Document / Form Tabs Bar */}
      {documents && documents.length > 0 && (
        <DocumentTabBar
          documents={documents}
          activeInstanceId={activeInstanceId || null}
          onSelectTab={onSelectTab || (() => {})}
          onCloseTab={onCloseTab || (() => {})}
          onNewTemplate={onNewTemplate || (() => {})}
          onNewForm={onNewForm || (() => {})}
          onSaveDoc={onSaveDoc}
          onSaveAll={onSaveAll}
          onDuplicateDoc={onDuplicateDoc}
          onCloseOthers={onCloseOthers}
          onCloseAll={onCloseAll}
        />
      )}

      {/* 5. Bottom Status Bar (Matching BarTender Status Bar) */}
      <div className="h-5 bg-[#e4ebf5] border-t border-[#cbd5e1] flex items-center justify-between px-2 text-[10.5px] sm:text-[11px] text-slate-700 select-none shrink-0 whitespace-nowrap relative z-50 overflow-visible">
        {/* Left Informational Segments */}
        <div className="flex items-center min-w-0 overflow-hidden">
          {/* Segment 1: Printer */}
          <div className="flex items-center gap-1.5 border-r border-[#cbd5e1] pr-3 shrink-0">
            <Printer className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
              Printer: {activePrinterName || 'Microsoft Print to PDF'}
            </span>
          </div>

          {/* Segment 2: Object identification */}
          <div className="flex items-center gap-1.5 border-r border-[#cbd5e1] pr-3 hidden sm:flex shrink-0">
            <span className="truncate max-w-[160px] md:max-w-[240px]">
              {objectLabel}
            </span>
          </div>

          {/* Segment 3: Coordinates */}
          <div className="flex items-center gap-2 border-r border-[#cbd5e1] pr-3 font-mono text-[10px] sm:text-[10.5px] shrink-0">
            <span>X: {coordX}{unitLabel}</span>
            <span>Y: {coordY}{unitLabel}</span>
            <span>Angle: {angleStr}</span>
          </div>

          {/* Segment 4: Dimensions */}
          <div className="flex items-center gap-2 border-r border-[#cbd5e1] pr-3 font-mono text-[10px] sm:text-[10.5px] hidden lg:flex shrink-0">
            <span>Width: {widthStr}{unitLabel}</span>
            <span>Height: {heightStr}{unitLabel}</span>
            <span>X Dim: {xDimDisplay}</span>
          </div>
        </div>

        {/* Segment 5: BarTender-Style Zoom Menu Control */}
        <div className="relative ml-auto shrink-0 pl-2 overflow-visible" ref={zoomMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomMenuOpen(prev => !prev);
            }}
            className={`px-2 py-0.5 rounded-[2px] flex items-center gap-1.5 font-medium text-[11px] cursor-pointer border transition-colors select-none ${
              isZoomMenuOpen
                ? 'bg-[#ffe8a6] border-[#d2b470] text-slate-900 shadow-inner'
                : 'hover:bg-[#d0deec] border-transparent hover:border-slate-300 text-slate-800'
            }`}
            title="Zoom&#10;Click to set zoom level."
          >
            <ZoomIn className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span className="font-mono text-[11px] font-semibold text-slate-800">
              {Math.round(viewport.zoom * 100)}%
            </span>
            <ChevronDown className="w-3 h-3 text-slate-600 shrink-0 -ml-0.5" />
          </button>

          {/* BarTender Zoom Popup Menu */}
          {isZoomMenuOpen && (
            <div
              className="absolute bottom-full right-0 mb-1 z-[9999] bg-white border border-[#999999] shadow-2xl rounded-[2px] py-1 min-w-[220px] text-slate-800 text-[11.5px] select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  handleZoomIn();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Zoom In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleZoomOut();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Zoom Out</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  zoomToSelection();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <Scan className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Zoom to Rectangle</span>
              </button>

              <div className="border-t border-slate-200 my-1 mx-1" />

              {/* Preset Zoom Levels */}
              {[3200, 1600, 800, 400, 200, 100, 50].map(pct => {
                const isCurrent = Math.round(viewport.zoom * 100) === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      centerInView(pct / 100);
                      setIsZoomMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors ${
                      isCurrent ? 'font-bold' : ''
                    }`}
                  >
                    <span className="w-3.5 h-3.5 mr-2.5 flex items-center justify-center shrink-0">
                      {isCurrent && <Check className="w-3 h-3" />}
                    </span>
                    <span>{pct}%</span>
                  </button>
                );
              })}

              <div className="border-t border-slate-200 my-1 mx-1" />

              <button
                type="button"
                onClick={() => {
                  fitToWindow();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Fit Template in Window</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fitTemplateWidthInWindow();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <MoveHorizontal className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Fit Template Width in Window</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fitAllObjectsInWindow();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1 hover:bg-[#0078d7] hover:text-white text-left cursor-pointer transition-colors"
              >
                <Frame className="w-3.5 h-3.5 mr-2.5 shrink-0" />
                <span>Fit All Objects in Window</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Click Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          element={contextMenu.element}
          onClose={() => setContextMenu(null)}
          onCut={onCut}
          onCopy={onCopy}
          onPaste={onPaste}
          onDuplicate={onDuplicateSelected}
          onDelete={onDeleteSelected}
          onLockToggle={onLockToggle}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onGroup={onGroup}
          onUngroup={onUngroup}
          onEditText={() => {
            if (contextMenu.element && contextMenu.element.type === 'text') {
              handleStartTextEdit(contextMenu.element);
            }
          }}
          onOpenProperties={() => {
            if (contextMenu.element) {
              if (!selectedElementIds.includes(contextMenu.element.id)) {
                onSelectElements([contextMenu.element.id]);
              }
              if (contextMenu.element.type === 'barcode' && onOpenBarcodeProperties) {
                onOpenBarcodeProperties();
                return;
              }
            }
            if (onOpenProperties) {
              onOpenProperties();
            }
          }}
          onConvertToGS1={onOpenBarcodePicker}
          onOpenPageSetup={onOpenPageSetup || onOpenProperties}
        />
      )}
    </div>
  );
};
