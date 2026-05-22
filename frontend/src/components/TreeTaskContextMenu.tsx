import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutGrid,
  List,
  Columns3,
  Trash2,
} from 'lucide-react';
import './TreeTaskContextMenu.css';

export type TreeTaskMenuAction = 'overview' | 'list' | 'board' | 'delete';

export interface TreeTaskContextMenuProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onAction: (action: TreeTaskMenuAction) => void;
  canDelete?: boolean;
}

const MENU_WIDTH = 176;

const TreeTaskContextMenu: React.FC<TreeTaskContextMenuProps> = ({
  open,
  anchorRef,
  onClose,
  onAction,
  canDelete = true,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const gap = 6;
    let left = anchor.right + gap;
    let top = anchor.top;
    if (left + MENU_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, anchor.left - MENU_WIDTH - gap);
    }
    const estimatedHeight = canDelete ? 220 : 180;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - estimatedHeight - 8);
    }
    setPosition({ top, left });
  }, [open, anchorRef, canDelete]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="tree-task-context-menu"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 10000,
      }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className="tree-task-context-menu-item"
        onClick={() => onAction('overview')}
      >
        <LayoutGrid size={15} strokeWidth={2} />
        Overview
      </button>
      <button
        type="button"
        role="menuitem"
        className="tree-task-context-menu-item"
        onClick={() => onAction('list')}
      >
        <List size={15} strokeWidth={2} />
        List View
      </button>
      <button
        type="button"
        role="menuitem"
        className="tree-task-context-menu-item"
        onClick={() => onAction('board')}
      >
        <Columns3 size={15} strokeWidth={2} />
        Board View
      </button>
      {canDelete && (
        <>
          <div className="tree-task-context-menu-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="tree-task-context-menu-item tree-task-context-menu-item--danger"
            onClick={() => onAction('delete')}
          >
            <Trash2 size={15} strokeWidth={2} />
            Delete
          </button>
        </>
      )}
    </div>,
    document.body
  );
};

export default TreeTaskContextMenu;
