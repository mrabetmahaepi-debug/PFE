import { useEffect } from 'react';
import '../styles/cursor-click-effect.css';

const RIPPLE_DURATION_MS = 200;

const CLICKABLE_SELECTOR =
  'a, button, [role="button"], [role="link"], [role="menuitem"], [role="tab"], label[for], input[type="button"], input[type="submit"], input[type="reset"], select, summary, .cu-pressable, .cu-spaces-tree-main, .cu-nav-item, .cu-kanban-card-click, .ms-recent-row, .mtd-subtasks-item-btn, .mtd-subtasks-item-row, .project-card, .task-row-item, .task-card, [onclick]';

function isClickableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  let node: Element | null = target;
  while (node && node !== document.documentElement) {
    if (node.matches(CLICKABLE_SELECTOR)) {
      if (node instanceof HTMLButtonElement && node.disabled) return false;
      if (node instanceof HTMLInputElement && node.disabled) return false;
      if (node.getAttribute('aria-disabled') === 'true') return false;
      return true;
    }
    if (node instanceof HTMLElement) {
      const cursor = window.getComputedStyle(node).cursor;
      if (cursor === 'pointer') return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Global cursor press ring — animates at pointer position only (no element flash).
 */
export default function CursorClickEffect() {
  useEffect(() => {
    let ripple: HTMLDivElement | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (fadeTimer) {
        clearTimeout(fadeTimer);
        fadeTimer = null;
      }
      if (removeTimer) {
        clearTimeout(removeTimer);
        removeTimer = null;
      }
    };

    const removeRipple = () => {
      if (!ripple) return;
      const node = ripple;
      ripple = null;
      node.classList.remove('is-visible');
      node.classList.add('is-fading');
      removeTimer = setTimeout(() => {
        node.remove();
      }, RIPPLE_DURATION_MS + 40);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!isClickableTarget(e.target)) return;

      clearTimers();
      if (ripple) {
        ripple.remove();
        ripple = null;
      }

      const node = document.createElement('div');
      node.className = 'cu-cursor-ripple';
      node.style.left = `${e.clientX}px`;
      node.style.top = `${e.clientY}px`;
      node.setAttribute('aria-hidden', 'true');
      document.body.appendChild(node);
      ripple = node;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => node.classList.add('is-visible'));
      });
    };

    const onMouseUp = () => {
      if (!ripple) return;
      removeRipple();
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('blur', onMouseUp);

    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      window.removeEventListener('blur', onMouseUp);
      clearTimers();
      ripple?.remove();
    };
  }, []);

  return null;
}
