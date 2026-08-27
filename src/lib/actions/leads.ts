"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import type { LeadStatus } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface LeadInput {
  name: string;
  company?: string | null;
  contact?: string | null;
  source?: string | null;
  status?: LeadStatus;
  estimated_value?: number | null;
  notes?: string | null;
  contacted_at?: string | null;
}

function revalidateLeadPaths() {
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function createLead(input: LeadInput) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (input.estimated_value != null && input.estimated_value < 0) {
    throw new Error("Estimated value can't be negative");
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({ ...input, name, user_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "lead_created",
    title: `New lead: "${name}"`,
    relatedEntityType: "lead",
    relatedEntityId: data.id,
  });

  revalidateLeadPaths();
}

export async function updateLead(id: string, input: Partial<LeadInput>) {
  const { supabase, user } = await requireUser();

  let previousStatus: LeadStatus | null = null;
  if (input.status) {
    const { data: existing } = await supabase
      .from("leads")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch = { ...input };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if (patch.estimated_value != null && patch.estimated_value < 0) {
    throw new Error("Estimated value can't be negative");
  }

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("name")
    .single();

  if (error) throw new Error(error.message);

  if (input.status && input.status !== previousStatus && (input.status === "Won" || input.status === "Lost")) {
    await logTimelineEvent(supabase, user.id, {
      eventType: input.status === "Won" ? "lead_won" : "lead_lost",
      title: `Lead ${input.status.toLowerCase()}: "${data.name}"`,
      relatedEntityType: "lead",
      relatedEntityId: id,
    });
  }

  revalidateLeadPaths();
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  const patch: Partial<LeadInput> & { contacted_at?: string } = { status };
  if (status === "Contacted") {
    const { supabase, user } = await requireUser();
    const { data: existing } = await supabase
      .from("leads")
      .select("contacted_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (existing && !existing.contacted_at) {
      patch.contacted_at = new Date().toISOString();
    }
  }
  return updateLead(id, patch);
}

export async function deleteLead(id: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("leads").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateLeadPaths();
}

/**
 * Converts a Won lead into a client. Idempotent: if the lead was already
 * converted, returns the existing client instead of creating a duplicate.
 * The lead's contact field is a single free-text field with no email/phone
 * split, so it's routed to email when it looks like one and phone otherwise
 * — a client can always tidy this up afterward.
 */
export async function convertLeadToClient(leadId: string) {
  const { supabase, user } = await requireUser();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", user.id)
    .single();

  if (leadError) throw new Error(leadError.message);
  if (!lead) throw new Error("Lead not found");

  if (lead.converted_client_id) {
    return { clientId: lead.converted_client_id, alreadyConverted: true };
  }

  const looksLikeEmail = lead.contact && lead.contact.includes("@");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      name: lead.name,
      company: lead.company,
      email: looksLikeEmail ? lead.contact : null,
      phone: looksLikeEmail ? null : lead.contact,
      source: lead.source,
      status: "Client",
      notes: lead.notes,
    })
    .select("id")
    .single();

  if (clientError) throw new Error(clientError.message);

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      status: "Won",
      converted_at: new Date().toISOString(),
      converted_client_id: client.id,
    })
    .eq("id", leadId)
    .eq("user_id", user.id);

  if (updateError) throw new Error(updateError.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "lead_won",
    title: `Lead won: "${lead.name}"`,
    relatedEntityType: "lead",
    relatedEntityId: leadId,
  });
  await logTimelineEvent(supabase, user.id, {
    eventType: "client_created",
    title: `New client: "${lead.name}"`,
    relatedEntityType: "client",
    relatedEntityId: client.id,
  });

  revalidateLeadPaths();
  revalidatePath("/clients");

  return { clientId: client.id, alreadyConverted: false };
}
