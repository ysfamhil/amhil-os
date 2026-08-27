"use client";

import { useState } from "react";
import { Check, Flame, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HabitWithStats } from "@/lib/queries/habits";

export function HabitRow({
  habit,
  onToggle,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  habit: HabitWithStats;
  onToggle: (completed: boolean) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    try {
      await onToggle(!habit.completedToday);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className={clsx("flex items-center gap-4", !habit.is_active && "opacity-60")}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-label={habit.completedToday ? "Mark not done" : "Mark done"}
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          habit.completedToday
            ? "border-success bg-success/15 text-success"
            : "border-border text-muted hover:border-accent hover:text-accent"
        )}
      >
        <Check size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{habit.name}</span>
          <Badge tone="neutral">{habit.frequency === "daily" ? "Daily" : "Weekly"}</Badge>
          {!habit.is_active && <Badge tone="neutral">Archived</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Flame size={12} className={habit.currentStreak > 0 ? "text-warning" : ""} />
            {habit.currentStreak} day streak
          </span>
          <span>Best {habit.bestStreak}</span>
          <span>Week {habit.weeklyConsistency}%</span>
          <span>Month {habit.monthlyConsistency}%</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onEdit} aria-label="Edit habit" className="rounded-lg p-2 text-muted hover:bg-border/40 hover:text-foreground">
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          aria-label={habit.is_active ? "Archive habit" : "Reactivate habit"}
          className="rounded-lg p-2 text-muted hover:bg-border/40 hover:text-foreground"
        >
          {habit.is_active ? <Archive size={14} /> : <ArchiveRestore size={14} />}
        </button>
        <button type="button" onClick={onDelete} aria-label="Delete habit" className="rounded-lg p-2 text-muted hover:text-danger">
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}
