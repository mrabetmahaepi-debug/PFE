import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

export type ClickUpMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  separatorBefore?: boolean;
  onClick: () => void;
};

type ClickUpContextMenuProps = {
  open: boolean;
  anchorRect: DOMRect | null;
  items: ClickUpMenuItem[];
  onClose: () => void;
};

const ClickUpContextMenu: React.FC<ClickUpContextMenuProps> = ({
  open,
  anchorRect,
  items,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

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

  const menuWidth = 220;
  let top = anchorRect.bottom + 4;
  let left = anchorRect.right - menuWidth;
  if (left < 8) left = 8;
  if (top + items.length * 40 > window.innerHeight) {
    top = Math.max(8, anchorRect.top - items.length * 40 - 4);
  }

  return createPortal(
    <div
      ref={ref}
      className="cu-clickup-menu"
      style={{ position: 'fixed', top, left, width: menuWidth, zIndex: 12002 }}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <React.Fragment key={item.id}>
            {item.separatorBefore && <div className="cu-clickup-menu-sep" />}
            <button
              type="button"
              role="menuitem"
              className={`cu-clickup-menu-item${item.danger ? ' is-danger' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                item.onClick();
              }}
            >
              {Icon && <Icon size={16} className="cu-clickup-menu-icon" />}
              <span>{item.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>,
    document.body
  );
};

export default ClickUpContextMenu;
