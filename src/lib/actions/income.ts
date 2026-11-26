"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { logTimelineEvent } from "@/lib/timeline";
import type { IncomeStatus } from "@/types/database";
import { INCOME_FIELDS, RELATIONS, assertOwnedRelations, assertUuid, pickWritable } from "@/lib/write-fields";
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
  revalidatePath("/app/finance");
  revalidatePath("/app/dashboard");
  if (clientId) revalidatePath(`/app/clients/${clientId}`);
  if (projectId) revalidatePath(`/app/projects/${projectId}`);
}

export async function createIncome(input: IncomeInput) {
  const { supabase, user } = await requireApprovedSession();
  const fields = pickWritable(INCOME_FIELDS, input);
  if (!fields.amount || fields.amount < 0) throw new Error("Amount must be zero or greater");
  await assertOwnedRelations(supabase, user.id, RELATIONS.income, fields);

  const { data, error } = await supabase
    .from("income")
    .insert({
      ...fields,
      amount: fields.amount,
      client_id: fields.client_id || null,
      project_id: fields.project_id || null,
      payment_date: fields.payment_date || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (fields.status === "Paid") {
    await logIncomeReceived(supabase, user.id, data.id, fields.amount, fields.currency ?? "MAD", fields.client_id || null);
  }

  revalidateIncomePaths(fields.client_id, fields.project_id);
}

export async function updateIncome(id: string, input: Partial<IncomeInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Income");
  const fields = pickWritable(INCOME_FIELDS, input);
  if (fields.amount != null && fields.amount < 0) throw new Error("Amount must be zero or greater");
  await assertOwnedRelations(supabase, user.id, RELATIONS.income, fields);

  let previousStatus: IncomeStatus | null = null;
  if (fields.status) {
    const { data: existing } = await supabase
      .from("income")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    previousStatus = existing?.status ?? null;
  }

  const patch = { ...fields };
  if ("client_id" in fields) patch.client_id = fields.client_id || null;
  if ("project_id" in fields) patch.project_id = fields.project_id || null;
  if ("payment_date" in fields) patch.payment_date = fields.payment_date || null;
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

  if (fields.status === "Paid" && previousStatus !== "Paid") {
    await logIncomeReceived(supabase, user.id, id, data.amount, data.currency, data.client_id);
  }

  revalidateIncomePaths(data?.client_id, data?.project_id);
}

export async function deleteIncome(id: string) {
  const { supabase, user } = await requireApprovedSession();

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
