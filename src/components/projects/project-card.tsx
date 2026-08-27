import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { ProjectWithStats } from "@/lib/queries/projects";
import type { ProjectStatus } from "@/types/database";

const STATUS_TONE: Record<ProjectStatus, "neutral" | "accent" | "success" | "warning"> = {
  Idea: "neutral",
  Planned: "neutral",
  Active: "accent",
  "On Hold": "warning",
  Completed: "success",
  Archived: "neutral",
};

export function ProjectCard({ project }: { project: ProjectWithStats }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="flex h-full flex-col gap-3 transition-colors hover:border-accent/50">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{project.name}</h3>
          <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
        </div>

        {project.description && (
          <p className="line-clamp-2 text-sm text-muted">{project.description}</p>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>{project.progress}% complete</span>
            <span>
              {project.completedTasks}/{project.totalTasks} tasks
            </span>
          </div>
          <ProgressBar value={project.progress} />
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-muted">
          <span>{project.hoursInvested.toFixed(1)}h invested</span>
          {project.overdueTasks > 0 && (
            <span className="flex items-center gap-1 text-danger">
              <AlertTriangle size={12} />
              {project.overdueTasks} overdue
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
