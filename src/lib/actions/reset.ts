"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";

export async function resetAllData() {
  const { supabase } = await requireApprovedSession();
  const { data, error } = await supabase.rpc("reset_workspace_data");
  if (error) {
    return {
      ok: false as const,
      message: error.code === "22023" || error.code === "55P03"
        ? error.message
        : "The reset request failed. Check the workspace before retrying.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true as const, removed: data };
}
