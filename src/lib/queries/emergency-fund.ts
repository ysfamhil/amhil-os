import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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

export interface EmergencyFundListItem {
  id: string;
  name: string;
  targetAmount: number;
  balance: number;
}

export interface EmergencyFundDetail extends EmergencyFundListItem {
  transactions: EmergencyFundTransactionRow[];
}

/**
 * Aggregated across every fund the user owns — the balance is always
 * derived from the transaction ledger (SUM of deposits minus withdrawals)
 * rather than a cached running total, so it can never drift out of sync.
 * Used by the Dashboard widget, which shows a combined total rather than
 * picking one "primary" fund.
 */
export async function getEmergencyFundSummary(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EmergencyFundSummary> {
  const [fundsRes, transactionsRes] = await Promise.all([
    supabase.from("emergency_fund").select("target_amount").eq("user_id", userId),
    supabase
      .from("emergency_fund_transactions")
      .select("id,amount,note,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const funds = fundsRes.data ?? [];
  const transactions = (transactionsRes.data ?? []) as EmergencyFundTransactionRow[];
  const balance = transactions.reduce((total, t) => total + t.amount, 0);
  const targetAmount = funds.reduce((total, f) => total + f.target_amount, 0);

  return {
    targetAmount,
    balance,
    recentTransactions: transactions.slice(0, 5),
  };
}

export async function getEmergencyFunds(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EmergencyFundListItem[]> {
  const [fundsRes, transactionsRes] = await Promise.all([
    supabase.from("emergency_fund").select("id,name,target_amount").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("emergency_fund_transactions").select("fund_id,amount").eq("user_id", userId),
  ]);

  const funds = fundsRes.data ?? [];
  const transactions = transactionsRes.data ?? [];

  const balanceByFund = new Map<string, number>();
  for (const t of transactions) {
    balanceByFund.set(t.fund_id, (balanceByFund.get(t.fund_id) ?? 0) + t.amount);
  }

  return funds.map((f) => ({
    id: f.id,
    name: f.name,
    targetAmount: f.target_amount,
    balance: balanceByFund.get(f.id) ?? 0,
  }));
}

export async function getEmergencyFundById(
  supabase: SupabaseClient<Database>,
  userId: string,
  fundId: string
): Promise<EmergencyFundDetail | null> {
  const [fundRes, transactionsRes] = await Promise.all([
    supabase.from("emergency_fund").select("id,name,target_amount").eq("id", fundId).eq("user_id", userId).maybeSingle(),
    supabase
      .from("emergency_fund_transactions")
      .select("id,amount,note,created_at")
      .eq("fund_id", fundId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (!fundRes.data) return null;

  const transactions = (transactionsRes.data ?? []) as EmergencyFundTransactionRow[];
  const balance = transactions.reduce((total, t) => total + t.amount, 0);

  return {
    id: fundRes.data.id,
    name: fundRes.data.name,
    targetAmount: fundRes.data.target_amount,
    balance,
    transactions,
  };
}
