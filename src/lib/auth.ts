import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/types/database";

/**
 * role = "admin" alone isn't enough — a suspended admin (suspended by
 * another admin; you can't suspend yourself, see setUserStatus) must lose
 * admin powers the same way any other suspended user loses dashboard access.
 * This mirrors `is_admin()` in Postgres, which every admin-facing RLS policy
 * and trigger already goes through — keep the two in sync.
 */
export function isActiveAdmin(profile: Pick<Profile, "role" | "status"> | null | undefined): boolean {
  return profile?.role === "admin" && profile?.status === "approved";
}

/**
 * Every check here re-reads the caller's row from the database rather than
 * trusting anything passed in — role/status live only in `profiles`, gated
 * by RLS plus the `guard_profile_role_status` trigger, so this is the same
 * source of truth the proxy-level gate and the RLS policies themselves use.
 */
export async function getSessionProfile(): Promise<{
  supabase: SupabaseClient<Database>;
  userId: string;
  email: string | null;
  profile: Profile | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, userId: user.id, email: user.email ?? null, profile: profile as Profile | null };
}

/** For pages that require an admin. Redirects non-admins straight to /dashboard. */
export async function requireAdmin() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!isActiveAdmin(session.profile)) redirect("/dashboard");
  return session;
}
