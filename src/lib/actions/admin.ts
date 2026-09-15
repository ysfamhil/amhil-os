"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile, isActiveAdmin } from "@/lib/auth";
import type { UserStatus } from "@/types/database";

/**
 * The real gate. Every exported action re-checks the caller's own role from
 * the database before touching anyone else's row — never trust a role/status
 * passed in from the client, and never assume the admin nav link being
 * hidden is enough on its own. RLS's "profiles: admin update all" policy is
 * a second, independent backstop: even if this check were skipped, a
 * non-admin's write would still be rejected at the database.
 */
async function requireAdminSession() {
  const session = await getSessionProfile();
  if (!session) throw new Error("Not authenticated");
  if (!isActiveAdmin(session.profile)) throw new Error("Admin access required");
  return session;
}

async function setUserStatus(targetUserId: string, status: UserStatus) {
  const { supabase, userId } = await requireAdminSession();

  if (targetUserId === userId) {
    throw new Error("You can't change your own access level");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: status === "approved" ? userId : null,
    })
    .eq("id", targetUserId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function approveUser(targetUserId: string) {
  await setUserStatus(targetUserId, "approved");
}

export async function rejectUser(targetUserId: string) {
  await setUserStatus(targetUserId, "suspended");
}

export async function suspendUser(targetUserId: string) {
  await setUserStatus(targetUserId, "suspended");
}

export async function reinstateUser(targetUserId: string) {
  await setUserStatus(targetUserId, "approved");
}
