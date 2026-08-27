"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import type { Task, TaskPriority, TaskStatus } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
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
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createTask(input: TaskInput) {
  const { supabase, user } = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      title,
      due_date: input.due_date || null,
      project_id: input.project_id || null,
      goal_id: input.goal_id || null,
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
    projectId: input.project_id ?? null,
  });

  revalidateTaskPaths(input.project_id);
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  const { supabase, user } = await requireUser();

  let previousStatus: TaskStatus | null = null;
  if (input.status) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch: Partial<Task> = { ...input };
  if (typeof patch.title === "string") {
    const title = patch.title.trim();
    if (!title) throw new Error("Title is required");
    patch.title = title;
  }
  if ("due_date" in input) patch.due_date = input.due_date || null;
  if ("project_id" in input) patch.project_id = input.project_id || null;
  if ("goal_id" in input) patch.goal_id = input.goal_id || null;
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

  if (input.status === "Done" && previousStatus !== "Done") {
    await logTimelineEvent(supabase, user.id, {
      eventType: "task_completed",
      title: `Completed "${data.title}"`,
      relatedEntityType: "task",
      relatedEntityId: id,
      projectId: data.project_id,
    });
  }

  revalidateTaskPaths(data?.project_id ?? input.project_id);
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  return updateTask(id, { status });
}

export async function deleteTask(id: string) {
  const { supabase, user } = await requireUser();

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
