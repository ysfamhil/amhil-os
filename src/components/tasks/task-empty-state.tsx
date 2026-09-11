"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import type { TaskTab } from "@/lib/queries/tasks";
import type { TaskTabCounts } from "@/lib/queries/tasks";

const HEADLINES: Record<TaskTab, string> = {
  today: "Today is empty",
  upcoming: "Upcoming is empty",
  overdue: "Overdue is empty",
  completed: "Nothing completed yet",
  all: "No tasks yet",
};

const SHORTCUTS: { key: string; label: string }[] = [
  { key: "N", label: "New task" },
  { key: "⌘K", label: "Search" },
  { key: "1–5", label: "Switch tab" },
  { key: "Esc", label: "Cancel" },
];

export interface GoalSuggestion {
  id: string;
  title: string;
  category: string | null;
}

export function TaskEmptyState({
  tab,
  counts,
  suggestions,
}: {
  tab: TaskTab;
  counts: TaskTabCounts;
  suggestions: GoalSuggestion[];
}) {
  const router = useRouter();

  async function createFromGoal(goal: GoalSuggestion) {
    await createTask({ title: `Work on ${goal.title}`, priority: "Medium", category: goal.category });
    router.refresh();
  }

  return (
    <div className="grid max-h-[260px] grid-cols-1 gap-6 overflow-hidden rounded-[16px] border border-line bg-surface p-6 sm:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[17px] font-extrabold tracking-[-0.01em]">{HEADLINES[tab]}</p>
          <p className="mt-1 text-[12.5px] text-t5">
            {counts.today} due today · {counts.upcoming} upcoming
          </p>
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-t6">Suggested</p>
            {suggestions.map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => createFromGoal(goal)}
                className="flex items-center gap-2 rounded-[9px] border border-line px-2.5 py-[7px] text-left text-[12.5px] text-t2 transition-colors hover:border-[var(--domain-tasks)] hover:text-foreground"
              >
                <Plus size={13} className="shrink-0 text-[var(--domain-tasks)]" />
                <span className="truncate">Work on {goal.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        {SHORTCUTS.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[11.5px] text-t6">
            <kbd className="min-w-[28px] rounded border border-line4 px-[6px] py-[1px] text-center font-mono text-[10px] text-t4">
              {s.key}
            </kbd>
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
