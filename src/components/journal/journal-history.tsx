"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import { JOURNAL_MOODS, formatShortDate, moodMeta } from "@/lib/journal";
import type { JournalListItem } from "@/lib/queries/journal";
import type { JournalMood } from "@/types/database";

export interface JournalFilterState {
  q: string;
  mood: JournalMood | "";
  from: string;
  to: string;
}

const CONTROL =
  "w-full rounded-lg border border-line bg-background px-2.5 py-[7px] text-[12.5px] outline-none focus:border-[var(--domain-journal)]";

export function JournalHistory({
  items,
  filters,
  selectedDate,
  onSelect,
  onFilterChange,
}: {
  items: JournalListItem[];
  filters: JournalFilterState;
  selectedDate: string;
  onSelect: (date: string) => void;
  onFilterChange: (patch: Partial<JournalFilterState>) => void;
}) {
  const hasFilters = Boolean(filters.q || filters.mood || filters.from || filters.to);
  const [search, setSearch] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(Boolean(filters.mood || filters.from || filters.to));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onFilterChange({ q: value }), 300);
  }

  function clearAll() {
    setSearch("");
    onFilterChange({ q: "", mood: "", from: "", to: "" });
  }

  return (
    <section className="flex min-h-0 flex-col gap-3" aria-label="Journal history">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search entries…"
          aria-label="Search journal entries"
          className={clsx(CONTROL, "flex-1")}
        />
        <button
          type="button"
          onClick={() => setShowFilters((open) => !open)}
          aria-expanded={showFilters}
          aria-label="Filters"
          className={clsx(
            "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border text-t4 hover:text-foreground",
            showFilters || filters.mood || filters.from || filters.to ? "border-[var(--domain-journal)]" : "border-line"
          )}
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-2 rounded-[12px] border border-line bg-surface p-3">
          <label className="col-span-2 flex flex-col gap-1 text-[11px] font-semibold text-t5">
            Mood
            <select
              value={filters.mood}
              onChange={(e) => onFilterChange({ mood: e.target.value as JournalMood | "" })}
              className={CONTROL}
            >
              <option value="">Any mood</option>
              {JOURNAL_MOODS.map((mood) => (
                <option key={mood.value} value={mood.value}>
                  {mood.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-t5">
            From
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => onFilterChange({ from: e.target.value })}
              className={CONTROL}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-t5">
            To
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => onFilterChange({ to: e.target.value })}
              className={CONTROL}
            />
          </label>
        </div>
      )}

      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[11px] text-t7">
          {items.length} {items.length === 1 ? "entry" : "entries"}
          {hasFilters ? " found" : ""}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-t5 hover:text-foreground"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-line3 px-4 py-8 text-center">
          <BookOpen size={20} className="text-t6" />
          <p className="text-[13px] font-semibold">{hasFilters ? "No matching entries" : "No entries yet"}</p>
          <p className="max-w-[220px] text-[12px] text-t6">
            {hasFilters
              ? "Try a different search or clear the filters."
              : "Your first entry will show up here as soon as you write it."}
          </p>
        </div>
      ) : (
        <ul className="scroll-thin -mr-1 flex max-h-[46vh] flex-col gap-1 overflow-y-auto pr-1">
          {items.map((item) => {
            const mood = moodMeta(item.mood);
            const active = item.entry_date === selectedDate;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.entry_date)}
                  aria-current={active ? "date" : undefined}
                  className={clsx(
                    "w-full rounded-[10px] border px-3 py-2 text-left transition-colors",
                    active ? "border-transparent" : "border-transparent hover:bg-surface2"
                  )}
                  style={
                    active
                      ? { backgroundColor: "color-mix(in srgb, var(--domain-journal) 14%, transparent)" }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-mono text-[10.5px] text-t6">{formatShortDate(item.entry_date)}</span>
                    {mood && (
                      <span
                        className="h-[6px] w-[6px] shrink-0 rounded-full"
                        style={{ backgroundColor: mood.color }}
                        title={mood.label}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {item.title || <span className="font-normal text-t6">Untitled</span>}
                    </span>
                  </div>
                  {item.snippet && <p className="mt-0.5 line-clamp-1 text-[11.5px] text-t6">{item.snippet}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
