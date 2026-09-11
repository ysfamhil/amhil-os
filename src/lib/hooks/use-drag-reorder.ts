"use client";

import { useState } from "react";

/**
 * Local-first drag-to-reorder over a server-provided list. While the id set
 * is unchanged (a pure reorder, or the same rows with updated fields) the
 * locally-committed sequence wins over whatever order the server just sent;
 * once the id set actually changes (an item added, removed, or filtered
 * out — e.g. completed) we fall back to the server's order, which already
 * reflects the persisted position for anything still there.
 *
 * Reconciliation happens during render (React's documented pattern for
 * "adjusting state when a prop changes") rather than in a `useEffect`, so
 * there's no extra commit-then-effect-then-recommit cascade.
 */
export function useDragReorder<T extends { id: string }>(items: T[], onCommit: (orderedIds: string[]) => void) {
  const itemsKey = items.map((i) => i.id).join(",");
  const [reconciledKey, setReconciledKey] = useState(itemsKey);
  const [order, setOrder] = useState<T[]>(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  if (itemsKey !== reconciledKey) {
    const prevIds = new Set(order.map((p) => p.id));
    const nextIds = new Set(items.map((i) => i.id));
    const sameSet = prevIds.size === nextIds.size && [...prevIds].every((id) => nextIds.has(id));
    setOrder(sameSet ? order.map((p) => items.find((i) => i.id === p.id) ?? p) : items);
    setReconciledKey(itemsKey);
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(overId: string, e: React.DragEvent) {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setOrder((current) => {
      const fromIndex = current.findIndex((i) => i.id === draggingId);
      const toIndex = current.findIndex((i) => i.id === overId);
      if (fromIndex === -1 || toIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleDragEnd() {
    if (draggingId) {
      onCommit(order.map((i) => i.id));
    }
    setDraggingId(null);
  }

  return { list: order, draggingId, handleDragStart, handleDragOver, handleDragEnd };
}
