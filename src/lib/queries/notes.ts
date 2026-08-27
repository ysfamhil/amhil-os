import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Note } from "@/types/database";
import { escapeForOrFilter } from "@/lib/postgrest";

export type NoteWithRelations = Note & {
  projects: { id: string; name: string } | null;
  clients: { id: string; name: string } | null;
  tasks: { id: string; title: string } | null;
  learning_topics: { id: string; name: string; area_id: string } | null;
  goals: { id: string; title: string } | null;
};

export interface NoteFilters {
  q?: string;
  projectId?: string;
  clientId?: string;
  taskId?: string;
  topicId?: string;
  goalId?: string;
}

export async function getNotes(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters: NoteFilters = {}
): Promise<NoteWithRelations[]> {
  let query = supabase
    .from("notes")
    .select("*, projects(id,name), clients(id,name), tasks(id,title), learning_topics(id,name,area_id), goals(id,title)")
    .eq("user_id", userId);

  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.taskId) query = query.eq("task_id", filters.taskId);
  if (filters.topicId) query = query.eq("learning_topic_id", filters.topicId);
  if (filters.goalId) query = query.eq("goal_id", filters.goalId);
  if (filters.q) {
    const like = escapeForOrFilter(`%${filters.q}%`);
    query = query.or(`title.ilike.${like},content.ilike.${like}`);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NoteWithRelations[];
}
