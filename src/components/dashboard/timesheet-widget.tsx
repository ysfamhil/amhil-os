import Link from "next/link";
import { WidgetShell, WidgetAddButton } from "./widget-shell";
import type { DashboardData } from "@/lib/dashboard";

function hours(value: number) {
  return `${value.toFixed(1)}h`;
}

function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatEntryDate(date: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (date === today) return "Today";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TimesheetWidget({ data, onLogTime }: { data: DashboardData; onLogTime: () => void }) {
  const entries = data.time.recentEntries;

  return (
    <WidgetShell
      title="Timesheet"
      action={
        <div className="flex items-center gap-1">
          <Link href="/time" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-t6 hover:bg-surface2 hover:text-t3">
            View all
          </Link>
          <WidgetAddButton onClick={onLogTime} label="Log" domain="time" />
        </div>
      }
      domain="time"
      className="h-full"
      bodyClassName="flex flex-col"
    >
      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-line px-[16px] py-[13px]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--domain-time)" }}>
            Today
          </p>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums tracking-[-0.02em]">{hours(data.time.todayHours)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--domain-time)" }}>
            This week
          </p>
          <p className="mt-1 text-[22px] font-extrabold tabular-nums tracking-[-0.02em]">{hours(data.time.weekHours)}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-[16px] py-4">
          <p className="text-[12.5px] text-t6">No time logged this week.</p>
          <button type="button" onClick={onLogTime} className="text-[12px] font-bold" style={{ color: "var(--domain-time)" }}>
            + Log time
          </button>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 border-b border-line2 px-[16px] py-[10px] last:border-b-0 hover:bg-surface2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px]">{entry.label}</p>
                <p className="font-mono text-[10px] text-t7">
                  {entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime}` : formatEntryDate(entry.date)}
                  {entry.category && ` · ${entry.category}`}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11.5px] font-semibold text-t3">{durationLabel(entry.durationMinutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
