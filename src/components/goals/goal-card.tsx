import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { GoalWithProgress } from "@/lib/queries/goals";
import type { GoalStatus } from "@/types/database";

const STATUS_TONE: Record<GoalStatus, "neutral" | "accent" | "success" | "danger"> = {
  "Not Started": "neutral",
  "In Progress": "accent",
  Completed: "success",
  Cancelled: "danger",
};

export function GoalCard({ goal }: { goal: GoalWithProgress }) {
  return (
    <Link href={`/goals/${goal.id}`}>
      <Card className="flex h-full flex-col gap-3 transition-colors hover:border-accent/50">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{goal.title}</h3>
          <Badge tone={STATUS_TONE[goal.status]}>{goal.status}</Badge>
        </div>

        {goal.category && <Badge tone="neutral">{goal.category}</Badge>}

        {goal.description && <p className="line-clamp-2 text-sm text-muted">{goal.description}</p>}

        <div className="mt-auto">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>{goal.progress}% complete</span>
            <span>{goal.source === "tasks" ? `${goal.linkedTasks} tasks` : "manual"}</span>
          </div>
          <ProgressBar value={goal.progress} />
        </div>

        {goal.target_date && <p className="text-xs text-muted">Target: {goal.target_date}</p>}
      </Card>
    </Link>
  );
}
