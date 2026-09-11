"use client";

import { useCallback, useState } from "react";

/**
 * Server actions that touch tasks call `revalidatePath` on the current
 * route, which makes Next.js refresh server data automatically — even
 * without an explicit `router.refresh()` call. Once that refresh lands, a
 * completed task no longer matches an "open tasks" query and disappears
 * from the incoming server list. To keep it visible (struck through, not
 * gone) we snapshot it locally the moment it's checked and merge that
 * snapshot back into whatever the server sends next.
 */
export function useCompletedTasks<T extends { id: string }>() {
  const [doneMap, setDoneMap] = useState<Map<string, T>>(new Map());

  const markDone = useCallback((task: T) => {
    setDoneMap((prev) => new Map(prev).set(task.id, task));
  }, []);

  const clearDone = useCallback((id: string) => {
    setDoneMap((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const merge = useCallback(
    (serverList: T[]): T[] => {
      if (doneMap.size === 0) return serverList;
      const serverIds = new Set(serverList.map((t) => t.id));
      const extras = [...doneMap.values()].filter((t) => !serverIds.has(t.id));
      return extras.length === 0 ? serverList : [...serverList, ...extras];
    },
    [doneMap]
  );

  const isDone = useCallback((id: string) => doneMap.has(id), [doneMap]);

  return { merge, markDone, clearDone, isDone };
}
