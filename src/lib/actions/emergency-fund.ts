"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function revalidateEmergencyFundPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/finance");
}

export async function createEmergencyFund(name: string, targetAmount: number) {
  const { supabase, user } = await requireUser();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Name is required");
  if (!targetAmount || targetAmount <= 0) throw new Error("Target must be greater than zero");

  const { data, error } = await supabase
    .from("emergency_fund")
    .insert({ user_id: user.id, name: trimmedName, target_amount: targetAmount })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidateEmergencyFundPaths();
  return data;
}

export async function updateEmergencyFund(fundId: string, input: { name: string; targetAmount: number }) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (!input.targetAmount || input.targetAmount <= 0) throw new Error("Target must be greater than zero");

  const { error } = await supabase
    .from("emergency_fund")
    .update({ name, target_amount: input.targetAmount })
    .eq("id", fundId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateEmergencyFundPaths();
}

async function addTransaction(fundId: string, amount: number, note: string | null) {
  const { supabase, user } = await requireUser();
  if (!amount) throw new Error("Amount is required");

  const { error } = await supabase.from("emergency_fund_transactions").insert({
    fund_id: fundId,
    amount,
    note: note || null,
    user_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidateEmergencyFundPaths();
}

export async function addEmergencyFundDeposit(fundId: string, amount: number, note?: string | null) {
  if (amount <= 0) throw new Error("Deposit amount must be greater than zero");
  await addTransaction(fundId, amount, note ?? null);
}

export async function addEmergencyFundWithdrawal(fundId: string, amount: number, note?: string | null) {
  if (amount <= 0) throw new Error("Withdrawal amount must be greater than zero");
  await addTransaction(fundId, -amount, note ?? null);
}

export async function deleteEmergencyFundTransaction(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("emergency_fund_transactions").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateEmergencyFundPaths();
}
