import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, ClientStatus, Database, Project } from "@/types/database";

export interface ClientFilters {
  q?: string;
  status?: ClientStatus;
  sort?: "name" | "created_at" | "status";
}

export async function getClients(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters: ClientFilters = {}
): Promise<Client[]> {
  let query = supabase.from("clients").select("*").eq("user_id", userId);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) query = query.or(`name.ilike.%${filters.q}%,company.ilike.%${filters.q}%`);

  const sort = filters.sort ?? "created_at";
  query = query.order(sort, { ascending: sort === "name" });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface ClientFinance {
  totalPaid: number;
  expected: number;
  invoiced: number;
  incomeRecordCount: number;
}

export interface ClientDetail {
  client: Client;
  projects: Project[];
  finance: ClientFinance;
}

export async function getClientById(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<ClientDetail | null> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!client) return null;

  const [projectsRes, incomeRes] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", userId).eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("income").select("amount,status").eq("user_id", userId).eq("client_id", id),
  ]);

  const projects = (projectsRes.data ?? []) as Project[];
  const income = (incomeRes.data ?? []) as { amount: number; status: string }[];

  const finance: ClientFinance = {
    totalPaid: income.filter((i) => i.status === "Paid").reduce((t, i) => t + i.amount, 0),
    expected: income.filter((i) => i.status === "Expected").reduce((t, i) => t + i.amount, 0),
    invoiced: income.filter((i) => i.status === "Invoiced").reduce((t, i) => t + i.amount, 0),
    incomeRecordCount: income.length,
  };

  return { client, projects, finance };
}
