import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISODate } from "@/lib/dates";
import type { Database, Habit } from "@/types/database";

/**
 * Streaks and consistency are computed uniformly from completion *dates*
 * regardless of a habit's frequency (daily or weekly) — a streak is "how
 * many days in a row", full stop. This keeps the calculation single-pathed
 * instead of branching into a daily-vs-weekly scheduling engine, which the
 * spec explicitly asks to avoid. `frequency`/`target` still drive validation
 * and are available for a future, more elaborate scheduler if ever needed.
 */
export function computeStreaks(sortedDatesDesc: string[]): { current: number; best: number } {
  if (sortedDatesDesc.length === 0) return { current: 0, best: 0 };

  const dates = [...new Set(sortedDatesDesc)].sort().reverse();
  const dayMs = 24 * 60 * 60 * 1000;
  const toDay = (d: string) => Date.parse(`${d}T00:00:00Z`) / dayMs;

  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    if (toDay(dates[i - 1]) - toDay(dates[i]) === 1) {
      run += 1;
    } else {
      best = Math.max(best, run);
      run = 1;
    }
  }
  best = Math.max(best, run);

  const today = toDay(todayISODate());
  const mostRecent = toDay(dates[0]);
  let current = 0;
  if (mostRecent === today || mostRecent === today - 1) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      if (toDay(dates[i - 1]) - toDay(dates[i]) === 1) current += 1;
      else break;
    }
  }

  return { current, best };
}

export function consistency(dates: Set<string>, windowStartISO: string, windowEndISO: string): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = Date.parse(`${windowStartISO}T00:00:00Z`);
  const end = Date.parse(`${windowEndISO}T00:00:00Z`);
  const totalDays = Math.floor((end - start) / dayMs) + 1;
  if (totalDays <= 0) return 0;

  let completed = 0;
  for (const d of dates) {
    const t = Date.parse(`${d}T00:00:00Z`);
    if (t >= start && t <= end) completed += 1;
  }
  return Math.round((completed / totalDays) * 100);
}

export interface HabitWithStats extends Habit {
  completedToday: boolean;
  currentStreak: number;
  bestStreak: number;
  weeklyConsistency: number;
  monthlyConsistency: number;
  yearlyConsistency: number;
  completionRate: number;
}

export async function getHabits(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts?: { activeOnly?: boolean }
): Promise<HabitWithStats[]> {
  let query = supabase.from("habits").select("*").eq("user_id", userId);
  if (opts?.activeOnly) query = query.eq("is_active", true);
  query = query.order("created_at", { ascending: true });

  const { data: habits, error } = await query;
  if (error) throw new Error(error.message);
  if (!habits || habits.length === 0) return [];

  const habitIds = habits.map((h) => h.id);
  const { data: completions } = await supabase
    .from("habit_completions")
    .select("habit_id,date,is_completed")
    .eq("user_id", userId)
    .eq("is_completed", true)
    .in("habit_id", habitIds);

  const completionList = (completions ?? []) as { habit_id: string; date: string; is_completed: boolean }[];

  const today = todayISODate();
  const d = new Date();
  const yearStart = `${d.getFullYear()}-01-01`;
  const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const weekAgo = new Date(d.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return habits.map((habit) => {
    const dates = completionList.filter((c) => c.habit_id === habit.id).map((c) => c.date);
    const dateSet = new Set(dates);
    const { current, best } = computeStreaks(dates);

    const createdDate = habit.created_at.slice(0, 10);
    const completionRateStart = createdDate > yearStart ? createdDate : yearStart;

    return {
      ...habit,
      completedToday: dateSet.has(today),
      currentStreak: current,
      bestStreak: best,
      weeklyConsistency: consistency(dateSet, weekAgo, today),
      monthlyConsistency: consistency(dateSet, monthStart, today),
      yearlyConsistency: consistency(dateSet, yearStart, today),
      completionRate: consistency(dateSet, completionRateStart, today),
    };
  });
}
