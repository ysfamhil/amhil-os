import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, JournalEntry, JournalMood } from "@/types/database";
import { escapeForOrFilter } from "@/lib/postgrest";
import { computeStreak, countRecentEntries, makeSnippet } from "@/lib/journal";

export interface JournalListItem {
  id: string;
  entry_date: string;
  title: string | null;
  mood: JournalMood | null;
  snippet: string;
}

export interface JournalFilters {
  q?: string;
  mood?: JournalMood;
  from?: string;
  to?: string;
}

const LIST_LIMIT = 200;

export async function getJournalEntry(
  supabase: SupabaseClient<Database>,
  userId: string,
  date: string
): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Newest first. Bodies are trimmed to a one-line snippet before they reach the client. */
export async function getJournalList(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters: JournalFilters = {}
): Promise<JournalListItem[]> {
  let query = supabase
    .from("journal_entries")
    .select("id,entry_date,title,mood,story")
    .eq("user_id", userId);

  if (filters.mood) query = query.eq("mood", filters.mood);
  if (filters.from) query = query.gte("entry_date", filters.from);
  if (filters.to) query = query.lte("entry_date", filters.to);
  if (filters.q) {
    const like = escapeForOrFilter(`%${filters.q}%`);
    query = query.or(
      ["title", "story", "highlights", "challenges", "lessons", "tomorrow_focus"]
        .map((column) => `${column}.ilike.${like}`)
        .join(",")
    );
  }

  const { data, error } = await query.order("entry_date", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    entry_date: row.entry_date,
    title: row.title,
    mood: row.mood,
    snippet: makeSnippet(row.story),
  }));
}

/** Every date the user has an entry for — drives the calendar dots and the streak. */
export async function getJournalDates(supabase: SupabaseClient<Database>, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.entry_date);
}

export interface JournalSummary {
  today: string;
  hasToday: boolean;
  todayTitle: string | null;
  streak: number;
  last30: number;
  recent: { entry_date: string; title: string | null }[];
}

export async function getJournalSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string
): Promise<JournalSummary> {
  const [dates, recentRes] = await Promise.all([
    getJournalDates(supabase, userId),
    supabase
      .from("journal_entries")
      .select("entry_date,title")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .limit(3),
  ]);
  if (recentRes.error) throw new Error(recentRes.error.message);

  const recent = recentRes.data ?? [];
  const todayEntry = recent.find((entry) => entry.entry_date === today) ?? null;

  return {
    today,
    hasToday: dates.includes(today),
    todayTitle: todayEntry?.title ?? null,
    streak: computeStreak(dates, today),
    last30: countRecentEntries(dates, today, 30),
    recent,
  };
}
