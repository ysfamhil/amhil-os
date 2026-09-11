"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { TaskList } from "@/components/tasks/task-list";
import { TaskEmptyState, type GoalSuggestion } from "@/components/tasks/task-empty-state";
import { TaskKanban } from "@/components/tasks/task-kanban";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTask, setTaskStatus } from "@/lib/actions/tasks";
import { useCompletedTasks } from "@/lib/hooks/use-completed-tasks";
import type { SubtaskProgress, TaskTab, TaskTabCounts } from "@/lib/queries/tasks";
import type { Task, TaskStatus } from "@/types/database";

const TAB_ORDER: TaskTab[] = ["all", "today", "upcoming", "overdue", "completed"];

export function TaskBoard({
  tasks,
  counts,
  subtaskProgress,
  timeLogged,
  tags,
  goalSuggestions,
}: {
  tasks: Task[];
  counts: TaskTabCounts;
  subtaskProgress: Record<string, SubtaskProgress>;
  timeLogged: Record<string, number>;
  tags: string[];
  goalSuggestions: GoalSuggestion[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "list";
  const tab = (searchParams.get("tab") ?? "all") as TaskTab;

  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);

  const { merge, markDone, clearDone, isDone } = useCompletedTasks<Task>();
  const mergedTasks = merge(tasks);

  function openEditTask(task: Task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  async function handleStatusChange(task: Task, status: TaskStatus) {
    if (status === "Done") markDone(task);
    else clearDone(task.id);
    await setTaskStatus(task.id, status);
    router.refresh();
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        quickAddRef.current?.querySelector("input")?.focus();
      } else if (/^[1-5]$/.test(e.key)) {
        const params = new URLSearchParams(window.location.search);
        params.set("tab", TAB_ORDER[Number(e.key) - 1]);
        router.push(`?${params.toString()}`);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [router]);

  const grouped = tab === "upcoming" || tab === "all";

  return (
    <div className="flex flex-col gap-3">
      <TaskFilterBar counts={counts} tags={tags} />

      <div ref={quickAddRef}>
        <TaskQuickAdd />
      </div>

      {mergedTasks.length === 0 ? (
        <TaskEmptyState tab={tab} counts={counts} suggestions={goalSuggestions} />
      ) : view === "kanban" ? (
        <TaskKanban
          tasks={mergedTasks}
          onEdit={openEditTask}
          onDelete={setDeletingTask}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <TaskList
          tasks={mergedTasks}
          grouped={grouped}
          subtaskProgress={subtaskProgress}
          timeLogged={timeLogged}
          isDone={isDone}
          onToggleComplete={markDone}
          onEdit={openEditTask}
          onRequestDelete={setDeletingTask}
          onStatusChanged={handleStatusChange}
        />
      )}

      <TaskFormModal key={editingTask?.id ?? "new"} open={modalOpen} onClose={() => setModalOpen(false)} task={editingTask} />

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
