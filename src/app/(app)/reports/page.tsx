import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveDateRange, isDateRangePreset, type DateRangePreset } from "@/lib/date-ranges";
import { todayISODate, addDaysISODate } from "@/lib/dates";
import {
  getProductivityReport,
  getLearningReport,
  getProjectsReport,
  getHabitsReport,
  getGoalsReport,
  getCrossSystemReport,
  getFinanceAdvancedMetrics,
} from "@/lib/queries/reports";
import { getWeeklyReviewData, getMonthlyReviewData } from "@/lib/queries/review";
import { getFinanceOverview, getMonthlyFinanceTrend } from "@/lib/queries/finance";
import { ReportsTabBar } from "@/components/reports/reports-tab-bar";
import { CrossSystemReport } from "@/components/reports/cross-system-report";
import { ProductivityReport } from "@/components/reports/productivity-report";
import { LearningReport } from "@/components/reports/learning-report";
import { ProjectsReport } from "@/components/reports/projects-report";
import { HabitsReport } from "@/components/reports/habits-report";
import { GoalsReport } from "@/components/reports/goals-report";
import { ReviewReport } from "@/components/reports/review-report";
import { FinanceOverview } from "@/components/finance/finance-overview";

export default async function ReportsPage({
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

  let body = null;

  if (tab === "productivity") {
    const data = await getProductivityReport(supabase, user.id, resolvedRange, todayISODate());
    body = <ProductivityReport range={range} rangeLabel={resolvedRange.label} data={data} />;
  } else if (tab === "learning") {
    const data = await getLearningReport(supabase, user.id, resolvedRange);
    body = <LearningReport range={range} rangeLabel={resolvedRange.label} data={data} />;
  } else if (tab === "projects") {
    const data = await getProjectsReport(supabase, user.id, resolvedRange);
    body = <ProjectsReport range={range} rangeLabel={resolvedRange.label} data={data} />;
  } else if (tab === "finance") {
    const [{ overview, breakdowns }, trend, advanced] = await Promise.all([
      getFinanceOverview(supabase, user.id, resolvedRange),
      getMonthlyFinanceTrend(supabase, user.id),
      getFinanceAdvancedMetrics(supabase, user.id, resolvedRange),
    ]);
    body = (
      <FinanceOverview
        range={range}
        rangeLabel={resolvedRange.label}
        overview={overview}
        breakdowns={breakdowns}
        trend={trend}
        advanced={advanced}
      />
    );
  } else if (tab === "habits") {
    const data = await getHabitsReport(supabase, user.id);
    body = <HabitsReport data={data} />;
  } else if (tab === "goals") {
    const data = await getGoalsReport(supabase, user.id, todayISODate(), addDaysISODate(14));
    body = <GoalsReport data={data} />;
  } else if (tab === "weekly-review") {
    const data = await getWeeklyReviewData(supabase, user.id, resolvedRange);
    body = <ReviewReport data={data} kind="weekly" range={range} />;
  } else if (tab === "monthly-review") {
    const data = await getMonthlyReviewData(supabase, user.id, resolvedRange);
    body = <ReviewReport data={data} kind="monthly" range={range} />;
  } else {
    const data = await getCrossSystemReport(supabase, user.id, resolvedRange);
    body = <CrossSystemReport range={range} rangeLabel={resolvedRange.label} data={data} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted">Productivity, learning, project, finance, habit, and goal analytics — always derived from your records.</p>
      </div>

      <ReportsTabBar active={tab} />

      {body}
    </div>
  );
}
