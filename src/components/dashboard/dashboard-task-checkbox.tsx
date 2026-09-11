"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { setTaskStatus } from "@/lib/actions/tasks";

export function DashboardTaskCheckbox({
  taskId,
  completed,
  onToggle,
}: {
  taskId: string;
  completed: boolean;
  onToggle: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function markDone() {
    if (completed || pending) return;
    onToggle();
    setPending(true);
    try {
      await setTaskStatus(taskId, "Done");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={markDone}
      disabled={pending || completed}
      aria-label={completed ? "Task done" : "Mark task done"}
      className={clsx(
        "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors disabled:opacity-100",
        completed ? "border-accent bg-accent" : "border-line4 hover:border-accent"
      )}
    >
      {completed && <Check size={11} strokeWidth={3} className="text-on-accent" />}
    </button>
  );
}
