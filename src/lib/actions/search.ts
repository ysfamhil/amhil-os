"use server";

import { createClient } from "@/lib/supabase/server";
import { escapeForOrFilter } from "@/lib/postgrest";

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
}

export interface SearchResultGroup {
  category: string;
  results: SearchResultItem[];
}

const RESULTS_PER_CATEGORY = 5;

/**
 * Every branch below runs through the normal RLS-scoped Supabase client (the
 * same one every page/action already uses) — never the service-role key —
 * so a user can only ever see their own rows here, the same as everywhere
 * else in the app. At this app's single-user, personal-database scale, plain
 * ILIKE per table is simple and fast; a trigram/full-text index would be the
 * natural next step if the data ever grew large enough for it to matter.
 */
export async function searchAll(rawQuery: string): Promise<SearchResultGroup[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const like = `%${query}%`;
  const orLike = escapeForOrFilter(`%${query}%`);

  const [tasksRes, goalsRes, habitsRes, notesRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority")
      .eq("user_id", user.id)
      .ilike("title", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("goals")
      .select("id,title,status")
      .eq("user_id", user.id)
      .ilike("title", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("habits")
      .select("id,name,frequency,is_active")
      .eq("user_id", user.id)
      .ilike("name", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("notes")
      .select("id,title,content")
      .eq("user_id", user.id)
      .or(`title.ilike.${orLike},content.ilike.${orLike}`)
      .limit(RESULTS_PER_CATEGORY),
  ]);

  const groups: SearchResultGroup[] = [];

  const tasks = tasksRes.data ?? [];
  if (tasks.length) {
    groups.push({
      category: "Tasks",
      results: tasks.map((t) => ({ id: t.id, title: t.title, subtitle: t.priority, meta: t.status, href: "/tasks" })),
    });
  }

  const goals = goalsRes.data ?? [];
  if (goals.length) {
    groups.push({
      category: "Goals",
      results: goals.map((g) => ({ id: g.id, title: g.title, meta: g.status, href: `/goals/${g.id}` })),
    });
  }

  const habits = habitsRes.data ?? [];
  if (habits.length) {
    groups.push({
      category: "Habits",
      results: habits.map((h) => ({
        id: h.id,
        title: h.name,
        subtitle: h.frequency,
        meta: h.is_active ? undefined : "Archived",
        href: "/habits",
      })),
    });
  }

  const notes = notesRes.data ?? [];
  if (notes.length) {
    groups.push({
      category: "Notes",
      results: notes.map((n) => ({
        id: n.id,
        title: n.title,
        subtitle: n.content ? n.content.slice(0, 60) : undefined,
        href: "/notes",
      })),
    });
  }

  return groups;
}
