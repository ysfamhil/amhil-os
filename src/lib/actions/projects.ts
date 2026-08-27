"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import type { Project, ProjectStatus } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  start_date?: string | null;
  target_date?: string | null;
  goal_id?: string | null;
  client_id?: string | null;
  category?: string | null;
  budget?: number | null;
  estimated_hours?: number | null;
  notes?: string | null;
}

function revalidateProjectPaths(id?: string) {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/projects/${id}`);
}

export async function createProject(input: ProjectInput) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      ...input,
      name,
      start_date: input.start_date || null,
      target_date: input.target_date || null,
      goal_id: input.goal_id || null,
      client_id: input.client_id || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "project_created",
    title: `New project: "${name}"`,
    relatedEntityType: "project",
    relatedEntityId: data.id,
    projectId: data.id,
  });

  revalidateProjectPaths(data?.id);
  return data;
}

export async function updateProject(id: string, input: Partial<ProjectInput>) {
  const { supabase, user } = await requireUser();

  let previousStatus: ProjectStatus | null = null;
  if (input.status) {
    const { data: existing } = await supabase
      .from("projects")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch: Partial<Project> = { ...input };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if ("start_date" in input) patch.start_date = input.start_date || null;
  if ("target_date" in input) patch.target_date = input.target_date || null;
  if ("goal_id" in input) patch.goal_id = input.goal_id || null;
  if ("client_id" in input) patch.client_id = input.client_id || null;
  if (patch.status === "Completed") patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("name")
    .single();

  if (error) throw new Error(error.message);

  if (input.status && input.status !== previousStatus) {
    if (input.status === "Completed") {
      await logTimelineEvent(supabase, user.id, {
        eventType: "project_completed",
        title: `Completed project "${data.name}"`,
        relatedEntityType: "project",
        relatedEntityId: id,
        projectId: id,
      });
    } else {
      await logTimelineEvent(supabase, user.id, {
        eventType: "project_status_changed",
        title: `"${data.name}" moved to ${input.status}`,
        description: previousStatus ? `Status changed from ${previousStatus} to ${input.status}` : null,
        relatedEntityType: "project",
        relatedEntityId: id,
        projectId: id,
      });
    }
  }

  revalidateProjectPaths(id);
}

export async function archiveProject(id: string) {
  return updateProject(id, { status: "Archived" });
}

export async function deleteProject(id: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateProjectPaths();
}
