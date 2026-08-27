"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Clock, Plus, Trash2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  TimeEntryFormModal,
  type ProjectOption,
  type TaskOption,
} from "@/components/time/time-entry-form-modal";
import { deleteTimeEntry } from "@/lib/actions/time-entries";
import type { TimeEntryWithRelations, TimeStats } from "@/lib/queries/time-entries";
import type { TimeEntry } from "@/types/database";

const CATEGORIES = ["Work", "Learning", "Personal", "Other"];

function hours(h: number) {
  return `${h.toFixed(1)}h`;
}

export function TimeBoard({
  entries,
  stats,
  projects,
  tasks,
}: {
  entries: TimeEntryWithRelations[];
  stats: TimeStats;
  projects: ProjectOption[];
  tasks: TaskOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntryWithRelations | null>(null);

  const date = searchParams.get("date") ?? "";
  const projectId = searchParams.get("project") ?? "";
  const category = searchParams.get("category") ?? "";

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function openNew() {
    setEditingEntry(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Today</p>
          <p className="mt-1 text-lg font-semibold">{hours(stats.todayHours)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">This week</p>
          <p className="mt-1 text-lg font-semibold">{hours(stats.weekHours)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">This month</p>
          <p className="mt-1 text-lg font-semibold">{hours(stats.monthHours)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">All time</p>
          <p className="mt-1 text-lg font-semibold">{hours(stats.totalHours)}</p>
        </Card>
      </div>

      {stats.byCategory.length > 0 && (
        <Card>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">By category</p>
          <div className="flex flex-wrap gap-2">
            {stats.byCategory.map((c) => (
              <Badge key={c.category} tone="neutral">
                {c.category}: {hours(c.hours)}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => updateParams({ date: e.target.value || null })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={projectId}
            onChange={(e) => updateParams({ project: e.target.value || null })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => updateParams({ category: e.target.value || null })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(date || projectId || category) && (
            <button
              type="button"
              onClick={() => updateParams({ date: null, project: null, category: null })}
              className="text-xs text-muted hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={16} />
          Log Time
        </button>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Clock} title="No time entries" description="Log time against a project, task, or category." />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{entry.date}</span>
                  {entry.category && <Badge tone="neutral">{entry.category}</Badge>}
                  {entry.projects && <span className="text-muted">{entry.projects.name}</span>}
                  {entry.tasks && <span className="text-muted">· {entry.tasks.title}</span>}
                </div>
                {entry.description && <p className="mt-1 text-sm text-muted">{entry.description}</p>}
              </div>
              <Badge tone="accent">{hours(entry.duration_minutes / 60)}</Badge>
              <button
                type="button"
                onClick={() => {
                  setEditingEntry(entry);
                  setModalOpen(true);
                }}
                className="text-muted hover:text-foreground"
                aria-label="Edit entry"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDeletingEntry(entry)}
                className="text-muted hover:text-danger"
                aria-label="Delete entry"
              >
                <Trash2 size={14} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <TimeEntryFormModal
        key={editingEntry?.id ?? "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        entry={editingEntry}
        projects={projects}
        tasks={tasks}
      />

      <ConfirmDialog
        open={Boolean(deletingEntry)}
        onClose={() => setDeletingEntry(null)}
        title="Delete time entry"
        description="Delete this time entry? This can't be undone."
        onConfirm={async () => {
          if (deletingEntry) {
            await deleteTimeEntry(deletingEntry.id);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
