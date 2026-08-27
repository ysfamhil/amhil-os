"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/finance/date-range-picker";
import type { DateRangePreset } from "@/lib/date-ranges";
import { TIMELINE_CATEGORIES } from "@/lib/timeline";

export interface ProjectOption {
  id: string;
  name: string;
}

const ENTITY_TYPES = [
  "task",
  "project",
  "learning_topic",
  "habit",
  "goal",
  "client",
  "lead",
  "income",
  "expense",
  "time_entry",
  "note",
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  task: "Task",
  project: "Project",
  learning_topic: "Learning topic",
  habit: "Habit",
  goal: "Goal",
  client: "Client",
  lead: "Lead",
  income: "Income",
  expense: "Expense",
  time_entry: "Time entry",
  note: "Note",
};

export function TimelineFilters({ range, projects }: { range: DateRangePreset; projects: ProjectOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const category = searchParams.get("category") ?? "";
  const project = searchParams.get("project") ?? "";
  const entityType = searchParams.get("entityType") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={category}
        onChange={(e) => updateParams({ category: e.target.value || null })}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">All categories</option>
        {TIMELINE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={entityType}
        onChange={(e) => updateParams({ entityType: e.target.value || null })}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">All entity types</option>
        {ENTITY_TYPES.map((t) => (
          <option key={t} value={t}>
            {ENTITY_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      <select
        value={project}
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

      <DateRangePicker current={range} />
    </div>
  );
}
