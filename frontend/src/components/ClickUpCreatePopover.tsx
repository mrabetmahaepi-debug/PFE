import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Folder, AlignJustify, Circle } from 'lucide-react';
import './ClickUpCreatePopover.css';

export type ClickUpCreateVariant = 'space' | 'project' | 'list';

export type ClickUpCreateAction = 'folder' | 'list' | 'task';

type ClickUpCreatePopoverProps = {
  open: boolean;
  variant: ClickUpCreateVariant;
  anchorRect: DOMRect | null;
  showFolder?: boolean;
  onSelect: (action: ClickUpCreateAction) => void;
  onClose: () => void;
};

const POPOVER_WIDTH = 260;

const ClickUpCreatePopover: React.FC<ClickUpCreatePopoverProps> = ({
  open,
  variant,
  anchorRect,
  showFolder,
  onSelect,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const showFolderOption = showFolder ?? variant === 'space';
  const isListVariant = variant === 'list';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  let top = anchorRect.top;
  let left = anchorRect.right + 6;
  const estimatedHeight = isListVariant ? 100 : showFolderOption ? 200 : 120;

  if (left + POPOVER_WIDTH > window.innerWidth - 8) {
    left = Math.max(8, anchorRect.left - POPOVER_WIDTH - 6);
  }
  if (top + estimatedHeight > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - estimatedHeight - 8);
  }

  return createPortal(
    <div
      ref={ref}
      className="cu-create-popover"
      style={{ position: 'fixed', top, left, width: POPOVER_WIDTH, zIndex: 12001 }}
      role="dialog"
      aria-label="Créer"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="cu-create-popover-title">Créer</p>
      <div className="cu-create-popover-items">
        {isListVariant && (
          <button
            type="button"
            className="cu-create-popover-item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect('task');
            }}
          >
            <span className="cu-create-popover-icon cu-create-popover-icon--task" aria-hidden>
              <Circle size={18} strokeWidth={1.75} />
            </span>
            <span className="cu-create-popover-text">
              <span className="cu-create-popover-label">Tâche</span>
              <span className="cu-create-popover-desc">
                Créez des tâches individuelles pour gérer votre travail
              </span>
            </span>
          </button>
        )}
        {!isListVariant && showFolderOption && (
          <button
            type="button"
            className="cu-create-popover-item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect('folder');
            }}
          >
            <span className="cu-create-popover-icon" aria-hidden>
              <Folder size={18} strokeWidth={1.75} />
            </span>
            <span className="cu-create-popover-text">
              <span className="cu-create-popover-label">Créer dossier</span>
              <span className="cu-create-popover-desc">
                Regroupez les listes, les documents et bien plus.
              </span>
            </span>
          </button>
        )}
        {!isListVariant && (
          <button
            type="button"
            className="cu-create-popover-item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect('list');
            }}
          >
            <span className="cu-create-popover-icon" aria-hidden>
              <AlignJustify size={18} strokeWidth={1.75} />
            </span>
            <span className="cu-create-popover-text">
              <span className="cu-create-popover-label">Créer liste</span>
              <span className="cu-create-popover-desc">
                Suivez les tâches, les projets, les personnes et bien plus.
              </span>
            </span>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ClickUpCreatePopover;
