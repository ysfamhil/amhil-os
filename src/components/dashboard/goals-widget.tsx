"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DragHandle } from "./drag-handle";
import { WidgetShell, WidgetAddButton } from "./widget-shell";
import { useDragReorder } from "@/lib/hooks/use-drag-reorder";
import { reorderGoals } from "@/lib/actions/goals";
import type { DashboardData } from "@/lib/dashboard";
import type { GoalStatus } from "@/types/database";

const STATUS_TONE: Record<GoalStatus, "neutral" | "accent" | "success" | "danger"> = {
  "Not Started": "neutral",
  "In Progress": "accent",
  Completed: "success",
  Cancelled: "danger",
};

export function GoalsWidget({ data, onAddGoal }: { data: DashboardData; onAddGoal: () => void }) {
  const router = useRouter();
  const { list: goals, draggingId, handleDragStart, handleDragOver, handleDragEnd } = useDragReorder(
    data.goals.activeList,
    reorderGoals
  );

  return (
    <WidgetShell
      title="Goals"
      meta={`${data.goals.active} active`}
      action={
        <div className="flex items-center gap-1">
          <Link href="/goals" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-t6 hover:bg-surface2 hover:text-t3">
            View all
          </Link>
          <WidgetAddButton onClick={onAddGoal} label="Goal" domain="goals" />
        </div>
      }
      domain="goals"
      className="h-full"
      bodyClassName="px-[16px] py-[13px]"
    >
      {goals.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[12.5px] text-t6">No active goals yet.</p>
          <button type="button" onClick={onAddGoal} className="text-[12px] font-bold" style={{ color: "var(--domain-goals)" }}>
            + Add a goal
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => (
            <li
              key={goal.id}
              onDragOver={(e) => handleDragOver(goal.id, e)}
              className={clsx("group flex items-start gap-1", draggingId === goal.id && "opacity-40")}
            >
              <DragHandle onDragStart={() => handleDragStart(goal.id)} onDragEnd={handleDragEnd} />
              <button type="button" onClick={() => router.push(`/goals/${goal.id}`)} className="min-w-0 flex-1 text-left">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{goal.title}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-t3">{goal.progress}%</span>
                </div>
                <ProgressBar value={goal.progress} color="var(--domain-goals)" />
                <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-t6">
                  {goal.category && <Badge tone="goals">{goal.category}</Badge>}
                  <Badge tone={STATUS_TONE[goal.status]}>{goal.status}</Badge>
                  {goal.target_date && <span className="font-mono">Target: {goal.target_date}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
