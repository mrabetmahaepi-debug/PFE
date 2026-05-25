export type FloatingAlignX = 'start' | 'end';

export type FloatingPlacement = {
  top: number;
  left: number;
  width: number;
};

type AnchorRect = Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom'>;

export function placeFloatingPanel(options: {
  anchorRect: AnchorRect;
  panel: HTMLElement | null;
  estimatedWidth: number;
  estimatedHeight: number;
  margin?: number;
  gap?: number;
  alignX?: FloatingAlignX;
}): FloatingPlacement {
  const margin = options.margin ?? 8;
  const gap = options.gap ?? 6;
  const alignX = options.alignX ?? 'start';
  const rect = options.anchorRect;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const maxWidth = viewportW - margin * 2;

  const width = Math.min(
    Math.max(options.panel?.offsetWidth || options.estimatedWidth, options.estimatedWidth),
    maxWidth,
  );
  const height = options.panel?.offsetHeight || options.estimatedHeight;

  const spaceBelow = viewportH - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const openBelow = spaceBelow >= height || spaceBelow >= spaceAbove;

  let top = openBelow ? rect.bottom + gap : rect.top - gap - height;
  top = Math.max(margin, Math.min(top, viewportH - height - margin));

  let left = alignX === 'end' ? rect.right - width : rect.left;
  if (left + width > viewportW - margin) {
    left = viewportW - margin - width;
  }
  if (left < margin) {
    left = margin;
  }
  left = Math.max(margin, Math.min(left, viewportW - width - margin));

  return { top, left, width };
}
