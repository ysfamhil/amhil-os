"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { logTimelineEvent } from "@/lib/timeline";
import { GOAL_FIELDS, assertUuid, assertUuidList, pickWritable } from "@/lib/write-fields";
import type { GoalStatus } from "@/types/database";

export interface GoalInput {
  title: string;
  description?: string | null;
  category?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  status?: GoalStatus;
  progress?: number;
}

function revalidateGoalPaths(id?: string) {
  revalidatePath("/app/goals");
  revalidatePath("/app/dashboard");
  if (id) revalidatePath(`/app/goals/${id}`);
}

/** Persists a manual drag-reorder from the dashboard's Goals widget. */
export async function reorderGoals(orderedIds: string[]) {
  const { supabase, user } = await requireApprovedSession();
  assertUuidList(orderedIds, "Goal");

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("goals").update({ position: index }).eq("id", id).eq("user_id", user.id)
    )
  );

  revalidatePath("/app/dashboard");
}

export async function createGoal(input: GoalInput) {
  const { supabase, user } = await requireApprovedSession();
  // `position` (set only by reorderGoals), `id`, timestamps and `user_id` can never come from the client.
  const fields = pickWritable(GOAL_FIELDS, input);
  const title = typeof fields.title === "string" ? fields.title.trim() : "";
  if (!title) throw new Error("Title is required");

  const { data, error } = await supabase
    .from("goals")
    .insert({
      ...fields,
      title,
      start_date: fields.start_date || null,
      target_date: fields.target_date || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "goal_created",
    title: `New goal: "${title}"`,
    relatedEntityType: "goal",
    relatedEntityId: data.id,
  });

  revalidateGoalPaths(data?.id);
  return data;
}

export async function updateGoal(id: string, input: Partial<GoalInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Goal");
  const fields = pickWritable(GOAL_FIELDS, input);

  let previousStatus: GoalStatus | null = null;
  if (fields.status) {
    const { data: existing } = await supabase
      .from("goals")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch = { ...fields };
  if (typeof patch.title === "string") {
    const title = patch.title.trim();
    if (!title) throw new Error("Title is required");
    patch.title = title;
  }
  if ("start_date" in fields) patch.start_date = fields.start_date || null;
  if ("target_date" in fields) patch.target_date = fields.target_date || null;
  if (patch.progress != null && (patch.progress < 0 || patch.progress > 100)) {
    throw new Error("Progress must be between 0 and 100");
  }

  const { data, error } = await supabase
    .from("goals")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("title")
    .single();

  if (error) throw new Error(error.message);

  if (fields.status === "Completed" && previousStatus !== "Completed") {
    await logTimelineEvent(supabase, user.id, {
      eventType: "goal_completed",
      title: `Completed goal: "${data.title}"`,
      relatedEntityType: "goal",
      relatedEntityId: id,
    });
  }

  revalidateGoalPaths(id);
}

export async function deleteGoal(id: string) {
  const { supabase, user } = await requireApprovedSession();

  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateGoalPaths();
}
