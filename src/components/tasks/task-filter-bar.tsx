"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import { Menu, MenuCheckboxItem } from "@/components/ui/menu";
import { tagColor } from "@/lib/tag-color";
import type { TaskTabCounts } from "@/lib/queries/tasks";
import type { TaskPriority } from "@/types/database";

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

const PRIORITIES: TaskPriority[] = ["Urgent", "High", "Medium", "Low"];

export function TaskFilterBar({ counts, tags }: { counts: TaskTabCounts; tags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const activeTab = searchParams.get("tab") ?? "all";
  const view = searchParams.get("view") ?? "list";
  const selectedPriorities = (searchParams.get("priority") ?? "").split(",").filter(Boolean);
  const selectedTags = (searchParams.get("tag") ?? "").split(",").filter(Boolean);
  const activeFilterCount = selectedPriorities.length + selectedTags.length;

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function toggleListValue(key: "priority" | "tag", value: string, current: string[]) {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    updateParams({ [key]: next.length > 0 ? next.join(",") : null });
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
    <div className="sticky top-0 z-20 flex flex-col gap-3 bg-background pb-3 pt-0.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 border-b border-line">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = counts[tab.key as keyof TaskTabCounts];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => updateParams({ tab: tab.key })}
                className={clsx(
                  "relative flex items-center gap-1.5 pb-[9px] pt-1 text-[13px] font-semibold transition-colors",
                  isActive ? "text-foreground" : "text-t4 hover:text-t2"
                )}
              >
                {tab.label}
                <span
                  className={clsx(
                    "font-mono text-[10.5px]",
                    tab.key === "overdue" && count > 0
                      ? "rounded-full bg-r13 px-[5px] py-[1px] text-red"
                      : isActive
                        ? "text-accent"
                        : "text-t7"
                  )}
                >
                  {count}
                </span>
                {isActive && <span className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-[11px] border border-line3 p-[3px]">
            <button
              type="button"
              onClick={() => updateParams({ view: "list" })}
              aria-label="List view"
              className={clsx(
                "rounded-[8px] p-1.5",
                view === "list" ? "bg-a13 text-accent" : "text-t5 hover:text-t2"
              )}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => updateParams({ view: "kanban" })}
              aria-label="Kanban view"
              className={clsx(
                "rounded-[8px] p-1.5",
                view === "kanban" ? "bg-a13 text-accent" : "text-t5 hover:text-t2"
              )}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-t6" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tasks…"
            className="w-full rounded-[11px] border border-line3 bg-surface py-2 pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-[var(--domain-tasks)]"
          />
        </div>

        <Menu
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-[11px] border px-3 py-2 text-[12.5px] font-medium transition-colors",
                open || selectedPriorities.length > 0 ? "border-[var(--domain-tasks)] text-foreground" : "border-line3 text-t4 hover:text-t2"
              )}
            >
              Priority {selectedPriorities.length > 0 && `(${selectedPriorities.length})`}
            </button>
          )}
        >
          {() => (
            <>
              {PRIORITIES.map((p) => (
                <MenuCheckboxItem
                  key={p}
                  checked={selectedPriorities.includes(p)}
                  onToggle={() => toggleListValue("priority", p, selectedPriorities)}
                >
                  {p}
                </MenuCheckboxItem>
              ))}
            </>
          )}
        </Menu>

        {tags.length > 0 && (
          <Menu
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-[11px] border px-3 py-2 text-[12.5px] font-medium transition-colors",
                  open || selectedTags.length > 0 ? "border-[var(--domain-tasks)] text-foreground" : "border-line3 text-t4 hover:text-t2"
                )}
              >
                Tag {selectedTags.length > 0 && `(${selectedTags.length})`}
              </button>
            )}
          >
            {() => (
              <>
                {tags.map((t) => (
                  <MenuCheckboxItem
                    key={t}
                    checked={selectedTags.includes(t)}
                    onToggle={() => toggleListValue("tag", t, selectedTags)}
                    color={tagColor(t)}
                  >
                    {t}
                  </MenuCheckboxItem>
                ))}
              </>
            )}
          </Menu>
        )}

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => updateParams({ priority: null, tag: null })}
            className="inline-flex items-center gap-1 rounded-[11px] px-2 py-2 text-[12.5px] font-medium text-t5 hover:text-red"
          >
            <X size={13} />
            Clear all
          </button>
        )}

        <span className="ml-auto hidden items-center gap-1 text-[10.5px] text-t7 sm:flex">
          <SlidersHorizontal size={11} />
          Sorted by due date
        </span>
      </div>
    </div>
  );
}
