"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createSession, updateSession } from "@/lib/actions/learning";
import type { LearningSession } from "@/types/database";

const CONFIDENCE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export function SessionFormModal({
  open,
  onClose,
  topicId,
  areaId,
  session,
}: {
  open: boolean;
  onClose: () => void;
  topicId: string;
  areaId: string;
  session?: LearningSession | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(session);

  const [date, setDate] = useState(session?.date ?? new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(session?.duration_minutes != null ? String(session.duration_minutes) : "30");
  const [whatLearned, setWhatLearned] = useState(session?.what_learned ?? "");
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [confidenceBefore, setConfidenceBefore] = useState(
    session?.confidence_before != null ? String(session.confidence_before) : ""
  );
  const [confidenceAfter, setConfidenceAfter] = useState(
    session?.confidence_after != null ? String(session.confidence_after) : ""
  );
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
        topic_id: topicId,
        date,
        duration_minutes: durationValue,
        what_learned: whatLearned || null,
        notes: notes || null,
        confidence_before: confidenceBefore ? Number(confidenceBefore) : null,
        confidence_after: confidenceAfter ? Number(confidenceAfter) : null,
      };

      if (isEditing && session) {
        await updateSession(session.id, areaId, topicId, payload);
      } else {
        await createSession(payload, areaId);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit session" : "Log study session"} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" htmlFor="session-date">
            <TextInput id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Duration (minutes)" htmlFor="session-duration">
            <TextInput
              id="session-duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Confidence before" htmlFor="session-confidence-before">
            <Select id="session-confidence-before" value={confidenceBefore} onChange={(e) => setConfidenceBefore(e.target.value)}>
              <option value="">Not set</option>
              {CONFIDENCE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Confidence after" htmlFor="session-confidence-after">
            <Select id="session-confidence-after" value={confidenceAfter} onChange={(e) => setConfidenceAfter(e.target.value)}>
              <option value="">Not set</option>
              {CONFIDENCE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="What did you learn?" htmlFor="session-what-learned">
          <Textarea
            id="session-what-learned"
            rows={2}
            value={whatLearned ?? ""}
            onChange={(e) => setWhatLearned(e.target.value)}
          />
        </Field>

        <Field label="Notes" htmlFor="session-notes">
          <Textarea id="session-notes" rows={2} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Log session"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
