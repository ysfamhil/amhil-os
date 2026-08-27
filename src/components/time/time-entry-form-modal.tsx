"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createTimeEntry, updateTimeEntry } from "@/lib/actions/time-entries";
import type { TimeEntry } from "@/types/database";

const CATEGORIES = ["Work", "Learning", "Personal", "Other"];

export interface ProjectOption {
  id: string;
  name: string;
}

export interface TaskOption {
  id: string;
  title: string;
}

export function TimeEntryFormModal({
  open,
  onClose,
  entry,
  projects,
  tasks,
}: {
  open: boolean;
  onClose: () => void;
  entry?: TimeEntry | null;
  projects: ProjectOption[];
  tasks: TaskOption[];
}) {
  const router = useRouter();
  const isEditing = Boolean(entry);

  const [date, setDate] = useState(entry?.date ?? new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(entry?.duration_minutes != null ? String(entry.duration_minutes) : "30");
  const [category, setCategory] = useState(entry?.category ?? "Work");
  const [projectId, setProjectId] = useState(entry?.project_id ?? "");
  const [taskId, setTaskId] = useState(entry?.task_id ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const durationValue = Number(duration);
    if (!durationValue || durationValue <= 0) {
      setError("Duration must be a positive number of minutes");
      return;
    }

    setPending(true);
    try {
      const payload = {
        date,
        duration_minutes: durationValue,
        category: category || null,
        project_id: projectId || null,
        task_id: taskId || null,
        description: description || null,
      };

      if (isEditing && entry) {
        await updateTimeEntry(entry.id, payload);
      } else {
        await createTimeEntry(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit time entry" : "Log time"} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" htmlFor="time-date">
            <TextInput id="time-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Duration (minutes)" htmlFor="time-duration">
            <TextInput
              id="time-duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Category" htmlFor="time-category">
            <Select id="time-category" value={category ?? ""} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Project" htmlFor="time-project">
            <Select id="time-project" value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Task" htmlFor="time-task">
            <Select id="time-task" value={taskId ?? ""} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description" htmlFor="time-description">
          <Textarea
            id="time-description"
            rows={2}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Log time"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
