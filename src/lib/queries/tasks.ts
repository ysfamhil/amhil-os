import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Task, TaskPriority } from "@/types/database";
import { todayISODate } from "@/lib/dates";

export type TaskTab = "today" | "upcoming" | "overdue" | "completed" | "all";

export interface TaskFilters {
  tab: TaskTab;
  q?: string;
  priorities?: TaskPriority[];
  tags?: string[];
  sort?: "due_date" | "created_at" | "priority";
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export async function getTasks(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters: TaskFilters
): Promise<Task[]> {
  let query = supabase.from("tasks").select("*").eq("user_id", userId);

  const today = todayISODate();
  switch (filters.tab) {
    case "today":
      query = query.eq("due_date", today).not("status", "in", "(Done,Cancelled)");
      break;
    case "upcoming":
      query = query.gt("due_date", today).not("status", "in", "(Done,Cancelled)");
      break;
    case "overdue":
      query = query.lt("due_date", today).not("status", "in", "(Done,Cancelled)");
      break;
    case "completed":
      query = query.eq("status", "Done");
      break;
    case "all":
    default:
      break;
  }

  if (filters.priorities && filters.priorities.length > 0) query = query.in("priority", filters.priorities);
  if (filters.tags && filters.tags.length > 0) query = query.in("category", filters.tags);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);

  query = query.order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const tasks = (data ?? []) as Task[];

  if (filters.sort === "priority") {
    return [...tasks].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  }
  if (filters.sort === "created_at") {
    return [...tasks].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  return tasks;
}

export interface TaskTabCounts {
  today: number;
  upcoming: number;
  overdue: number;
  completed: number;
  all: number;
}

export async function getTaskTabCounts(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<TaskTabCounts> {
  const today = todayISODate();

  const [todayRes, upcomingRes, overdueRes, completedRes, allRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("due_date", today)
      .not("status", "in", "(Done,Cancelled)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("due_date", today)
      .not("status", "in", "(Done,Cancelled)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lt("due_date", today)
      .not("status", "in", "(Done,Cancelled)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Done"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  return {
    today: todayRes.count ?? 0,
    upcoming: upcomingRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
    completed: completedRes.count ?? 0,
    all: allRes.count ?? 0,
  };
}

export interface SubtaskProgress {
  completed: number;
  total: number;
}

export async function getSubtaskProgressMap(
  supabase: SupabaseClient<Database>,
  userId: string,
  taskIds: string[]
): Promise<Record<string, SubtaskProgress>> {
  if (taskIds.length === 0) return {};

  const { data, error } = await supabase
    .from("subtasks")
    .select("task_id, is_completed")
    .eq("user_id", userId)
    .in("task_id", taskIds);

  if (error) throw new Error(error.message);

  const map: Record<string, SubtaskProgress> = {};
  for (const row of data ?? []) {
    const entry = map[row.task_id] ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (row.is_completed) entry.completed += 1;
    map[row.task_id] = entry;
  }
  return map;
}

/** Minutes logged per task, for the row's "◷ 3h 40m" meta line. */
export async function getTaskTimeLoggedMap(
  supabase: SupabaseClient<Database>,
  userId: string,
  taskIds: string[]
): Promise<Record<string, number>> {
  if (taskIds.length === 0) return {};

  const { data, error } = await supabase
    .from("time_entries")
    .select("task_id, duration_minutes")
    .eq("user_id", userId)
    .in("task_id", taskIds);

  if (error) throw new Error(error.message);

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.task_id) continue;
    map[row.task_id] = (map[row.task_id] ?? 0) + row.duration_minutes;
  }
  return map;
}

/** Distinct tag values in use, for the tag filter menu. */
export async function getDistinctTags(supabase: SupabaseClient<Database>, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("category")
    .eq("user_id", userId)
    .not("category", "is", null);

  if (error) throw new Error(error.message);

  const tags = new Set((data ?? []).map((row) => row.category).filter((c): c is string => Boolean(c)));
  return [...tags].sort();
}
