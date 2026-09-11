import { GripVertical } from "lucide-react";

/**
 * The handle itself is the only `draggable` element in a reorderable row —
 * not the row as a whole — so a click that starts on the checkbox, title,
 * or anything else in the row can never be misread as a drag gesture.
 */
export function DragHandle({ onDragStart, onDragEnd }: { onDragStart: () => void; onDragEnd: () => void }) {
  return (
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label="Drag to reorder"
      className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-t8 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
    >
      <GripVertical size={13} />
    </span>
  );
}
