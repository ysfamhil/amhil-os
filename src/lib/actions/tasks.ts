"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { logTimelineEvent } from "@/lib/timeline";
import { RELATIONS, TASK_FIELDS, assertOwnedRelations, assertUuid, assertUuidList, pickWritable } from "@/lib/write-fields";
import type { Task, TaskPriority, TaskStatus } from "@/types/database";

export async function getTask(id: string): Promise<Task | null> {
  const { supabase, user } = await requireApprovedSession();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Persists a manual drag-reorder from the dashboard's Tasks widget. */
export async function reorderTasks(orderedIds: string[]) {
  const { supabase, user } = await requireApprovedSession();
  assertUuidList(orderedIds, "Task");

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("tasks").update({ position: index }).eq("id", id).eq("user_id", user.id)
    )
  );

  revalidatePath("/app/dashboard");
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  estimated_minutes?: number | null;
  project_id?: string | null;
  goal_id?: string | null;
  category?: string | null;
  notes?: string | null;
}

function revalidateTaskPaths(projectId?: string | null) {
  revalidatePath("/app/tasks");
  revalidatePath("/app/dashboard");
  if (projectId) revalidatePath(`/app/projects/${projectId}`);
}

export async function createTask(input: TaskInput) {
  const { supabase, user } = await requireApprovedSession();
  // Only allowlisted columns reach the database; user_id and every server-managed column
  // (id, timestamps, completed_at, position) can never come from the client.
  const fields = pickWritable(TASK_FIELDS, input);
  const title = typeof fields.title === "string" ? fields.title.trim() : "";
  if (!title) throw new Error("Title is required");
  await assertOwnedRelations(supabase, user.id, RELATIONS.tasks, fields);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...fields,
      title,
      due_date: fields.due_date || null,
      project_id: fields.project_id || null,
      goal_id: fields.goal_id || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "task_created",
    title: `Created "${title}"`,
    relatedEntityType: "task",
    relatedEntityId: data.id,
    projectId: fields.project_id || null,
  });

  revalidateTaskPaths(fields.project_id);
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Task");
  const fields = pickWritable(TASK_FIELDS, input);
  await assertOwnedRelations(supabase, user.id, RELATIONS.tasks, fields);

  let previousStatus: TaskStatus | null = null;
  if (fields.status) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch: Partial<Task> = { ...fields };
  if (typeof patch.title === "string") {
    const title = patch.title.trim();
    if (!title) throw new Error("Title is required");
    patch.title = title;
  }
  if ("due_date" in fields) patch.due_date = fields.due_date || null;
  if ("project_id" in fields) patch.project_id = fields.project_id || null;
  if ("goal_id" in fields) patch.goal_id = fields.goal_id || null;
  if (patch.status) {
    patch.completed_at = patch.status === "Done" ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("project_id,title")
    .single();

  if (error) throw new Error(error.message);

  if (fields.status === "Done" && previousStatus !== "Done") {
    await logTimelineEvent(supabase, user.id, {
      eventType: "task_completed",
      title: `Completed "${data.title}"`,
      relatedEntityType: "task",
      relatedEntityId: id,
      projectId: data.project_id,
    });
  }

  revalidateTaskPaths(data?.project_id ?? fields.project_id);
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  return updateTask(id, { status });
}

export async function deleteTask(id: string) {
  const { supabase, user } = await requireApprovedSession();

  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("project_id")
    .single();

  if (error) throw new Error(error.message);
  revalidateTaskPaths(data?.project_id);
}
