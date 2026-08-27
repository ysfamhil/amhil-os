"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";
import type { IncomeStatus } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

async function logIncomeReceived(
  supabase: SupabaseClient<Database>,
  userId: string,
  incomeId: string,
  amount: number,
  currency: string,
  clientId: string | null
) {
  let clientLabel = "";
  if (clientId) {
    const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).eq("user_id", userId).single();
    if (client) clientLabel = ` — ${client.name}`;
  }
  await logTimelineEvent(supabase, userId, {
    eventType: "income_received",
    title: `Received ${amount.toLocaleString()} ${currency}${clientLabel}`,
    relatedEntityType: "income",
    relatedEntityId: incomeId,
    metadata: { amount, currency },
  });
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface IncomeInput {
  amount: number;
  currency?: string;
  date?: string;
  client_id?: string | null;
  project_id?: string | null;
  source?: string | null;
  description?: string | null;
  status?: IncomeStatus;
  payment_date?: string | null;
}

function revalidateIncomePaths(clientId?: string | null, projectId?: string | null) {
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createIncome(input: IncomeInput) {
  const { supabase, user } = await requireUser();
  if (!input.amount || input.amount < 0) throw new Error("Amount must be zero or greater");

  const { data, error } = await supabase
    .from("income")
    .insert({
      ...input,
      client_id: input.client_id || null,
      project_id: input.project_id || null,
      payment_date: input.payment_date || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (input.status === "Paid") {
    await logIncomeReceived(supabase, user.id, data.id, input.amount, input.currency ?? "MAD", input.client_id ?? null);
  }

  revalidateIncomePaths(input.client_id, input.project_id);
}

export async function updateIncome(id: string, input: Partial<IncomeInput>) {
  const { supabase, user } = await requireUser();
  if (input.amount != null && input.amount < 0) throw new Error("Amount must be zero or greater");

  let previousStatus: IncomeStatus | null = null;
  if (input.status) {
    const { data: existing } = await supabase
      .from("income")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch = { ...input };
  if ("client_id" in input) patch.client_id = input.client_id || null;
  if ("project_id" in input) patch.project_id = input.project_id || null;
  if ("payment_date" in input) patch.payment_date = input.payment_date || null;
  if (patch.status === "Paid" && !patch.payment_date) {
    patch.payment_date = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await supabase
    .from("income")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("client_id,project_id,amount,currency")
    .single();

  if (error) throw new Error(error.message);

  if (input.status === "Paid" && previousStatus !== "Paid") {
    await logIncomeReceived(supabase, user.id, id, data.amount, data.currency, data.client_id);
  }

  revalidateIncomePaths(data?.client_id, data?.project_id);
}

export async function deleteIncome(id: string) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("income")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("client_id,project_id")
    .single();

  if (error) throw new Error(error.message);
  revalidateIncomePaths(data?.client_id, data?.project_id);
}
