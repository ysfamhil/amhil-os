"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function revalidateSubtaskPaths() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function createSubtask(taskId: string, title: string) {
  const { supabase, user } = await requireUser();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");

  const { data: task } = await supabase.from("tasks").select("id").eq("id", taskId).eq("user_id", user.id).single();
  if (!task) throw new Error("Task not found");

  const { error } = await supabase.from("subtasks").insert({
    task_id: taskId,
    title: trimmed,
    user_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidateSubtaskPaths();
}

export async function toggleSubtask(id: string, isCompleted: boolean) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("subtasks")
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateSubtaskPaths();
}

export async function deleteSubtask(id: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("subtasks").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateSubtaskPaths();
}
