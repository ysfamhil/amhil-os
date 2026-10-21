"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { buildMonthGrid } from "@/lib/journal";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function JournalCalendar({
  selectedDate,
  today,
  entryDates,
  onSelect,
}: {
  selectedDate: string;
  today: string;
  entryDates: Set<string>;
  onSelect: (date: string) => void;
}) {
  const [selectedYear, selectedMonth] = selectedDate.split("-").map(Number);
  const [view, setView] = useState({ year: selectedYear, month: selectedMonth - 1 });

  const cells = buildMonthGrid(view.year, view.month);
  const label = new Date(view.year, view.month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const isCurrentMonth = view.year === todayYear && view.month === todayMonth - 1;

  function shiftMonth(delta: number) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-t5 hover:bg-surface2 hover:text-foreground"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-bold">{label}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={isCurrentMonth}
          aria-label="Next month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-t5 hover:bg-surface2 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day, i) => (
          <span key={i} className="pb-1 font-mono text-[10px] text-t7">
            {day}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const hasEntry = entryDates.has(date);
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const isFuture = date > today;
          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(date)}
              aria-label={`${date}${hasEntry ? ", has entry" : ""}`}
              aria-current={isSelected ? "date" : undefined}
              className={clsx(
                "relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12px] transition-colors",
                isFuture && "cursor-not-allowed text-t8",
                !isFuture && !isSelected && "text-t3 hover:bg-surface2",
                isSelected && "font-bold text-white",
                isToday && !isSelected && "ring-1 ring-[var(--domain-journal)]"
              )}
              style={isSelected ? { backgroundColor: "var(--domain-journal)" } : undefined}
            >
              {Number(date.slice(8))}
              {hasEntry && (
                <span
                  className="absolute bottom-[3px] h-[4px] w-[4px] rounded-full"
                  style={{ backgroundColor: isSelected ? "#fff" : "var(--domain-journal)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
