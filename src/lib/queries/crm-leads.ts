import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmLead, Database } from "@/types/database";

export async function getCrmLeads(supabase: SupabaseClient<Database>, userId: string): Promise<CrmLead[]> {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
