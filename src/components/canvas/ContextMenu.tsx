import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  Lock,
  Unlock,
  Layers,
  ArrowUp,
  ArrowDown,
  Sliders,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import { LabelElement } from '../../types';

interface ContextMenuProps {
  x: number;
  y: number;
  element: LabelElement | null;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLockToggle: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onOpenProperties: () => void;
  onEditText?: () => void;
  onConvertToGS1?: () => void;
  onOpenPageSetup?: () => void;
}

const MENU_WIDTH = 224;
const ESTIMATED_HEIGHT = 440;

const getSafeInitialPosition = (rawX: number, rawY: number) => {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = rawX;
  let top = rawY;

  // Prevent right edge overflow
  if (rawX + MENU_WIDTH > winW - 12) {
    left = Math.max(12, winW - MENU_WIDTH - 12);
  }

  // Prevent bottom edge overflow - flip up if needed
  if (rawY + ESTIMATED_HEIGHT > winH - 16) {
    if (rawY - ESTIMATED_HEIGHT >= 16) {
      top = rawY - ESTIMATED_HEIGHT;
    } else {
      top = Math.max(16, winH - ESTIMATED_HEIGHT - 16);
    }
  }

  return { left, top };
};

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  element,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onLockToggle,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onGroup,
  onUngroup,
  onOpenProperties,
  onEditText,
  onConvertToGS1,
  onOpenPageSetup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number }>(() =>
    getSafeInitialPosition(x, y)
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const actualW = rect.width || MENU_WIDTH;
      const actualH = rect.height || ESTIMATED_HEIGHT;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      let left = x;
      let top = y;

      // Prevent horizontal overflow
      if (x + actualW > winW - 12) {
        left = Math.max(12, winW - actualW - 12);
      }

      // Prevent vertical overflow
      if (y + actualH > winH - 16) {
        if (y - actualH >= 16) {
          top = y - actualH;
        } else {
          top = Math.max(16, winH - actualH - 16);
        }
      }

      setMenuPosition({ left, top });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100 overflow-y-auto"
      style={{
        left: `${menuPosition.left}px`,
        top: `${menuPosition.top}px`,
        maxHeight: `calc(100vh - ${menuPosition.top + 20}px)`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {element ? (
        <>
          <div className="px-3 py-1.5 font-semibold text-[11px] text-slate-300 border-b border-slate-800 flex items-center justify-between bg-slate-800/60">
            <span className="truncate max-w-[130px]">{element.name}</span>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
              {element.type}
            </span>
          </div>

          {element.type === 'text' && onEditText && (
            <>
              <ContextItem
                icon={<Edit3 className="w-3.5 h-3.5 text-emerald-400" />}
                label="Edit Text"
                shortcut="F2"
                onClick={() => {
                  onEditText();
                  onClose();
                }}
              />
              <div className="h-px bg-slate-800 my-1" />
            </>
          )}

          <ContextItem icon={<Scissors className="w-3.5 h-3.5 text-slate-300" />} label="Cut" shortcut="Ctrl+X" onClick={() => { onCut(); onClose(); }} />
          <ContextItem icon={<Copy className="w-3.5 h-3.5 text-slate-300" />} label="Copy" shortcut="Ctrl+C" onClick={() => { onCopy(); onClose(); }} />
          <ContextItem icon={<Copy className="w-3.5 h-3.5 text-indigo-400" />} label="Duplicate" shortcut="Ctrl+D" onClick={() => { onDuplicate(); onClose(); }} />
          <ContextItem icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />} label="Delete" shortcut="Del" onClick={() => { onDelete(); onClose(); }} />

          <div className="h-px bg-slate-800 my-1" />

          <ContextItem
            icon={element.locked ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
            label={element.locked ? 'Unlock Element' : 'Lock Element'}
            shortcut="Ctrl+L"
            onClick={() => { onLockToggle(); onClose(); }}
          />
          <ContextItem icon={<ArrowUp className="w-3.5 h-3.5 text-slate-300" />} label="Bring to Front" shortcut="Ctrl+Shift+]" onClick={() => { onBringToFront(); onClose(); }} />
          <ContextItem icon={<ArrowDown className="w-3.5 h-3.5 text-slate-300" />} label="Send to Back" shortcut="Ctrl+Shift+[" onClick={() => { onSendToBack(); onClose(); }} />
          {onBringForward && <ContextItem icon={<ArrowUp className="w-3.5 h-3.5 text-slate-400" />} label="Bring Forward" shortcut="Ctrl+]" onClick={() => { onBringForward(); onClose(); }} />}
          {onSendBackward && <ContextItem icon={<ArrowDown className="w-3.5 h-3.5 text-slate-400" />} label="Send Backward" shortcut="Ctrl+[" onClick={() => { onSendBackward(); onClose(); }} />}

          {(onGroup || onUngroup) && (
            <>
              <div className="h-px bg-slate-800 my-1" />
              {onGroup && <ContextItem icon={<Layers className="w-3.5 h-3.5 text-amber-400" />} label="Group Objects" shortcut="Ctrl+G" onClick={() => { onGroup(); onClose(); }} />}
              {onUngroup && <ContextItem icon={<Layers className="w-3.5 h-3.5 text-slate-400" />} label="Ungroup Objects" shortcut="Ctrl+U" onClick={() => { onUngroup(); onClose(); }} />}
            </>
          )}

          {element.type === 'barcode' && onConvertToGS1 && (
            <>
              <div className="h-px bg-slate-800 my-1" />
              <ContextItem
                icon={<ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                label="Configure GS1 Identifiers..."
                onClick={() => { onConvertToGS1(); onClose(); }}
              />
            </>
          )}

          <div className="h-px bg-slate-700/80 my-1" />

          {/* Prominent Properties Option */}
          <ContextItem
            icon={<Sliders className="w-3.5 h-3.5 text-cyan-400" />}
            label="Properties..."
            shortcut="F8"
            highlight
            onClick={() => {
              onOpenProperties();
              onClose();
            }}
          />
        </>
      ) : (
        <>
          <ContextItem icon={<Clipboard className="w-3.5 h-3.5 text-slate-300" />} label="Paste" shortcut="Ctrl+V" onClick={() => { onPaste(); onClose(); }} />
          {onOpenPageSetup && (
            <>
              <div className="h-px bg-slate-800 my-1" />
              <ContextItem
                icon={<Sliders className="w-3.5 h-3.5 text-cyan-400" />}
                label="Page Setup / Properties..."
                shortcut="Ctrl+D"
                highlight
                onClick={() => {
                  onOpenPageSetup();
                  onClose();
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

const ContextItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  highlight?: boolean;
  onClick: () => void;
}> = ({ icon, label, shortcut, highlight, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
        highlight
          ? 'bg-slate-800/80 hover:bg-blue-600 hover:text-white text-cyan-200 font-semibold'
          : 'hover:bg-blue-600 hover:text-white text-slate-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">{shortcut}</span>}
    </button>
  );
};

