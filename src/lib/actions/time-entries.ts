"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface TimeEntryInput {
  project_id?: string | null;
  task_id?: string | null;
  category?: string | null;
  date?: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes: number;
  description?: string | null;
}

function revalidateTimePaths() {
  revalidatePath("/time");
  revalidatePath("/dashboard");
}

export async function createTimeEntry(input: TimeEntryInput) {
  const { supabase, user } = await requireUser();
  if (input.duration_minutes <= 0) throw new Error("Duration must be positive");

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      ...input,
      project_id: input.project_id || null,
      task_id: input.task_id || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  let projectLabel = "";
  if (input.project_id) {
    const { data: project } = await supabase.from("projects").select("name").eq("id", input.project_id).eq("user_id", user.id).single();
    if (project) projectLabel = ` — ${project.name}`;
  }
  const hours = Math.floor(input.duration_minutes / 60);
  const minutes = input.duration_minutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  await logTimelineEvent(supabase, user.id, {
    eventType: "time_entry_created",
    title: `Logged ${durationLabel}${projectLabel}`,
    relatedEntityType: "time_entry",
    relatedEntityId: data.id,
    projectId: input.project_id ?? null,
    occurredAt: input.date ? new Date(input.date).toISOString() : undefined,
    metadata: { duration_minutes: input.duration_minutes },
  });

  revalidateTimePaths();
}

export async function updateTimeEntry(id: string, input: Partial<TimeEntryInput>) {
  const { supabase, user } = await requireUser();
  if (input.duration_minutes != null && input.duration_minutes <= 0) {
    throw new Error("Duration must be positive");
  }

  const patch = { ...input };
  if ("project_id" in input) patch.project_id = input.project_id || null;
  if ("task_id" in input) patch.task_id = input.task_id || null;

  const { error } = await supabase.from("time_entries").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export async function deleteTimeEntry(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("time_entries").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}
