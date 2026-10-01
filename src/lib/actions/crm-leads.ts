"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISODate } from "@/lib/dates";
import type { CrmLeadStatus } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

const SAFE_URL_SCHEMES = new Set(["http:", "https:"]);

/** Only http(s) links are allowed — rejects javascript:/data:/etc. schemes that
 * would otherwise be stored and rendered as a clickable link in the UI. */
function sanitizeWebsiteUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Website URL must be a valid http:// or https:// link");
  }
  if (!SAFE_URL_SCHEMES.has(parsed.protocol)) {
    throw new Error("Website URL must be a valid http:// or https:// link");
  }
  return trimmed;
}

export interface CrmLeadInput {
  name: string;
  website_url?: string | null;
  contact?: string | null;
  status?: CrmLeadStatus;
  notes?: string | null;
  date?: string;
}

export async function createCrmLead(input: CrmLeadInput) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const { data, error } = await supabase
    .from("crm_leads")
    .insert({
      name,
      website_url: sanitizeWebsiteUrl(input.website_url),
      contact: input.contact || null,
      status: input.status ?? "New",
      notes: input.notes || null,
      date: input.date || todayISODate(),
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/crm");
  return data;
}

export async function updateCrmLead(id: string, input: Partial<CrmLeadInput>) {
  const { supabase, user } = await requireUser();

  const patch = { ...input };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if ("website_url" in input) patch.website_url = sanitizeWebsiteUrl(input.website_url);
  if ("contact" in input) patch.contact = input.contact || null;
  if ("notes" in input) patch.notes = input.notes || null;

  const { error } = await supabase.from("crm_leads").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/crm");
}

export async function setCrmLeadStatus(id: string, status: CrmLeadStatus) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("crm_leads").update({ status }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/crm");
}

export async function deleteCrmLead(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("crm_leads").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/crm");
}
