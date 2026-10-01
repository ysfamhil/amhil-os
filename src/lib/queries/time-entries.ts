import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthISODate, startOfWeekISODate, todayISODate } from "@/lib/dates";
import type { Database, TimeEntry } from "@/types/database";

export type TimeEntryWithRelations = TimeEntry & {
  tasks: { id: string; title: string } | null;
};

export interface TimeEntryFilters {
  date?: string;
  category?: string;
}

export async function getTimeEntries(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters: TimeEntryFilters
): Promise<TimeEntryWithRelations[]> {
  let query = supabase.from("time_entries").select("*, tasks(id,title)").eq("user_id", userId);

  if (filters.date) query = query.eq("date", filters.date);
  if (filters.category) query = query.eq("category", filters.category);

  query = query.order("date", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TimeEntryWithRelations[];
}

export interface TimeStats {
  totalHours: number;
  todayHours: number;
  weekHours: number;
  monthHours: number;
  totalMinutes: number;
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  byCategory: { category: string; hours: number; minutes: number }[];
}

export async function getTimeStats(supabase: SupabaseClient<Database>, userId: string): Promise<TimeStats> {
  const today = todayISODate();
  const weekStart = startOfWeekISODate();
  const monthStart = startOfMonthISODate();

  const { data, error } = await supabase
    .from("time_entries")
    .select("date,duration_minutes,category")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  const entries = (data ?? []) as { date: string; duration_minutes: number; category: string | null }[];

  const sumMinutes = (rows: typeof entries) => rows.reduce((t, r) => t + r.duration_minutes, 0);

  const categoryMap = new Map<string, number>();
  for (const entry of entries) {
    const cat = entry.category || "Uncategorized";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + entry.duration_minutes);
  }

  const totalMinutes = sumMinutes(entries);
  const todayMinutes = sumMinutes(entries.filter((e) => e.date === today));
  const weekMinutes = sumMinutes(entries.filter((e) => e.date >= weekStart));
  const monthMinutes = sumMinutes(entries.filter((e) => e.date >= monthStart));

  return {
    totalHours: totalMinutes / 60,
    todayHours: todayMinutes / 60,
    weekHours: weekMinutes / 60,
    monthHours: monthMinutes / 60,
    totalMinutes,
    todayMinutes,
    weekMinutes,
    monthMinutes,
    byCategory: [...categoryMap.entries()]
      .map(([category, minutes]) => ({ category, hours: minutes / 60, minutes }))
      .sort((a, b) => b.minutes - a.minutes),
  };
}
