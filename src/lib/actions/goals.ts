"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import type { GoalStatus } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

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
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/goals/${id}`);
}

export async function createGoal(input: GoalInput) {
  const { supabase, user } = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const { data, error } = await supabase
    .from("goals")
    .insert({
      ...input,
      title,
      start_date: input.start_date || null,
      target_date: input.target_date || null,
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
  const { supabase, user } = await requireUser();

  let previousStatus: GoalStatus | null = null;
  if (input.status) {
    const { data: existing } = await supabase
      .from("goals")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch = { ...input };
  if (typeof patch.title === "string") {
    const title = patch.title.trim();
    if (!title) throw new Error("Title is required");
    patch.title = title;
  }
  if ("start_date" in input) patch.start_date = input.start_date || null;
  if ("target_date" in input) patch.target_date = input.target_date || null;
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

  if (input.status === "Completed" && previousStatus !== "Completed") {
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
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateGoalPaths();
}
