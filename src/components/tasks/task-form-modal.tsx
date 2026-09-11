"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { createTask, updateTask } from "@/lib/actions/tasks";
import { TASK_TAGS } from "@/lib/tags";
import type { Task, TaskPriority, TaskStatus } from "@/types/database";

const STATUSES: TaskStatus[] = ["Backlog", "Todo", "In Progress", "Waiting", "Done", "Cancelled"];
const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Urgent"];

export function TaskFormModal({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "Todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "Medium");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    task?.estimated_minutes != null ? String(task.estimated_minutes) : ""
  );
  const [category, setCategory] = useState(task?.category ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForNewTask() {
    setTitle("");
    setDescription("");
    setStatus("Todo");
    setPriority("Medium");
    setDueDate("");
    setEstimatedMinutes("");
    setCategory("");
    setNotes("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setPending(true);
    try {
      const payload = {
        title,
        description: description || null,
        status,
        priority,
        due_date: dueDate || null,
        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
        category: category || null,
        notes: notes || null,
      };

      if (isEditing && task) {
        await updateTask(task.id, payload);
      } else {
        await createTask(payload);
        resetForNewTask();
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit task" : "New task"} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Title" htmlFor="task-title">
          <TextInput
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
        </Field>

        <Field label="Description" htmlFor="task-description">
          <Textarea
            id="task-description"
            rows={2}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Status" htmlFor="task-status">
            <Select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority" htmlFor="task-priority">
            <Select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Due date" htmlFor="task-due-date">
            <TextInput
              id="task-due-date"
              type="date"
              value={dueDate ?? ""}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>

          <Field label="Est. minutes" htmlFor="task-estimate">
            <TextInput
              id="task-estimate"
              type="number"
              min={0}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Tag" htmlFor="task-category">
          <TextInput
            id="task-category"
            list="task-tag-suggestions"
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Odoo"
          />
          <datalist id="task-tag-suggestions">
            {TASK_TAGS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>

        <Field label="Notes" htmlFor="task-notes">
          <Textarea
            id="task-notes"
            rows={2}
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>

      {isEditing && task && (
        <div className="mt-6 flex flex-col gap-6 border-t border-border pt-4">
          <SubtaskList taskId={task.id} />
        </div>
      )}
    </Modal>
  );
}
