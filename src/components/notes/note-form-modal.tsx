"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput } from "@/components/ui/field";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { createNote, updateNote } from "@/lib/actions/notes";
import type { NoteWithRelations } from "@/lib/queries/notes";

export interface RelationOption {
  id: string;
  name: string;
}

export function NoteFormModal({
  open,
  onClose,
  note,
  tasks = [],
  goals = [],
  defaultTaskId,
  defaultGoalId,
}: {
  open: boolean;
  onClose: () => void;
  note?: NoteWithRelations | null;
  tasks?: RelationOption[];
  goals?: RelationOption[];
  defaultTaskId?: string;
  defaultGoalId?: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(note);

  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [tags, setTags] = useState((note?.tags ?? []).join(", "));
  const [taskId, setTaskId] = useState(note?.task_id ?? defaultTaskId ?? "");
  const [goalId, setGoalId] = useState(note?.goal_id ?? defaultGoalId ?? "");
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
        content: content || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        task_id: taskId || null,
        goal_id: goalId || null,
      };

      if (isEditing && note) {
        await updateNote(note.id, payload);
      } else {
        await createNote(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit note" : "New note"} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Title" htmlFor="note-title">
          <TextInput id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </Field>

        <Field label="Content">
          <RichTextEditor value={content ?? ""} onChange={setContent} placeholder="Write something…" />
        </Field>

        <Field label="Tags" htmlFor="note-tags">
          <TextInput
            id="note-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="comma, separated"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Task" htmlFor="note-task">
            <Select id="note-task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Goal" htmlFor="note-goal">
            <Select id="note-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create note"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
