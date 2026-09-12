import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TextElement } from '../../types';
import { measureTextObject } from '../../services/textMeasurementEngine';

interface InlineTextEditorProps {
  element: TextElement;
  scale: number; // px per mm
  onCommit: (id: string, newText: string) => void;
  onCancel: () => void;
  onDraftDimensionsChange?: (id: string, widthMm: number, heightMm: number) => void;
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  element,
  scale,
  onCommit,
  onCancel,
  onDraftDimensionsChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draftText, setDraftText] = useState<string>(element.text || '');
  const initialTextRef = useRef<string>(element.text || '');
  const isCommittedRef = useRef<boolean>(false);

  const isSingleLine =
    element.textType === 'single-line' ||
    !element.textType ||
    element.textFormatType === 'single-line' ||
    (!element.multiline && element.textFormatType !== 'paragraph' && element.textType !== 'paragraph');

  const isTextAutoSize =
    element.autoSize !== false &&
    (element.autoSize === true ||
      element.autoSizeConfig?.enabled === true ||
      isSingleLine);

  // Border & padding configuration in screen pixels
  const border = element.borderConfig;
  const mTop = (border?.marginTop || 0) * scale;
  const mLeft = (border?.marginLeft || 0) * scale;
  const mBottom = (border?.marginBottom || 0) * scale;
  const mRight = (border?.marginRight || 0) * scale;

  // Exact typographic font properties
  const baseFontSizePx = (element.fontSize || 10) * (25.4 / 72) * scale;
  const isUnderline = element.underline || element.textDecoration === 'underline';
  const isStrikeout = element.strikeout || element.textDecoration === 'line-through';
  const textDecor = isUnderline && isStrikeout ? 'underline line-through' : isUnderline ? 'underline' : isStrikeout ? 'line-through' : 'none';
  const fontScale = (element.fontWidthScale || 100) / 100;

  // Auto-focus and select placeholder / position caret
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      if (initialTextRef.current === 'Sample Text' || initialTextRef.current === 'Text') {
        textareaRef.current.select();
      } else {
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }
  }, []);

  // Real-time dynamic auto-size measurement during live typing
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setDraftText(newText);

    if (isTextAutoSize && onDraftDimensionsChange) {
      const isParagraph = element.textFormatType === 'paragraph' || element.textType === 'paragraph';
      const measured = measureTextObject({
        text: newText,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle,
        letterSpacing: element.letterSpacing,
        lineHeight: element.lineHeight,
        fontWidthScale: element.fontWidthScale,
        textType: element.textType,
        textFormatType: element.textFormatType,
        multiline: element.multiline,
        wrap: element.wrap || element.wordWrap,
        containerWidthMm: isParagraph && element.width > 0 ? element.width : undefined,
        borderConfig: element.borderConfig,
      });

      const nextWidth = isParagraph && element.width > 0 ? element.width : measured.width;
      const nextHeight = measured.height;
      onDraftDimensionsChange(element.id, nextWidth, nextHeight);
    }
  };

  const handleCommit = useCallback(() => {
    if (isCommittedRef.current) return;
    isCommittedRef.current = true;
    onCommit(element.id, draftText);
  }, [draftText, element.id, onCommit]);

  const handleCancel = useCallback(() => {
    if (isCommittedRef.current) return;
    isCommittedRef.current = true;
    onCancel();
  }, [onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation(); // Stop propagation to canvas / global hotkeys

    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
      return;
    }

    if (e.key === 'Enter') {
      if (isSingleLine) {
        e.preventDefault();
        handleCommit();
        return;
      }
      // For multi-line / paragraph text: Ctrl+Enter or Cmd+Enter commits
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleCommit();
        return;
      }
      // Regular Enter inserts newline in multi-line text
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit();
      return;
    }

    // Ctrl+A inside textarea
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      e.stopPropagation();
      // Browser default selects all text inside textarea
    }
  };

  return (
    <div
      className="w-full h-full relative"
      style={{
        paddingTop: `${mTop}px`,
        paddingLeft: `${mLeft}px`,
        paddingBottom: `${mBottom}px`,
        paddingRight: `${mRight}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={draftText}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onBlur={handleCommit}
        spellCheck={false}
        rows={isSingleLine ? 1 : undefined}
        className="w-full h-full bg-transparent resize-none border-none outline-none overflow-hidden m-0 p-0 select-text"
        style={{
          fontFamily: element.fontFamily || 'Arial, sans-serif',
          fontSize: `${baseFontSizePx}px`,
          fontWeight: element.fontWeight || 'normal',
          fontStyle: element.fontStyle || 'normal',
          textDecoration: textDecor,
          color: element.whiteOnBlack ? '#ffffff' : element.color || '#000000',
          letterSpacing: `${element.letterSpacing || 0}px`,
          lineHeight: element.lineHeight || 1.15,
          textAlign: element.textAlign || 'left',
          transform: fontScale !== 1 ? `scaleX(${fontScale})` : undefined,
          transformOrigin: element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'right' : 'left',
          whiteSpace: isSingleLine ? 'nowrap' : 'pre-wrap',
          cursor: 'text',
          caretColor: element.whiteOnBlack ? '#ffffff' : '#000000',
        }}
      />
    </div>
  );
};
