"use client";

import { useState } from "react";
import { Check, Pencil, MoreHorizontal } from "lucide-react";
import clsx from "clsx";
import { Menu, MenuItem, MenuDivider } from "@/components/ui/menu";
import { setTaskStatus } from "@/lib/actions/tasks";
import { tagColor } from "@/lib/tag-color";
import type { Task, TaskStatus } from "@/types/database";

const STATUS_OPTIONS: TaskStatus[] = ["Backlog", "Todo", "In Progress", "Waiting", "Done", "Cancelled"];

const PRIORITY_STYLE: Record<Task["priority"], string> = {
  Urgent: "text-red bg-r13",
  High: "text-amber bg-am13",
  Medium: "text-t4 bg-chip",
  Low: "text-t4 bg-chip",
};

function formatDue(date: string | null) {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TaskRow({
  task,
  subtaskProgress,
  minutesLogged,
  completed,
  onToggleComplete,
  onEdit,
  onRequestDelete,
  onStatusChanged,
}: {
  task: Task;
  subtaskProgress?: { completed: number; total: number };
  minutesLogged?: number;
  completed: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onStatusChanged: (status: TaskStatus) => void;
}) {
  const [pending, setPending] = useState(false);
  const isDone = completed || task.status === "Done";
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && task.due_date !== null && task.due_date < today && task.status !== "Cancelled";

  const edgeColor = isOverdue ? "var(--domain-danger)" : isDone ? "var(--green)" : "var(--domain-tasks)";

  async function handleCheckboxClick() {
    if (isDone || pending) return;
    setPending(true);
    onToggleComplete();
    try {
      await setTaskStatus(task.id, "Done");
    } finally {
      setPending(false);
    }
  }

  async function handleStatusPick(status: TaskStatus, close: () => void) {
    close();
    onStatusChanged(status);
    await setTaskStatus(task.id, status);
  }

  return (
    <div
      className="group flex h-14 items-center gap-3 border-b border-line2 pl-[13px] pr-3 transition-colors last:border-b-0 hover:bg-surface2"
      style={{ borderLeft: `3px solid ${edgeColor}` }}
    >
      <button
        type="button"
        onClick={handleCheckboxClick}
        disabled={isDone || pending}
        aria-label={isDone ? "Task done" : "Mark task done"}
        className={clsx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] border transition-colors disabled:cursor-default",
          isDone ? "border-transparent bg-green" : "border-line4 hover:border-[var(--domain-tasks)]"
        )}
      >
        {isDone && <Check size={13} strokeWidth={3} className="text-on-accent" />}
      </button>

      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 flex-col items-start justify-center text-left">
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className={clsx("truncate text-[13.5px] font-medium", isDone && "text-t6 line-through")}>{task.title}</span>
          {subtaskProgress && subtaskProgress.total > 0 && (
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="h-1 w-[34px] overflow-hidden rounded-full bg-track">
                <span
                  className="block h-full rounded-full bg-[var(--domain-tasks)]"
                  style={{ width: `${Math.round((subtaskProgress.completed / subtaskProgress.total) * 100)}%` }}
                />
              </span>
              <span className="font-mono text-[10px] text-t6">
                {subtaskProgress.completed}/{subtaskProgress.total}
              </span>
            </span>
          )}
        </span>
        <span className="mt-0.5 flex w-full min-w-0 items-center gap-2 text-[10.5px]">
          {task.category && (
            <span
              className="shrink-0 rounded-full px-[7px] py-[1px] font-medium"
              style={{ backgroundColor: `color-mix(in srgb, ${tagColor(task.category)} 16%, transparent)`, color: tagColor(task.category) }}
            >
              {task.category}
            </span>
          )}
          {minutesLogged !== undefined && minutesLogged > 0 && (
            <span className="shrink-0 font-mono text-t6">◷ {durationLabel(minutesLogged)}</span>
          )}
          {task.notes && <span className="truncate text-t7">{task.notes}</span>}
        </span>
      </button>

      <div className="hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit task"
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-t6 hover:bg-surface3 hover:text-foreground"
        >
          <Pencil size={13} />
        </button>
        <Menu
          align="right"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label="More actions"
              className="flex h-7 w-7 items-center justify-center rounded-[8px] text-t6 hover:bg-surface3 hover:text-foreground"
            >
              <MoreHorizontal size={14} />
            </button>
          )}
        >
          {(close) => (
            <>
              {STATUS_OPTIONS.filter((s) => s !== task.status).map((s) => (
                <MenuItem key={s} onClick={() => handleStatusPick(s, close)}>
                  Mark as {s}
                </MenuItem>
              ))}
              <MenuDivider />
              <MenuItem
                danger
                onClick={() => {
                  close();
                  onRequestDelete();
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      <span className={clsx("hidden shrink-0 rounded-full px-2 py-[2px] text-[10.5px] font-bold sm:inline-block", PRIORITY_STYLE[task.priority])}>
        {task.priority}
      </span>

      <span
        className={clsx(
          "hidden w-[52px] shrink-0 text-right font-mono text-[11.5px] md:inline-block",
          isDone ? "text-t7" : isOverdue ? "text-red" : "text-t6"
        )}
      >
        {formatDue(task.due_date)}
      </span>
    </div>
  );
}
