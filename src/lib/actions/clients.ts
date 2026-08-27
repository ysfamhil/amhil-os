"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import type { ClientStatus } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface ClientInput {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  source?: string | null;
  status?: ClientStatus;
  notes?: string | null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function revalidateClientPaths(id?: string) {
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/clients/${id}`);
}

export async function createClientRecord(input: ClientInput) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (input.email && !isValidEmail(input.email)) throw new Error("Enter a valid email address");

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...input, name, user_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "client_created",
    title: `New client: "${name}"`,
    relatedEntityType: "client",
    relatedEntityId: data.id,
  });

  revalidateClientPaths(data?.id);
  return data;
}

export async function updateClientRecord(id: string, input: Partial<ClientInput>) {
  const { supabase, user } = await requireUser();

  const patch = { ...input };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if (patch.email && !isValidEmail(patch.email)) throw new Error("Enter a valid email address");

  const { error } = await supabase.from("clients").update(patch).eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateClientPaths(id);
}

export async function deleteClientRecord(id: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("clients").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateClientPaths();
}
