"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createHabit, updateHabit } from "@/lib/actions/habits";
import type { Habit, HabitFrequency } from "@/types/database";

const FREQUENCIES: HabitFrequency[] = ["daily", "weekly"];

export interface GoalOption {
  id: string;
  title: string;
}

export function HabitFormModal({
  open,
  onClose,
  habit,
  goals = [],
}: {
  open: boolean;
  onClose: () => void;
  habit?: Habit | null;
  goals?: GoalOption[];
}) {
  const router = useRouter();
  const isEditing = Boolean(habit);

  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? "daily");
  const [target, setTarget] = useState(habit?.target != null ? String(habit.target) : "1");
  const [goalId, setGoalId] = useState(habit?.goal_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setPending(true);
    try {
      const payload = {
        name,
        description: description || null,
        frequency,
        target: target ? Number(target) : 1,
        goal_id: goalId || null,
      };
      if (isEditing && habit) {
        await updateHabit(habit.id, payload);
      } else {
        await createHabit(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit habit" : "New habit"} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="habit-name">
          <TextInput
            id="habit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            placeholder="e.g. Morning workout"
          />
        </Field>

        <Field label="Description" htmlFor="habit-description">
          <Textarea
            id="habit-description"
            rows={2}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Frequency" htmlFor="habit-frequency">
            <Select id="habit-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as HabitFrequency)}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f === "daily" ? "Daily" : "Weekly"}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Target / period" htmlFor="habit-target">
            <TextInput
              id="habit-target"
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
        </div>

        {goals.length > 0 && (
          <Field label="Goal" htmlFor="habit-goal">
            <Select id="habit-goal" value={goalId ?? ""} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create habit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
