import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const DEFAULT_TARGET = 5000;

export interface EmergencyFundTransactionRow {
  id: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface EmergencyFundSummary {
  targetAmount: number;
  balance: number;
  recentTransactions: EmergencyFundTransactionRow[];
}

/**
 * The balance is always derived from the transaction ledger (SUM of
 * deposits minus withdrawals) rather than a cached running total, so it can
 * never drift out of sync — same approach the Finance widget uses for its
 * monthly totals. `target_amount` is the one setting a user can edit; it
 * defaults to 5000 until they explicitly change it (see setEmergencyFundTarget).
 */
export async function getEmergencyFundSummary(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EmergencyFundSummary> {
  const [settingsRes, transactionsRes] = await Promise.all([
    supabase.from("emergency_fund").select("target_amount").eq("user_id", userId).maybeSingle(),
    supabase
      .from("emergency_fund_transactions")
      .select("id,amount,note,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const transactions = (transactionsRes.data ?? []) as EmergencyFundTransactionRow[];
  const balance = transactions.reduce((total, t) => total + t.amount, 0);

  return {
    targetAmount: settingsRes.data?.target_amount ?? DEFAULT_TARGET,
    balance,
    recentTransactions: transactions.slice(0, 5),
  };
}
