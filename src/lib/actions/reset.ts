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

/**
 * Deletes every entry the user has created — tasks (and their subtasks, via
 * cascade), habits (and their completion history, via cascade), goals, time
 * entries, income, and expenses. Runs through the normal RLS-scoped client,
 * same as every other action, so it can only ever touch this user's own
 * rows. The account, profile, and settings are untouched.
 */
export async function resetAllData() {
  const { supabase, user } = await requireUser();

  const tables = ["tasks", "habits", "goals", "time_entries", "income", "expenses"] as const;

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/goals");
  revalidatePath("/time");
  revalidatePath("/finance");
}
