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
}

async function addTransaction(amount: number, note: string | null) {
  const { supabase, user } = await requireUser();
  if (!amount) throw new Error("Amount is required");

  const { error } = await supabase.from("emergency_fund_transactions").insert({
    amount,
    note: note || null,
    user_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidateEmergencyFundPaths();
}

export async function addEmergencyFundDeposit(amount: number, note?: string | null) {
  if (amount <= 0) throw new Error("Deposit amount must be greater than zero");
  await addTransaction(amount, note ?? null);
}

export async function addEmergencyFundWithdrawal(amount: number, note?: string | null) {
  if (amount <= 0) throw new Error("Withdrawal amount must be greater than zero");
  await addTransaction(-amount, note ?? null);
}

export async function deleteEmergencyFundTransaction(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("emergency_fund_transactions").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateEmergencyFundPaths();
}

export async function setEmergencyFundTarget(targetAmount: number) {
  const { supabase, user } = await requireUser();
  if (targetAmount <= 0) throw new Error("Target must be greater than zero");

  const { error } = await supabase
    .from("emergency_fund")
    .upsert({ user_id: user.id, target_amount: targetAmount }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
  revalidateEmergencyFundPaths();
}
