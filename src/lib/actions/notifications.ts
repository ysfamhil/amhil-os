"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { runAutomationChecks } from "@/lib/automation";

export async function checkForNotifications(): Promise<number> {
  const { supabase, user } = await requireApprovedSession();
  const created = await runAutomationChecks(supabase, user.id);
  if (created > 0) revalidatePath("/", "layout");
  return created;
}

export async function markNotificationRead(id: string) {
  const { supabase, user } = await requireApprovedSession();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireApprovedSession();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
