"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { logTimelineEvent } from "@/lib/timeline";
import { RELATIONS, TIME_ENTRY_FIELDS, assertOwnedRelations, assertUuid, pickWritable } from "@/lib/write-fields";

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
  revalidatePath("/app/time");
  revalidatePath("/app/dashboard");
}

export async function createTimeEntry(input: TimeEntryInput) {
  const { supabase, user } = await requireApprovedSession();
  const fields = pickWritable(TIME_ENTRY_FIELDS, input);
  if (typeof fields.duration_minutes !== "number" || fields.duration_minutes <= 0) throw new Error("Duration must be positive");
  const durationMinutes = fields.duration_minutes;
  await assertOwnedRelations(supabase, user.id, RELATIONS.time_entries, fields);

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      ...fields,
      duration_minutes: durationMinutes,
      project_id: fields.project_id || null,
      task_id: fields.task_id || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  let projectLabel = "";
  if (fields.project_id) {
    const { data: project } = await supabase.from("projects").select("name").eq("id", fields.project_id).eq("user_id", user.id).single();
    if (project) projectLabel = ` — ${project.name}`;
  }
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  await logTimelineEvent(supabase, user.id, {
    eventType: "time_entry_created",
    title: `Logged ${durationLabel}${projectLabel}`,
    relatedEntityType: "time_entry",
    relatedEntityId: data.id,
    projectId: fields.project_id || null,
    occurredAt: fields.date ? new Date(fields.date).toISOString() : undefined,
    metadata: { duration_minutes: durationMinutes },
  });

  revalidateTimePaths();
}

export async function updateTimeEntry(id: string, input: Partial<TimeEntryInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Time entry");
  const fields = pickWritable(TIME_ENTRY_FIELDS, input);
  if (fields.duration_minutes != null && fields.duration_minutes <= 0) {
    throw new Error("Duration must be positive");
  }
  await assertOwnedRelations(supabase, user.id, RELATIONS.time_entries, fields);

  const patch = { ...fields };
  if ("project_id" in fields) patch.project_id = fields.project_id || null;
  if ("task_id" in fields) patch.task_id = fields.task_id || null;

  const { error } = await supabase.from("time_entries").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export async function deleteTimeEntry(id: string) {
  const { supabase, user } = await requireApprovedSession();
  const { error } = await supabase.from("time_entries").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}
