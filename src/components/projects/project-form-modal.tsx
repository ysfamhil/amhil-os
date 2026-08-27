"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createProject, updateProject } from "@/lib/actions/projects";
import type { Project, ProjectStatus } from "@/types/database";

const STATUSES: ProjectStatus[] = ["Idea", "Planned", "Active", "On Hold", "Completed", "Archived"];

export interface GoalOption {
  id: string;
  title: string;
}

export interface ClientOption {
  id: string;
  name: string;
}

export function ProjectFormModal({
  open,
  onClose,
  project,
  goals = [],
  clients = [],
  defaultClientId,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  goals?: GoalOption[];
  clients?: ClientOption[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(project);

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "Planned");
  const [startDate, setStartDate] = useState(project?.start_date ?? "");
  const [targetDate, setTargetDate] = useState(project?.target_date ?? "");
  const [goalId, setGoalId] = useState(project?.goal_id ?? "");
  const [clientId, setClientId] = useState(project?.client_id ?? defaultClientId ?? "");
  const [category, setCategory] = useState(project?.category ?? "");
  const [budget, setBudget] = useState(project?.budget != null ? String(project.budget) : "");
  const [estimatedHours, setEstimatedHours] = useState(
    project?.estimated_hours != null ? String(project.estimated_hours) : ""
  );
  const [notes, setNotes] = useState(project?.notes ?? "");

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
        status,
        start_date: startDate || null,
        target_date: targetDate || null,
        goal_id: goalId || null,
        client_id: clientId || null,
        category: category || null,
        budget: budget ? Number(budget) : null,
        estimated_hours: estimatedHours ? Number(estimatedHours) : null,
        notes: notes || null,
      };

      if (isEditing && project) {
        await updateProject(project.id, payload);
      } else {
        const created = await createProject(payload);
        router.refresh();
        onClose();
        if (created?.id) router.push(`/projects/${created.id}`);
        return;
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit project" : "New project"} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="project-name">
          <TextInput id="project-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </Field>

        <Field label="Description" htmlFor="project-description">
          <Textarea
            id="project-description"
            rows={2}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Status" htmlFor="project-status">
            <Select id="project-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Start date" htmlFor="project-start">
            <TextInput
              id="project-start"
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>

          <Field label="Target date" htmlFor="project-target">
            <TextInput
              id="project-target"
              type="date"
              value={targetDate ?? ""}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Category" htmlFor="project-category">
            <TextInput
              id="project-category"
              value={category ?? ""}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Freelance"
            />
          </Field>

          <Field label="Budget (MAD)" htmlFor="project-budget">
            <TextInput
              id="project-budget"
              type="number"
              min={0}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </Field>

          <Field label="Est. hours" htmlFor="project-hours">
            <TextInput
              id="project-hours"
              type="number"
              min={0}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {clients.length > 0 && (
            <Field label="Client" htmlFor="project-client">
              <Select id="project-client" value={clientId ?? ""} onChange={(e) => setClientId(e.target.value)}>
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {goals.length > 0 && (
            <Field label="Goal" htmlFor="project-goal">
              <Select id="project-goal" value={goalId ?? ""} onChange={(e) => setGoalId(e.target.value)}>
                <option value="">No goal</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Notes" htmlFor="project-notes">
          <Textarea id="project-notes" rows={2} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
