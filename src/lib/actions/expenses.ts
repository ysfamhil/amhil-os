"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { logTimelineEvent } from "@/lib/timeline";
import { EXPENSE_FIELDS, RELATIONS, assertOwnedRelations, assertUuid, pickWritable } from "@/lib/write-fields";

export interface ExpenseInput {
  amount: number;
  currency?: string;
  date?: string;
  category?: string | null;
  project_id?: string | null;
  description?: string | null;
}

function revalidateExpensePaths(projectId?: string | null) {
  revalidatePath("/app/finance");
  revalidatePath("/app/dashboard");
  if (projectId) revalidatePath(`/app/projects/${projectId}`);
}

export async function createExpense(input: ExpenseInput) {
  const { supabase, user } = await requireApprovedSession();
  const fields = pickWritable(EXPENSE_FIELDS, input);
  if (!fields.amount || fields.amount < 0) throw new Error("Amount must be zero or greater");
  await assertOwnedRelations(supabase, user.id, RELATIONS.expenses, fields);

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      ...fields,
      amount: fields.amount,
      project_id: fields.project_id || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "expense_added",
    title: `Added expense: ${fields.amount.toLocaleString()} ${fields.currency ?? "MAD"} — ${fields.category ?? "Uncategorized"}`,
    relatedEntityType: "expense",
    relatedEntityId: data.id,
    projectId: fields.project_id || null,
    metadata: { amount: fields.amount, currency: fields.currency ?? "MAD" },
  });

  revalidateExpensePaths(fields.project_id);
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Expense");
  const fields = pickWritable(EXPENSE_FIELDS, input);
  if (fields.amount != null && fields.amount < 0) throw new Error("Amount must be zero or greater");
  await assertOwnedRelations(supabase, user.id, RELATIONS.expenses, fields);

  const patch = { ...fields };
  if ("project_id" in fields) patch.project_id = fields.project_id || null;

  const { data, error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("project_id")
    .single();

  if (error) throw new Error(error.message);
  revalidateExpensePaths(data?.project_id);
}

export async function deleteExpense(id: string) {
  const { supabase, user } = await requireApprovedSession();

  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("project_id")
    .single();

  if (error) throw new Error(error.message);
  revalidateExpensePaths(data?.project_id);
}
