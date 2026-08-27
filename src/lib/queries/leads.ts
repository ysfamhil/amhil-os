import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead, LeadStatus } from "@/types/database";

const OPEN_STATUSES: LeadStatus[] = ["Lead", "Contacted", "Proposal", "Negotiation"];

export async function getLeads(supabase: SupabaseClient<Database>, userId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface LeadAnalytics {
  total: number;
  contacted: number;
  proposals: number;
  negotiations: number;
  won: number;
  lost: number;
  /** Won ÷ Total × 100 — the simple, transparent definition: of every lead
   * ever created, what share ultimately closed. (An alternative — Won ÷
   * (Won + Lost) — would measure win rate only among *decided* leads,
   * ignoring ones still in progress. Total-based is used here because it's
   * the one this spec calls for, and it's clearly labelled in the UI so
   * it's never mistaken for the other.) */
  conversionRate: number;
  pipelineValue: number;
  wonValue: number;
}

export function computeLeadAnalytics(leads: Lead[]): LeadAnalytics {
  const total = leads.length;
  const won = leads.filter((l) => l.status === "Won");
  const lost = leads.filter((l) => l.status === "Lost").length;
  const openLeads = leads.filter((l) => OPEN_STATUSES.includes(l.status));

  return {
    total,
    contacted: leads.filter((l) => l.status === "Contacted").length,
    proposals: leads.filter((l) => l.status === "Proposal").length,
    negotiations: leads.filter((l) => l.status === "Negotiation").length,
    won: won.length,
    lost,
    conversionRate: total > 0 ? Math.round((won.length / total) * 100) : 0,
    pipelineValue: openLeads.reduce((t, l) => t + (l.estimated_value ?? 0), 0),
    wonValue: won.reduce((t, l) => t + (l.estimated_value ?? 0), 0),
  };
}
