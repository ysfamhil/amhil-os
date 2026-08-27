"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ListTodo } from "lucide-react";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskKanban } from "@/components/tasks/task-kanban";
import { TaskFormModal, type GoalOption, type ProjectOption } from "@/components/tasks/task-form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteTask, setTaskStatus } from "@/lib/actions/tasks";
import type { SubtaskProgress, TaskTabCounts, TaskWithProject } from "@/lib/queries/tasks";
import type { Task, TaskStatus } from "@/types/database";

export function TaskBoard({
  tasks,
  counts,
  subtaskProgress,
  projects,
  goals = [],
}: {
  tasks: TaskWithProject[];
  counts: TaskTabCounts;
  subtaskProgress: Record<string, SubtaskProgress>;
  projects: ProjectOption[];
  goals?: GoalOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "list";

  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskWithProject | null>(null);

  function openNewTask() {
    setEditingTask(null);
    setModalOpen(true);
  }

  function openEditTask(task: TaskWithProject) {
    setEditingTask(task);
    setModalOpen(true);
  }

  async function handleStatusChange(task: TaskWithProject, status: TaskStatus) {
    await setTaskStatus(task.id, status);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskFilterBar counts={counts} projects={projects} onNewTask={openNewTask} />

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks here"
          description="Nothing matches this view yet. Create a task to get started."
          action={
            <button
              type="button"
              onClick={openNewTask}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              New Task
            </button>
          }
        />
      ) : view === "kanban" ? (
        <TaskKanban
          tasks={tasks}
          onEdit={openEditTask}
          onDelete={setDeletingTask}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              subtaskProgress={subtaskProgress[task.id]}
              onEdit={() => openEditTask(task)}
              onDelete={() => setDeletingTask(task)}
              onStatusChange={(status) => handleStatusChange(task, status)}
            />
          ))}
        </div>
      )}

      <TaskFormModal
        key={editingTask?.id ?? "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        projects={projects}
        goals={goals}
      />

      <ConfirmDialog
        open={Boolean(deletingTask)}
        onClose={() => setDeletingTask(null)}
        title="Delete task"
        description={`Delete "${deletingTask?.title}"? This also removes its subtasks. This can't be undone.`}
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
