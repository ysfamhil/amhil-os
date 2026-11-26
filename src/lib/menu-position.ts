/**
 * Where a floating dropdown goes, in window coordinates: below its button, above it when there is no
 * room below, and always kept inside the window.
 */
export function placeMenu(
  anchor: { top: number; bottom: number; left: number; right: number },
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
  align: "left" | "right",
  gap = 6,
  margin = 8,
): { top: number; left: number } {
  let top = anchor.bottom + gap;
  if (top + menu.height > viewport.height - margin) {
    const above = anchor.top - gap - menu.height;
    top = above >= margin ? above : Math.max(margin, viewport.height - margin - menu.height);
  }
  const preferred = align === "right" ? anchor.right - menu.width : anchor.left;
  return { top, left: Math.max(margin, Math.min(preferred, viewport.width - margin - menu.width)) };
}
