"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface ExpenseInput {
  amount: number;
  currency?: string;
  date?: string;
  category?: string | null;
  project_id?: string | null;
  description?: string | null;
}

function revalidateExpensePaths(projectId?: string | null) {
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createExpense(input: ExpenseInput) {
  const { supabase, user } = await requireUser();
  if (!input.amount || input.amount < 0) throw new Error("Amount must be zero or greater");

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      ...input,
      project_id: input.project_id || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "expense_added",
    title: `Added expense: ${input.amount.toLocaleString()} ${input.currency ?? "MAD"} — ${input.category ?? "Uncategorized"}`,
    relatedEntityType: "expense",
    relatedEntityId: data.id,
    projectId: input.project_id ?? null,
    metadata: { amount: input.amount, currency: input.currency ?? "MAD" },
  });

  revalidateExpensePaths(input.project_id);
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>) {
  const { supabase, user } = await requireUser();
  if (input.amount != null && input.amount < 0) throw new Error("Amount must be zero or greater");

  const patch = { ...input };
  if ("project_id" in input) patch.project_id = input.project_id || null;

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
  const { supabase, user } = await requireUser();

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
