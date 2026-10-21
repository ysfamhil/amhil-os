"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { JournalCalendar } from "@/components/journal/journal-calendar";
import { JournalEditor } from "@/components/journal/journal-editor";
import { JournalHistory, type JournalFilterState } from "@/components/journal/journal-history";
import { todayISODate } from "@/lib/dates";
import type { JournalListItem } from "@/lib/queries/journal";
import type { JournalEntry } from "@/types/database";

const subscribeNoop = () => () => {};

export function JournalBoard({
  selectedDate,
  serverToday,
  explicitDate,
  entry,
  items,
  entryDates,
  filters,
}: {
  selectedDate: string;
  /** "Today" as the server sees it — the client corrects it to the browser's local date. */
  serverToday: string;
  explicitDate: boolean;
  entry: JournalEntry | null;
  items: JournalListItem[];
  entryDates: string[];
  filters: JournalFilterState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // Browser-local "today" (server snapshot during hydration avoids a mismatch).
  const today = useSyncExternalStore(subscribeNoop, todayISODate, () => serverToday);
  const entryDateSet = useMemo(() => new Set(entryDates), [entryDates]);
  // Params from a navigation that hasn't landed yet, so two quick changes
  // (e.g. mood then a date) build on each other instead of the stale URL.
  const pendingParams = useRef<URLSearchParams | null>(null);

  useEffect(() => {
    if (!isPending) pendingParams.current = null;
  }, [isPending]);

  function navigate(patch: Record<string, string | null>, mode: "push" | "replace" = "push") {
    const params = new URLSearchParams(pendingParams.current ?? window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    pendingParams.current = params;
    const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      if (mode === "replace") router.replace(href);
      else router.push(href);
    });
  }

  // The server may be in a different timezone than the browser; when the user
  // opens the journal without picking a date, land on *their* today.
  useEffect(() => {
    if (!explicitDate && today !== serverToday) {
      const params = new URLSearchParams(window.location.search);
      params.set("date", today);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [explicitDate, today, serverToday, pathname, router]);

  function handleFilterChange(patch: Partial<JournalFilterState>) {
    navigate({
      ...(patch.q !== undefined && { q: patch.q || null }),
      ...(patch.mood !== undefined && { mood: patch.mood || null }),
      ...(patch.from !== undefined && { from: patch.from || null }),
      ...(patch.to !== undefined && { to: patch.to || null }),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      {/* Editor first in the DOM order on small screens: writing is the point. */}
      <div className="order-1 min-w-0 lg:order-2" aria-busy={isPending}>
        <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <JournalEditor key={selectedDate} date={selectedDate} entry={entry} isToday={selectedDate === today} />
        </div>
      </div>

      <aside className="order-2 flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:order-1">
        <JournalCalendar
          key={selectedDate}
          selectedDate={selectedDate}
          today={today}
          entryDates={entryDateSet}
          onSelect={(date) => navigate({ date })}
        />
        {selectedDate !== today && (
          <button
            type="button"
            onClick={() => navigate({ date: today })}
            className="rounded-lg border border-line3 px-3 py-2 text-[12.5px] font-semibold text-t3 hover:border-line5 hover:text-foreground"
          >
            Jump to today
          </button>
        )}
        <JournalHistory
          items={items}
          filters={filters}
          selectedDate={selectedDate}
          onSelect={(date) => navigate({ date })}
          onFilterChange={handleFilterChange}
        />
      </aside>
    </div>
  );
}
