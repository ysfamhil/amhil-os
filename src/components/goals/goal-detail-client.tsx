"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GoalFormModal } from "@/components/goals/goal-form-modal";
import { EntityNotes } from "@/components/notes/entity-notes";
import { deleteGoal } from "@/lib/actions/goals";
import type { GoalDetail } from "@/lib/queries/goals";

export function GoalDetailClient({ goal }: { goal: GoalDetail }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{goal.title}</h1>
            <Badge tone="accent">{goal.status}</Badge>
          </div>
          {goal.description && <p className="mt-1 text-sm text-muted">{goal.description}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      <Card>
        <CardHeader title="Progress" />
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">
            {goal.source === "tasks" && "Calculated from linked tasks"}
            {goal.source === "projects" && "Calculated from linked projects"}
            {goal.source === "manual" && "Set manually — link tasks or projects to automate this"}
          </span>
          <span className="font-medium">{goal.progress}%</span>
        </div>
        <ProgressBar value={goal.progress} />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm text-muted">
          <div>Category: {goal.category ?? "—"}</div>
          <div>Start: {goal.start_date ?? "—"}</div>
          <div>Target: {goal.target_date ?? "—"}</div>
          <div>Created: {new Date(goal.created_at).toLocaleDateString()}</div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Tasks (${goal.tasks.length})`} />
          {goal.tasks.length === 0 ? (
            <p className="text-sm text-muted">No tasks linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {goal.tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between text-sm">
                  <span className={task.status === "Done" ? "text-muted line-through" : ""}>{task.title}</span>
                  <Badge tone="neutral">{task.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Link href="/tasks" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
            Go to tasks →
          </Link>
        </Card>

        <Card>
          <CardHeader title={`Projects (${goal.projects.length})`} />
          {goal.projects.length === 0 ? (
            <p className="text-sm text-muted">No projects linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {goal.projects.map((project) => (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`} className="flex items-center justify-between text-sm hover:underline">
                    <span>{project.name}</span>
                    <Badge tone="neutral">{project.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={`Learning topics (${goal.topics.length})`} />
          {goal.topics.length === 0 ? (
            <p className="text-sm text-muted">No learning topics linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {goal.topics.map((topic) => (
                <li key={topic.id} className="flex items-center justify-between text-sm">
                  <span>{topic.name}</span>
                  <Badge tone="neutral">{topic.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={`Habits (${goal.habits.length})`} />
          {goal.habits.length === 0 ? (
            <p className="text-sm text-muted">No habits linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {goal.habits.map((habit) => (
                <li key={habit.id} className="text-sm">
                  {habit.name}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <EntityNotes goalId={goal.id} goalLabel={goal.title} />
      </Card>

      <GoalFormModal open={editOpen} onClose={() => setEditOpen(false)} goal={goal} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete goal"
        description={`Delete "${goal.title}"? Linked tasks, projects, topics, and habits stay intact and just become unlinked.`}
        onConfirm={async () => {
          await deleteGoal(goal.id);
          router.push("/goals");
          router.refresh();
        }}
      />
    </div>
  );
}
