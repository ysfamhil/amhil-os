"use client";

import { Calendar, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Badge, priorityTone } from "@/components/ui/badge";
import type { Task, TaskStatus } from "@/types/database";

const COLUMNS: TaskStatus[] = ["Backlog", "Todo", "In Progress", "Waiting", "Done", "Cancelled"];

export function TaskKanban({
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column);
        return (
          <div key={column} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{column}</h3>
              <span className="text-xs text-muted">{columnTasks.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-border bg-surface p-3 hover:border-accent/50"
                >
                  <button type="button" onClick={() => onEdit(task)} className="block w-full text-left">
                    <p
                      className={clsx(
                        "text-sm font-medium",
                        task.status === "Done" && "text-muted line-through"
                      )}
                    >
                      {task.title}
                    </p>
                    {task.category && <p className="mt-1 text-xs text-muted">{task.category}</p>}
                    {task.due_date && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Calendar size={11} />
                        {new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                    <div className="flex items-center gap-2">
                      <select
                        value={task.status}
                        onChange={(e) => onStatusChange(task, e.target.value as TaskStatus)}
                        className="rounded-md border border-border bg-background px-1 py-0.5 text-xs outline-none focus:border-accent"
                      >
                        {COLUMNS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onDelete(task)}
                        aria-label="Delete task"
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {columnTasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted">
                  No tasks
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
