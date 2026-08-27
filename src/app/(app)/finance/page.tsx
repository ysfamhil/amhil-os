import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFinanceOverview, getMonthlyFinanceTrend } from "@/lib/queries/finance";
import { resolveDateRange, isDateRangePreset, type DateRangePreset } from "@/lib/date-ranges";
import { FinanceTabBar } from "@/components/finance/finance-tab-bar";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { IncomeBoard, type IncomeWithRelations } from "@/components/finance/income-board";
import { ExpenseBoard, type ExpenseWithRelations } from "@/components/finance/expense-board";
import type { IncomeStatus } from "@/types/database";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";

  const rangeParam = typeof sp.range === "string" && isDateRangePreset(sp.range) ? sp.range : "this_month";
  const range: DateRangePreset = rangeParam;
  const custom =
    typeof sp.start === "string" && typeof sp.end === "string" ? { start: sp.start, end: sp.end } : undefined;
  const resolvedRange = resolveDateRange(range, custom);

  const [clientsRes, projectsRes] = await Promise.all([
    supabase.from("clients").select("id,name").eq("user_id", user.id).order("name"),
    supabase.from("projects").select("id,name").eq("user_id", user.id).order("name"),
  ]);

  let body = null;

  if (tab === "income") {
    const status = typeof sp.status === "string" ? (sp.status as IncomeStatus) : undefined;
    const clientId = typeof sp.client === "string" ? sp.client : undefined;

    let query = supabase
      .from("income")
      .select("*, clients(id,name), projects(id,name)")
      .eq("user_id", user.id);
    if (status) query = query.eq("status", status);
    if (clientId) query = query.eq("client_id", clientId);
    query = query.order("date", { ascending: false });

    const { data } = await query;
    body = (
      <IncomeBoard
        entries={(data ?? []) as unknown as IncomeWithRelations[]}
        clients={clientsRes.data ?? []}
        projects={projectsRes.data ?? []}
      />
    );
  } else if (tab === "expenses") {
    const category = typeof sp.category === "string" ? sp.category : undefined;

    let query = supabase.from("expenses").select("*, projects(id,name)").eq("user_id", user.id);
    if (category) query = query.eq("category", category);
    query = query.order("date", { ascending: false });

    const { data } = await query;
    body = <ExpenseBoard entries={(data ?? []) as unknown as ExpenseWithRelations[]} projects={projectsRes.data ?? []} />;
  } else {
    const [{ overview, breakdowns }, trend] = await Promise.all([
      getFinanceOverview(supabase, user.id, resolvedRange),
      getMonthlyFinanceTrend(supabase, user.id),
    ]);
    body = (
      <FinanceOverview
        range={range}
        rangeLabel={resolvedRange.label}
        overview={overview}
        breakdowns={breakdowns}
        trend={trend}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
        <p className="text-sm text-muted">Income, expenses, and net income — always derived from your records.</p>
      </div>

      <FinanceTabBar active={tab} />

      {body}
    </div>
  );
}
