"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createTopic, updateTopic } from "@/lib/actions/learning";
import type { LearningTopic, LearningTopicStatus } from "@/types/database";

const STATUSES: LearningTopicStatus[] = ["Not Started", "Learning", "Practicing", "Completed", "Reviewing"];
const CONFIDENCE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export interface GoalOption {
  id: string;
  title: string;
}

export function TopicFormModal({
  open,
  onClose,
  areaId,
  topic,
  goals = [],
}: {
  open: boolean;
  onClose: () => void;
  areaId: string;
  topic?: LearningTopic | null;
  goals?: GoalOption[];
}) {
  const router = useRouter();
  const isEditing = Boolean(topic);

  const [name, setName] = useState(topic?.name ?? "");
  const [status, setStatus] = useState<LearningTopicStatus>(topic?.status ?? "Not Started");
  const [progress, setProgress] = useState(topic?.progress != null ? String(topic.progress) : "0");
  const [confidence, setConfidence] = useState(topic?.confidence != null ? String(topic.confidence) : "");
  const [goalId, setGoalId] = useState(topic?.goal_id ?? "");
  const [notes, setNotes] = useState(topic?.notes ?? "");
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
        area_id: areaId,
        name,
        status,
        progress: progress ? Number(progress) : 0,
        confidence: confidence ? Number(confidence) : null,
        goal_id: goalId || null,
        notes: notes || null,
      };
      if (isEditing && topic) {
        await updateTopic(topic.id, areaId, payload);
      } else {
        await createTopic(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit topic" : "New topic"} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="topic-name">
          <TextInput
            id="topic-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            placeholder="e.g. Purchase"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status" htmlFor="topic-status">
            <Select
              id="topic-status"
              value={status}
              onChange={(e) => {
                const next = e.target.value as LearningTopicStatus;
                setStatus(next);
                // Completed always means 100% — the server enforces this
                // too, but reflecting it immediately avoids the form
                // showing a stale progress value right before save.
                if (next === "Completed") setProgress("100");
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Confidence (1–10)" htmlFor="topic-confidence">
            <Select id="topic-confidence" value={confidence} onChange={(e) => setConfidence(e.target.value)}>
              <option value="">Not set</option>
              {CONFIDENCE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Progress %" htmlFor="topic-progress">
          <TextInput
            id="topic-progress"
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            disabled={status === "Completed"}
          />
        </Field>

        {goals.length > 0 && (
          <Field label="Goal" htmlFor="topic-goal">
            <Select id="topic-goal" value={goalId ?? ""} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Notes" htmlFor="topic-notes">
          <Textarea id="topic-notes" rows={3} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create topic"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
