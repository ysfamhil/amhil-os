import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthISODate } from "@/lib/dates";
import type { Database } from "@/types/database";

type IncomeRow = {
  amount: number;
  status: string;
};

type ExpenseRow = {
  amount: number;
};

/**
 * "Actual Revenue" = Paid income only. Expected and Invoiced are shown as
 * separate figures, never summed into revenue or net income. Cancelled
 * income is excluded from every total on this page — it never happened.
 */
export interface FinanceOverview {
  paidRevenue: number;
  invoicedIncome: number;
  expectedIncome: number;
  cancelledIncome: number;
  expenses: number;
  netIncome: number;
}

export async function getFinanceOverview(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: { start: string; end: string }
): Promise<{ overview: FinanceOverview }> {
  const [incomeRes, expensesRes] = await Promise.all([
    supabase
      .from("income")
      .select("amount,status")
      .eq("user_id", userId)
      .gte("date", range.start)
      .lte("date", range.end),
    supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", userId)
      .gte("date", range.start)
      .lte("date", range.end),
  ]);

  const income = (incomeRes.data ?? []) as IncomeRow[];
  const expenses = (expensesRes.data ?? []) as ExpenseRow[];

  const sumBy = (status: string) => income.filter((i) => i.status === status).reduce((t, i) => t + i.amount, 0);

  const paidRevenue = sumBy("Paid");
  const expensesTotal = expenses.reduce((t, e) => t + e.amount, 0);

  const overview: FinanceOverview = {
    paidRevenue,
    invoicedIncome: sumBy("Invoiced"),
    expectedIncome: sumBy("Expected"),
    cancelledIncome: sumBy("Cancelled"),
    expenses: expensesTotal,
    netIncome: paidRevenue - expensesTotal,
  };

  return { overview };
}

export interface MonthlyFinancePoint {
  month: string;
  revenue: number;
  expenses: number;
}

export async function getMonthlyFinanceTrend(
  supabase: SupabaseClient<Database>,
  userId: string,
  months = 6
): Promise<MonthlyFinancePoint[]> {
  const start = startOfMonthISODate(new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1));

  const [incomeRes, expensesRes] = await Promise.all([
    supabase.from("income").select("amount,date,status").eq("user_id", userId).eq("status", "Paid").gte("date", start),
    supabase.from("expenses").select("amount,date").eq("user_id", userId).gte("date", start),
  ]);

  const income = (incomeRes.data ?? []) as { amount: number; date: string }[];
  const expenses = (expensesRes.data ?? []) as { amount: number; date: string }[];

  const points: MonthlyFinancePoint[] = [];
  const cursor = new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1);
  for (let i = 0; i < months; i++) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = cursor.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    const monthStart = `${monthKey}-01`;
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10);

    points.push({
      month: monthLabel,
      revenue: income.filter((i) => i.date >= monthStart && i.date <= monthEnd).reduce((t, i) => t + i.amount, 0),
      expenses: expenses.filter((e) => e.date >= monthStart && e.date <= monthEnd).reduce((t, e) => t + e.amount, 0),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points;
}
