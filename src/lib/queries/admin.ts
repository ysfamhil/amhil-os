import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/types/database";

export interface UserStats {
  total: number;
  pending: number;
  approved: number;
  suspended: number;
  newThisWeek: number;
}

/**
 * Every caller of these two functions must already be an admin — RLS's
 * "profiles: admin select all" policy is what actually lets these queries
 * see rows beyond the caller's own, so calling this as a non-admin just
 * silently returns their single row, not an error. The real gate is
 * `requireAdmin()` at the page/action layer, before either of these run.
 */
export async function getUserStats(supabase: SupabaseClient<Database>): Promise<UserStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, pendingRes, approvedRes, suspendedRes, newRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);

  return {
    total: totalRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    approved: approvedRes.count ?? 0,
    suspended: suspendedRes.count ?? 0,
    newThisWeek: newRes.count ?? 0,
  };
}

export async function getAllUsers(supabase: SupabaseClient<Database>): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}
