"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import { computeStreaks } from "@/lib/queries/habits";
import type { HabitFrequency } from "@/types/database";

const HABIT_STREAK_MILESTONES = [7, 14, 30, 60, 100, 200, 365, 500, 1000];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface HabitInput {
  name: string;
  description?: string | null;
  frequency?: HabitFrequency;
  target?: number;
  goal_id?: string | null;
}

function revalidateHabitPaths() {
  revalidatePath("/habits");
  revalidatePath("/dashboard");
}

export async function createHabit(input: HabitInput) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (input.target != null && input.target < 1) throw new Error("Target must be at least 1");

  const { error } = await supabase.from("habits").insert({
    ...input,
    name,
    goal_id: input.goal_id || null,
    user_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidateHabitPaths();
}

export async function updateHabit(id: string, input: Partial<HabitInput>) {
  const { supabase, user } = await requireUser();
  const patch = { ...input };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if ("goal_id" in input) patch.goal_id = input.goal_id || null;
  if (patch.target != null && patch.target < 1) throw new Error("Target must be at least 1");

  const { error } = await supabase.from("habits").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateHabitPaths();
}

export async function setHabitActive(id: string, isActive: boolean) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("habits").update({ is_active: isActive }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateHabitPaths();
}

export async function deleteHabit(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("habits").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateHabitPaths();
}

export async function setHabitCompletion(habitId: string, date: string, completed: boolean, note?: string | null) {
  const { supabase, user } = await requireUser();

  if (!completed) {
    const { error } = await supabase
      .from("habit_completions")
      .delete()
      .eq("habit_id", habitId)
      .eq("date", date)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidateHabitPaths();
    return;
  }

  const { data: existing } = await supabase
    .from("habit_completions")
    .select("id")
    .eq("habit_id", habitId)
    .eq("date", date)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("habit_completions")
    .upsert(
      { habit_id: habitId, date, is_completed: true, note: note ?? null, user_id: user.id },
      { onConflict: "habit_id,date" }
    );

  if (error) throw new Error(error.message);

  if (!existing) {
    const { data: habit } = await supabase
      .from("habits")
      .select("name")
      .eq("id", habitId)
      .eq("user_id", user.id)
      .single();

    if (habit) {
      await logTimelineEvent(supabase, user.id, {
        eventType: "habit_completed",
        title: `Completed "${habit.name}"`,
        relatedEntityType: "habit",
        relatedEntityId: habitId,
        occurredAt: new Date(`${date}T12:00:00.000Z`).toISOString(),
      });

      const { data: completions } = await supabase
        .from("habit_completions")
        .select("date")
        .eq("habit_id", habitId)
        .eq("user_id", user.id)
        .eq("is_completed", true);

      const { current } = computeStreaks((completions ?? []).map((c) => c.date));
      if (HABIT_STREAK_MILESTONES.includes(current)) {
        await logTimelineEvent(supabase, user.id, {
          eventType: "habit_milestone",
          title: `${current}-day streak — "${habit.name}"`,
          relatedEntityType: "habit",
          relatedEntityId: habitId,
          metadata: { streak: current },
        });
      }
    }
  }

  revalidateHabitPaths();
}
