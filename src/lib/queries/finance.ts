import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthISODate } from "@/lib/dates";
import type { Database } from "@/types/database";

type IncomeRow = {
  amount: number;
  status: string;
  client_id: string | null;
  project_id: string | null;
  source: string | null;
  date: string;
  clients: { name: string } | null;
  projects: { name: string } | null;
};

type ExpenseRow = {
  amount: number;
  category: string | null;
  project_id: string | null;
  date: string;
  projects: { name: string } | null;
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

export interface FinanceBreakdowns {
  byClient: { key: string; label: string; revenue: number }[];
  byProject: { key: string; label: string; revenue: number; expenses: number }[];
  bySource: { key: string; label: string; revenue: number }[];
  byCategory: { key: string; label: string; expenses: number }[];
}

function groupSum<T>(rows: T[], keyOf: (row: T) => { key: string; label: string }, amountOf: (row: T) => number) {
  const map = new Map<string, { label: string; amount: number }>();
  for (const row of rows) {
    const { key, label } = keyOf(row);
    const entry = map.get(key) ?? { label, amount: 0 };
    entry.amount += amountOf(row);
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([key, { label, amount }]) => ({ key, label, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getFinanceOverview(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: { start: string; end: string }
): Promise<{ overview: FinanceOverview; breakdowns: FinanceBreakdowns }> {
  const [incomeRes, expensesRes] = await Promise.all([
    supabase
      .from("income")
      .select("amount,status,client_id,project_id,source,date,clients(name),projects(name)")
      .eq("user_id", userId)
      .gte("date", range.start)
      .lte("date", range.end),
    supabase
      .from("expenses")
      .select("amount,category,project_id,date,projects(name)")
      .eq("user_id", userId)
      .gte("date", range.start)
      .lte("date", range.end),
  ]);

  const income = (incomeRes.data ?? []) as unknown as IncomeRow[];
  const expenses = (expensesRes.data ?? []) as unknown as ExpenseRow[];

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

  const paidIncome = income.filter((i) => i.status === "Paid");

  const byClient = groupSum(
    paidIncome.filter((i) => i.client_id),
    (i) => ({ key: i.client_id!, label: i.clients?.name ?? "Unknown client" }),
    (i) => i.amount
  ).map((r) => ({ key: r.key, label: r.label, revenue: r.amount }));

  const byProjectRevenue = groupSum(
    paidIncome.filter((i) => i.project_id),
    (i) => ({ key: i.project_id!, label: i.projects?.name ?? "Unknown project" }),
    (i) => i.amount
  );
  const projectExpenseMap = new Map<string, number>();
  for (const e of expenses) {
    if (!e.project_id) continue;
    projectExpenseMap.set(e.project_id, (projectExpenseMap.get(e.project_id) ?? 0) + e.amount);
  }
  const projectKeys = new Set([...byProjectRevenue.map((r) => r.key), ...projectExpenseMap.keys()]);
  const byProject = [...projectKeys].map((key) => {
    const revenueEntry = byProjectRevenue.find((r) => r.key === key);
    const projectExpense = expenses.find((e) => e.project_id === key);
    return {
      key,
      label: revenueEntry?.label ?? projectExpense?.projects?.name ?? "Unknown project",
      revenue: revenueEntry?.amount ?? 0,
      expenses: projectExpenseMap.get(key) ?? 0,
    };
  });

  const bySource = groupSum(
    paidIncome,
    (i) => ({ key: i.source || "Unspecified", label: i.source || "Unspecified" }),
    (i) => i.amount
  ).map((r) => ({ key: r.key, label: r.label, revenue: r.amount }));

  const byCategory = groupSum(
    expenses,
    (e) => ({ key: e.category || "Uncategorized", label: e.category || "Uncategorized" }),
    (e) => e.amount
  ).map((r) => ({ key: r.key, label: r.label, expenses: r.amount }));

  return { overview, breakdowns: { byClient, byProject, bySource, byCategory } };
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
