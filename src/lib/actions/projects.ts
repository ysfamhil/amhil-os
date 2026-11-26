"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { logTimelineEvent } from "@/lib/timeline";
import { PROJECT_FIELDS, RELATIONS, assertOwnedRelations, assertUuid, pickWritable } from "@/lib/write-fields";
import type { Project, ProjectStatus } from "@/types/database";

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
  revalidatePath("/app/projects");
  revalidatePath("/app/dashboard");
  if (id) revalidatePath(`/app/projects/${id}`);
}

export async function createProject(input: ProjectInput) {
  const { supabase, user } = await requireApprovedSession();
  // completed_at is server-managed (set when status becomes Completed) and never accepted from the client.
  const fields = pickWritable(PROJECT_FIELDS, input);
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (!name) throw new Error("Name is required");
  await assertOwnedRelations(supabase, user.id, RELATIONS.projects, fields);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      ...fields,
      name,
      start_date: fields.start_date || null,
      target_date: fields.target_date || null,
      goal_id: fields.goal_id || null,
      client_id: fields.client_id || null,
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
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Project");
  const fields = pickWritable(PROJECT_FIELDS, input);
  await assertOwnedRelations(supabase, user.id, RELATIONS.projects, fields);

  let previousStatus: ProjectStatus | null = null;
  if (fields.status) {
    const { data: existing } = await supabase
      .from("projects")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch: Partial<Project> = { ...fields };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if ("start_date" in fields) patch.start_date = fields.start_date || null;
  if ("target_date" in fields) patch.target_date = fields.target_date || null;
  if ("goal_id" in fields) patch.goal_id = fields.goal_id || null;
  if ("client_id" in fields) patch.client_id = fields.client_id || null;
  if (patch.status === "Completed") patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("name")
    .single();

  if (error) throw new Error(error.message);

  if (fields.status && fields.status !== previousStatus) {
    if (fields.status === "Completed") {
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
        title: `"${data.name}" moved to ${fields.status}`,
        description: previousStatus ? `Status changed from ${previousStatus} to ${fields.status}` : null,
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
  const { supabase, user } = await requireApprovedSession();

  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateProjectPaths();
}
