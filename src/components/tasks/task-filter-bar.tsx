"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import clsx from "clsx";
import type { TaskTabCounts } from "@/lib/queries/tasks";
import type { ProjectOption } from "@/components/tasks/task-form-modal";

const TABS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export function TaskFilterBar({
  counts,
  projects,
  onNewTask,
}: {
  counts: TaskTabCounts;
  projects: ProjectOption[];
  onNewTask: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const activeTab = searchParams.get("tab") ?? "today";
  const view = searchParams.get("view") ?? "list";
  const projectId = searchParams.get("project") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const sort = searchParams.get("sort") ?? "due_date";

  function updateParams(patch: Record<string, string | null>) {
    // Read from the live URL rather than the `searchParams` closure — rapid
    // successive calls (e.g. fast typing) can otherwise race and clobber
    // each other's updates since each call captures its own stale snapshot.
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateParams({ q: value || null });
    }, 300);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateParams({ tab: tab.key })}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.key ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">
                {counts[tab.key as keyof TaskTabCounts]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => updateParams({ view: "list" })}
              aria-label="List view"
              className={clsx(
                "rounded-md p-1.5",
                view === "list" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => updateParams({ view: "kanban" })}
              aria-label="Kanban view"
              className={clsx(
                "rounded-md p-1.5",
                view === "kanban" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={onNewTask}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            <Plus size={16} />
            New Task
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tasks…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>

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
          value={priority}
          onChange={(e) => updateParams({ priority: e.target.value || null })}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="due_date">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="created_at">Sort: Newest</option>
        </select>
      </div>
    </div>
  );
}
