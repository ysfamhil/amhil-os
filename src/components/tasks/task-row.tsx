"use client";

import { Calendar, ListChecks, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Badge, priorityTone } from "@/components/ui/badge";
import type { TaskWithProject } from "@/lib/queries/tasks";
import type { TaskStatus } from "@/types/database";

const STATUSES: TaskStatus[] = ["Backlog", "Todo", "In Progress", "Waiting", "Done", "Cancelled"];

function formatDueDate(date: string | null) {
  if (!date) return null;
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskRow({
  task,
  subtaskProgress,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: TaskWithProject;
  subtaskProgress?: { completed: number; total: number };
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const dueLabel = formatDueDate(task.due_date);
  const isOverdue =
    task.due_date !== null &&
    task.due_date < new Date().toISOString().slice(0, 10) &&
    task.status !== "Done" &&
    task.status !== "Cancelled";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:border-accent/50">
      <select
        value={task.status}
        onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
        onClick={(e) => e.stopPropagation()}
        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-accent"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span
          className={clsx("truncate text-sm font-medium", task.status === "Done" && "text-muted line-through")}
        >
          {task.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          {task.projects && <span>{task.projects.name}</span>}
          {dueLabel && (
            <span className={clsx("flex items-center gap-1", isOverdue && "text-danger")}>
              <Calendar size={11} />
              {dueLabel}
            </span>
          )}
          {subtaskProgress && subtaskProgress.total > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks size={11} />
              {subtaskProgress.completed}/{subtaskProgress.total}
            </span>
          )}
        </span>
      </button>

      <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete task"
        className="text-muted hover:text-danger"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
