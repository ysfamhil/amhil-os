"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import { getNotes, type NoteFilters, type NoteWithRelations } from "@/lib/queries/notes";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface NoteInput {
  title: string;
  content?: string | null;
  tags?: string[];
  project_id?: string | null;
  client_id?: string | null;
  task_id?: string | null;
  learning_topic_id?: string | null;
  goal_id?: string | null;
}

function revalidateNotePaths() {
  revalidatePath("/notes");
  revalidatePath("/dashboard");
}

/**
 * A note's own RLS policy only checks that the note row itself belongs to
 * the caller — it says nothing about whether a project_id/task_id/etc. the
 * caller supplies actually belongs to them too. Without this check a user
 * could link a note to another user's project/task/client/topic/goal id (no
 * data leak, since RLS still hides that row everywhere else, but a real
 * relational-integrity gap). Verify every provided relation up front, the
 * same defense-in-depth pattern already used for subtasks/learning sessions.
 */
async function verifyRelationOwnership(supabase: SupabaseClient<Database>, userId: string, input: Partial<NoteInput>) {
  const checks: {
    field: "project_id" | "client_id" | "task_id" | "learning_topic_id" | "goal_id";
    table: "projects" | "clients" | "tasks" | "learning_topics" | "goals";
    label: string;
  }[] = [
    { field: "project_id", table: "projects", label: "Project" },
    { field: "client_id", table: "clients", label: "Client" },
    { field: "task_id", table: "tasks", label: "Task" },
    { field: "learning_topic_id", table: "learning_topics", label: "Learning topic" },
    { field: "goal_id", table: "goals", label: "Goal" },
  ];

  for (const { field, table, label } of checks) {
    const value = input[field];
    if (!value) continue;
    const { data } = await supabase.from(table).select("id").eq("id", value).eq("user_id", userId).single();
    if (!data) throw new Error(`${label} not found`);
  }
}

export async function createNote(input: NoteInput) {
  const { supabase, user } = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  await verifyRelationOwnership(supabase, user.id, input);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      title,
      content: input.content ?? null,
      tags: input.tags ?? [],
      project_id: input.project_id || null,
      client_id: input.client_id || null,
      task_id: input.task_id || null,
      learning_topic_id: input.learning_topic_id || null,
      goal_id: input.goal_id || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "note_created",
    title: `New note: "${title}"`,
    relatedEntityType: "note",
    relatedEntityId: data.id,
    projectId: input.project_id ?? null,
  });

  revalidateNotePaths();
  return data;
}

export async function updateNote(id: string, input: Partial<NoteInput>) {
  const { supabase, user } = await requireUser();

  await verifyRelationOwnership(supabase, user.id, input);

  const patch = { ...input };
  if (typeof patch.title === "string") {
    const title = patch.title.trim();
    if (!title) throw new Error("Title is required");
    patch.title = title;
  }
  if ("project_id" in input) patch.project_id = input.project_id || null;
  if ("client_id" in input) patch.client_id = input.client_id || null;
  if ("task_id" in input) patch.task_id = input.task_id || null;
  if ("learning_topic_id" in input) patch.learning_topic_id = input.learning_topic_id || null;
  if ("goal_id" in input) patch.goal_id = input.goal_id || null;

  const { error } = await supabase.from("notes").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateNotePaths();
}

export async function deleteNote(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateNotePaths();
}

/** Used by the small notes widget embedded on task/topic/goal/project/client
 * detail views — scoped to exactly one relation at a time. */
export async function getNotesForRelation(filters: NoteFilters): Promise<NoteWithRelations[]> {
  const { supabase, user } = await requireUser();
  return getNotes(supabase, user.id, filters);
}
