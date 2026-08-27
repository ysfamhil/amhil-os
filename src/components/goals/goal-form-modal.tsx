"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createGoal, updateGoal } from "@/lib/actions/goals";
import type { Goal, GoalStatus } from "@/types/database";

const STATUSES: GoalStatus[] = ["Not Started", "In Progress", "Completed", "Cancelled"];

export function GoalFormModal({
  open,
  onClose,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(goal);

  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [category, setCategory] = useState(goal?.category ?? "");
  const [startDate, setStartDate] = useState(goal?.start_date ?? "");
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "Not Started");
  const [progress, setProgress] = useState(goal?.progress != null ? String(goal.progress) : "0");

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
        category: category || null,
        start_date: startDate || null,
        target_date: targetDate || null,
        status,
        progress: progress ? Number(progress) : 0,
      };

      if (isEditing && goal) {
        await updateGoal(goal.id, payload);
      } else {
        await createGoal(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit goal" : "New goal"} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Title" htmlFor="goal-title">
          <TextInput id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </Field>

        <Field label="Description" htmlFor="goal-description">
          <Textarea
            id="goal-description"
            rows={2}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Category" htmlFor="goal-category">
            <TextInput
              id="goal-category"
              value={category ?? ""}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Income"
            />
          </Field>

          <Field label="Status" htmlFor="goal-status">
            <Select id="goal-status" value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Start date" htmlFor="goal-start">
            <TextInput
              id="goal-start"
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>

          <Field label="Target date" htmlFor="goal-target">
            <TextInput
              id="goal-target"
              type="date"
              value={targetDate ?? ""}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Manual progress %"
          htmlFor="goal-progress"
          error={undefined}
        >
          <TextInput
            id="goal-progress"
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            Used only when no tasks or projects are linked to this goal — once you link some, progress is
            calculated automatically from their completion.
          </p>
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create goal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
