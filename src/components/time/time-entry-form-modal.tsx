"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createTimeEntry, updateTimeEntry } from "@/lib/actions/time-entries";
import type { TimeEntry } from "@/types/database";

const CATEGORIES = ["Work", "Learning", "Personal", "Other"];

export interface TaskOption {
  id: string;
  title: string;
}

export function TimeEntryFormModal({
  open,
  onClose,
  entry,
  tasks,
}: {
  open: boolean;
  onClose: () => void;
  entry?: TimeEntry | null;
  tasks: TaskOption[];
}) {
  const router = useRouter();
  const isEditing = Boolean(entry);

  const [date, setDate] = useState(entry?.date ?? new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(entry?.duration_minutes != null ? String(Math.floor(entry.duration_minutes / 60)) : "0");
  const [minutes, setMinutes] = useState(entry?.duration_minutes != null ? String(entry.duration_minutes % 60) : "30");
  const [category, setCategory] = useState(entry?.category ?? "Work");
  const [taskId, setTaskId] = useState(entry?.task_id ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const hoursValue = Number(hours) || 0;
    const minutesValue = Number(minutes) || 0;
    if (minutesValue < 0 || minutesValue > 59) {
      setError("Minutes must be between 0 and 59");
      return;
    }
    if (hoursValue < 0) {
      setError("Hours can't be negative");
      return;
    }
    const durationValue = hoursValue * 60 + minutesValue;
    if (durationValue <= 0) {
      setError("Duration must be greater than zero");
      return;
    }

    setPending(true);
    try {
      const payload = {
        date,
        duration_minutes: durationValue,
        category: category || null,
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
        <div className="grid grid-cols-3 gap-4">
          <Field label="Date" htmlFor="time-date">
            <TextInput id="time-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Hours" htmlFor="time-hours">
            <TextInput
              id="time-hours"
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
            />
          </Field>
          <Field label="Minutes" htmlFor="time-minutes">
            <TextInput
              id="time-minutes"
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="time-category">
            <Select id="time-category" value={category ?? ""} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
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
