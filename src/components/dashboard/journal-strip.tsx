import Link from "next/link";
import { BookOpen, Check } from "lucide-react";
import { formatShortDate } from "@/lib/journal";
import type { JournalSummary } from "@/lib/queries/journal";

/** Slim row under the quick actions: today's entry status, consistency, and recent entries. */
export function JournalStrip({ summary }: { summary: JournalSummary }) {
  const { hasToday, streak, last30, recent, today } = summary;
  const recentOther = recent.filter((entry) => entry.entry_date !== today).slice(0, 2);

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-[18px] border border-line bg-surface px-[16px] py-[10px] shadow-card"
      style={{ boxShadow: "inset 0 3px 0 0 var(--domain-journal)" }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "color-mix(in srgb, var(--domain-journal) 16%, transparent)",
            color: "var(--domain-journal)",
          }}
        >
          {hasToday ? <Check size={15} strokeWidth={2.5} /> : <BookOpen size={15} />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight">Today&apos;s journal</p>
          <p className="truncate text-[11.5px] text-t6">
            {hasToday ? (summary.todayTitle ? `Written · ${summary.todayTitle}` : "Written") : "Not written yet"}
          </p>
        </div>
      </div>

      <p className="font-mono text-[11px] text-t6">
        {streak > 0 ? `${streak}-day streak` : "No streak yet"} · {last30}/30 days
      </p>

      {recentOther.length > 0 && (
        <ul className="hidden min-w-0 items-center gap-3 md:flex">
          {recentOther.map((entry) => (
            <li key={entry.entry_date} className="min-w-0">
              <Link
                href={`/journal?date=${entry.entry_date}`}
                className="flex min-w-0 items-baseline gap-1.5 text-[12px] text-t4 hover:text-foreground"
              >
                <span className="shrink-0 font-mono text-[10.5px] text-t7">{formatShortDate(entry.entry_date)}</span>
                <span className="max-w-[160px] truncate">{entry.title || "Untitled"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/journal?date=${today}`}
        className="ml-auto rounded-lg px-3 py-[6px] text-[12px] font-bold text-white hover:opacity-90"
        style={{ backgroundColor: "var(--domain-journal)" }}
      >
        {hasToday ? "Open today's entry" : "Write today's entry"}
      </Link>
    </div>
  );
}
