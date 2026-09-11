"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Flame } from "lucide-react";
import { setHabitCompletion } from "@/lib/actions/habits";
import { WidgetShell, WidgetAddButton } from "./widget-shell";
import type { DashboardData } from "@/lib/dashboard";

const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

function DayDot({ habitId, date, completed, isToday }: { habitId: string; date: string; completed: boolean; isToday: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      await setHabitCompletion(habitId, date, !completed);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={completed ? "Mark not done" : "Mark done"}
      className={clsx(
        "h-[18px] w-[18px] shrink-0 rounded-full border transition-colors disabled:opacity-50",
        !completed && !isToday && "border-line4 hover:border-line5"
      )}
      style={
        completed
          ? { borderColor: "var(--domain-habits)", backgroundColor: "var(--domain-habits)" }
          : isToday
            ? { borderColor: "color-mix(in srgb, var(--domain-habits) 70%, transparent)" }
            : undefined
      }
    />
  );
}

export function HabitsWidget({ data, onAddHabit }: { data: DashboardData; onAddHabit: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const { weekDates, list } = data.habitsWeek;

  return (
    <WidgetShell
      title="Habits"
      meta={`${data.habitsToday.completed}/${data.habitsToday.total} today`}
      action={
        <div className="flex items-center gap-1">
          <Link href="/habits" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-t6 hover:bg-surface2 hover:text-t3">
            View all
          </Link>
          <WidgetAddButton onClick={onAddHabit} label="Habit" domain="habits" />
        </div>
      }
      domain="habits"
      className="h-full"
      bodyClassName="px-[16px] py-[13px]"
    >
      {list.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[12.5px] text-t6">No active habits yet.</p>
          <button type="button" onClick={onAddHabit} className="text-[12px] font-bold" style={{ color: "var(--domain-habits)" }}>
            + Add a habit
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 pl-[92px]">
            {weekDates.map((date, i) => (
              <span
                key={date}
                className={clsx("w-[18px] shrink-0 text-center font-mono text-[9.5px]", date !== today && "text-t7")}
                style={date === today ? { color: "var(--domain-habits)" } : undefined}
              >
                {DAY_INITIALS[i]}
              </span>
            ))}
          </div>
          {list.map((habit) => (
            <div key={habit.id} className="flex items-center gap-2">
              <p className="w-[84px] shrink-0 truncate text-[12px]">{habit.name}</p>
              <div className="flex flex-1 items-center gap-2">
                {weekDates.map((date) => (
                  <div key={date} className="flex w-[18px] shrink-0 justify-center">
                    <DayDot
                      habitId={habit.id}
                      date={date}
                      completed={habit.weekCompletions[date] ?? false}
                      isToday={date === today}
                    />
                  </div>
                ))}
              </div>
              <span className="flex shrink-0 items-center gap-0.5 font-mono text-[10.5px] text-t4">
                <Flame size={10} className={habit.currentStreak > 0 ? "text-amber" : "text-t7"} />
                {habit.currentStreak}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
