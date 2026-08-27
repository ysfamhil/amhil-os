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

  const [
    tasksRes,
    projectsRes,
    goalsRes,
    topicsRes,
    areasRes,
    habitsRes,
    clientsRes,
    leadsRes,
    notesRes,
    timelineRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority")
      .eq("user_id", user.id)
      .ilike("title", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("projects")
      .select("id,name,status")
      .eq("user_id", user.id)
      .ilike("name", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("goals")
      .select("id,title,status")
      .eq("user_id", user.id)
      .ilike("title", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("learning_topics")
      .select("id,name,status,area_id,learning_areas(name)")
      .eq("user_id", user.id)
      .ilike("name", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("learning_areas")
      .select("id,name")
      .eq("user_id", user.id)
      .ilike("name", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("habits")
      .select("id,name,frequency,is_active")
      .eq("user_id", user.id)
      .ilike("name", like)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("clients")
      .select("id,name,company,status")
      .eq("user_id", user.id)
      .or(`name.ilike.${orLike},company.ilike.${orLike}`)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("leads")
      .select("id,name,company,status")
      .eq("user_id", user.id)
      .or(`name.ilike.${orLike},company.ilike.${orLike}`)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("notes")
      .select("id,title,content")
      .eq("user_id", user.id)
      .or(`title.ilike.${orLike},content.ilike.${orLike}`)
      .limit(RESULTS_PER_CATEGORY),
    supabase
      .from("timeline_events")
      .select("id,title,event_type,occurred_at")
      .eq("user_id", user.id)
      .ilike("title", like)
      .order("occurred_at", { ascending: false })
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

  const projects = projectsRes.data ?? [];
  if (projects.length) {
    groups.push({
      category: "Projects",
      results: projects.map((p) => ({ id: p.id, title: p.name, meta: p.status, href: `/projects/${p.id}` })),
    });
  }

  const goals = goalsRes.data ?? [];
  if (goals.length) {
    groups.push({
      category: "Goals",
      results: goals.map((g) => ({ id: g.id, title: g.title, meta: g.status, href: `/goals/${g.id}` })),
    });
  }

  const topics = (topicsRes.data ?? []) as unknown as {
    id: string;
    name: string;
    status: string;
    area_id: string;
    learning_areas: { name: string } | null;
  }[];
  if (topics.length) {
    groups.push({
      category: "Learning Topics",
      results: topics.map((t) => ({
        id: t.id,
        title: t.name,
        subtitle: t.learning_areas?.name,
        meta: t.status,
        href: `/learning/${t.area_id}/topics/${t.id}`,
      })),
    });
  }

  const areas = areasRes.data ?? [];
  if (areas.length) {
    groups.push({
      category: "Learning Areas",
      results: areas.map((a) => ({ id: a.id, title: a.name, href: `/learning/${a.id}` })),
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

  const clients = clientsRes.data ?? [];
  if (clients.length) {
    groups.push({
      category: "Clients",
      results: clients.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.company ?? undefined,
        meta: c.status,
        href: `/clients/${c.id}`,
      })),
    });
  }

  const leads = leadsRes.data ?? [];
  if (leads.length) {
    groups.push({
      category: "Leads",
      results: leads.map((l) => ({
        id: l.id,
        title: l.name,
        subtitle: l.company ?? undefined,
        meta: l.status,
        href: "/leads",
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

  const timelineEvents = timelineRes.data ?? [];
  if (timelineEvents.length) {
    groups.push({
      category: "Timeline",
      results: timelineEvents.map((e) => ({
        id: e.id,
        title: e.title,
        meta: new Date(e.occurred_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        href: "/timeline",
      })),
    });
  }

  return groups;
}
