"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListTodo, Pencil, Archive, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectFormModal, type GoalOption } from "@/components/projects/project-form-modal";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { TaskRow } from "@/components/tasks/task-row";
import { EntityNotes } from "@/components/notes/entity-notes";
import { archiveProject, deleteProject } from "@/lib/actions/projects";
import { deleteTask, setTaskStatus } from "@/lib/actions/tasks";
import type { ProjectWithStats } from "@/lib/queries/projects";
import type { SubtaskProgress, TaskWithProject } from "@/lib/queries/tasks";
import type { Task, TaskStatus } from "@/types/database";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export interface ActivityItem {
  id: string;
  label: string;
  at: string;
}

export function ProjectDetailClient({
  project,
  tasks,
  subtaskProgress,
  activity,
  goals = [],
}: {
  project: ProjectWithStats;
  tasks: TaskWithProject[];
  subtaskProgress: Record<string, SubtaskProgress>;
  activity: ActivityItem[];
  goals?: GoalOption[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskWithProject | null>(null);

  function openNewTask() {
    setEditingTask(null);
    setTaskModalOpen(true);
  }

  async function handleStatusChange(task: TaskWithProject, status: TaskStatus) {
    await setTaskStatus(task.id, status);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            <Badge tone="accent">{project.status}</Badge>
          </div>
          {project.description && <p className="mt-1 text-sm text-muted">{project.description}</p>}
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
            onClick={() => setArchiveOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            <Archive size={14} />
            Archive
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
        <CardHeader title="Overview" />
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted">Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <ProgressBar value={project.progress} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total tasks" value={String(project.totalTasks)} />
          <Stat label="Completed" value={String(project.completedTasks)} />
          <Stat label="Remaining" value={String(project.remainingTasks)} />
          <Stat
            label="Overdue"
            value={String(project.overdueTasks)}
            tone={project.overdueTasks > 0 ? "danger" : undefined}
          />
          <Stat label="Start date" value={project.start_date ?? "—"} />
          <Stat label="Target date" value={project.target_date ?? "—"} />
          <Stat label="Budget" value={project.budget != null ? `${money(project.budget)} MAD` : "—"} />
          <Stat
            label="Est. / Actual hours"
            value={`${project.estimated_hours ?? "—"} / ${project.hoursInvested.toFixed(1)}h`}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Finance" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Revenue (paid)" value={`${money(project.revenue)} MAD`} tone="success" />
          <Stat label="Expected revenue" value={`${money(project.expectedRevenue)} MAD`} />
          <Stat label="Expenses" value={`${money(project.expenses)} MAD`} />
          <Stat
            label="Profit"
            value={`${money(project.profit)} MAD`}
            tone={project.profit >= 0 ? "success" : "danger"}
          />
          <Stat label="Income records" value={String(project.incomeCount)} />
          <Stat label="Expense records" value={String(project.expenseCount)} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Tasks"
          action={
            <button
              type="button"
              onClick={openNewTask}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
            >
              Add Task
            </button>
          }
        />
        {tasks.length === 0 ? (
          <EmptyState icon={ListTodo} title="No tasks yet" description="Add the first task for this project." />
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                subtaskProgress={subtaskProgress[task.id]}
                onEdit={() => {
                  setEditingTask(task);
                  setTaskModalOpen(true);
                }}
                onDelete={() => setDeletingTask(task)}
                onStatusChange={(status) => handleStatusChange(task, status)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <EntityNotes projectId={project.id} projectLabel={project.name} />
      </Card>

      <Card>
        <CardHeader title="Activity" />
        {activity.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <span className="text-xs text-muted">
                  {new Date(item.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ProjectFormModal open={editOpen} onClose={() => setEditOpen(false)} project={project} goals={goals} />

      <TaskFormModal
        key={editingTask?.id ?? "new"}
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={editingTask}
        projects={[{ id: project.id, name: project.name }]}
        goals={goals}
        defaultProjectId={project.id}
      />

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive project"
        description={`Archive "${project.name}"? It will move out of active projects but tasks and data stay intact.`}
        confirmLabel="Archive"
        onConfirm={async () => {
          await archiveProject(project.id);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete project"
        description={`Delete "${project.name}"? Its tasks will stay but become unassigned. This can't be undone.`}
        onConfirm={async () => {
          await deleteProject(project.id);
          router.push("/projects");
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingTask)}
        onClose={() => setDeletingTask(null)}
        title="Delete task"
        description={`Delete "${deletingTask?.title}"? This also removes its subtasks.`}
        onConfirm={async () => {
          if (deletingTask) {
            await deleteTask(deletingTask.id);
            router.refresh();
          }
        }}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-base font-semibold ${
          tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
