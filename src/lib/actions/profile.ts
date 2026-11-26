"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";

export interface ProfileInput {
  full_name?: string | null;
  avatar_url?: string | null;
}

export async function updateProfile(input: ProfileInput) {
  const { supabase, user } = await requireApprovedSession();

  const patch: ProfileInput = {};
  if ("full_name" in input) patch.full_name = input.full_name?.trim() || null;
  if ("avatar_url" in input) patch.avatar_url = input.avatar_url?.trim() || null;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
}
