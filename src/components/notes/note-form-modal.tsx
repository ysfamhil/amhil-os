"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
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
  projects = [],
  clients = [],
  tasks = [],
  topics = [],
  goals = [],
  defaultProjectId,
  defaultClientId,
  defaultTaskId,
  defaultTopicId,
  defaultGoalId,
}: {
  open: boolean;
  onClose: () => void;
  note?: NoteWithRelations | null;
  projects?: RelationOption[];
  clients?: RelationOption[];
  tasks?: RelationOption[];
  topics?: RelationOption[];
  goals?: RelationOption[];
  defaultProjectId?: string;
  defaultClientId?: string;
  defaultTaskId?: string;
  defaultTopicId?: string;
  defaultGoalId?: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(note);

  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [tags, setTags] = useState((note?.tags ?? []).join(", "));
  const [projectId, setProjectId] = useState(note?.project_id ?? defaultProjectId ?? "");
  const [clientId, setClientId] = useState(note?.client_id ?? defaultClientId ?? "");
  const [taskId, setTaskId] = useState(note?.task_id ?? defaultTaskId ?? "");
  const [topicId, setTopicId] = useState(note?.learning_topic_id ?? defaultTopicId ?? "");
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
        project_id: projectId || null,
        client_id: clientId || null,
        task_id: taskId || null,
        learning_topic_id: topicId || null,
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

        <Field label="Content" htmlFor="note-content">
          <Textarea id="note-content" rows={6} value={content ?? ""} onChange={(e) => setContent(e.target.value)} />
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
          <Field label="Project" htmlFor="note-project">
            <Select id="note-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Client" htmlFor="note-client">
            <Select id="note-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
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
          <Field label="Learning topic" htmlFor="note-topic">
            <Select id="note-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">No topic</option>
              {topics.map((t) => (
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
