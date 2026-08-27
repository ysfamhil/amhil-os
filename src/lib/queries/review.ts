import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DateRange } from "@/lib/date-ranges";
import { getProductivityReport, getLearningReport, getHabitsReport, getGoalsReport } from "@/lib/queries/reports";
import { getFinanceOverview } from "@/lib/queries/finance";
import { getProjects } from "@/lib/queries/projects";
import { todayISODate, addDaysISODate } from "@/lib/dates";

export interface ReviewProblems {
  overdueTasks: number;
  stalledProjects: string[];
  inconsistentHabits: string[];
  learningDeclinePercent: number | null;
}

export interface WeeklyReviewData {
  range: { start: string; end: string; label: string };
  accomplishments: {
    tasksCompleted: number;
    projectsProgressed: number;
    learningSessionsLogged: number;
    goalsProgressed: number;
  };
  time: { totalHours: number; learningHours: number; projectHours: number };
  finance: { revenue: number; expenses: number; netIncome: number };
  habits: { completionRate: number; strongest: string | null; weakest: string | null };
  problems: ReviewProblems;
}

async function detectProblems(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DateRange,
  learningHoursThisPeriod: number
): Promise<ReviewProblems> {
  const today = todayISODate();

  const [overdueRes, projects, habitsReport] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lt("due_date", today)
      .not("status", "in", "(Done,Cancelled)"),
    getProjects(supabase, userId, "Active"),
    getHabitsReport(supabase, userId),
  ]);

  const staleThreshold = addDaysISODate(-14);
  const stalledProjects = projects
    .filter((p) => p.hoursInvested === 0 || p.updated_at < `${staleThreshold}T00:00:00.000Z`)
    .map((p) => p.name);

  const inconsistentHabits = habitsReport.habits
    .filter((h) => h.is_active && h.weeklyConsistency < 50)
    .map((h) => h.name);

  const prevStart = addDaysISODate(-14, new Date(`${range.start}T00:00:00Z`));
  const prevEnd = addDaysISODate(-1, new Date(`${range.start}T00:00:00Z`));
  const { data: prevSessions } = await supabase
    .from("learning_sessions")
    .select("duration_minutes")
    .eq("user_id", userId)
    .gte("date", prevStart)
    .lte("date", prevEnd);
  const prevMinutes = (prevSessions ?? []).reduce((t, s) => t + s.duration_minutes, 0);
  const prevHours = prevMinutes / 60;
  const learningDeclinePercent =
    prevHours > 0 ? Math.round(((learningHoursThisPeriod - prevHours) / prevHours) * 100) : null;

  return {
    overdueTasks: overdueRes.count ?? 0,
    stalledProjects,
    inconsistentHabits,
    learningDeclinePercent,
  };
}

export async function getWeeklyReviewData(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DateRange
): Promise<WeeklyReviewData> {
  const [productivity, learning, habitsReport, financeResult, projects] = await Promise.all([
    getProductivityReport(supabase, userId, range, todayISODate()),
    getLearningReport(supabase, userId, range),
    getHabitsReport(supabase, userId),
    getFinanceOverview(supabase, userId, range),
    getProjects(supabase, userId),
  ]);

  const projectsProgressed = projects.filter((p) => p.hoursInvested > 0).length;
  const goalsRes = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", userId)
    .gte("updated_at", `${range.start}T00:00:00.000Z`)
    .lte("updated_at", `${range.end}T23:59:59.999Z`);

  const problems = await detectProblems(supabase, userId, range, learning.totalHours);

  return {
    range: { start: range.start, end: range.end, label: range.label },
    accomplishments: {
      tasksCompleted: productivity.tasksCompleted,
      projectsProgressed,
      learningSessionsLogged: learning.sessionCount,
      goalsProgressed: goalsRes.data?.length ?? 0,
    },
    time: {
      totalHours: productivity.hoursWorked,
      learningHours: learning.totalHours,
      projectHours: productivity.hoursWorked,
    },
    finance: {
      revenue: financeResult.overview.paidRevenue,
      expenses: financeResult.overview.expenses,
      netIncome: financeResult.overview.netIncome,
    },
    habits: {
      completionRate: habitsReport.overallCompletionRate,
      strongest: habitsReport.mostConsistent?.name ?? null,
      weakest: habitsReport.leastConsistent?.name ?? null,
    },
    problems,
  };
}

export interface MonthlyReviewData extends WeeklyReviewData {
  topicsCompleted: number;
  goalProgressAverage: number;
}

export async function getMonthlyReviewData(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DateRange
): Promise<MonthlyReviewData> {
  const [weekly, learning, goalsReport] = await Promise.all([
    getWeeklyReviewData(supabase, userId, range),
    getLearningReport(supabase, userId, range),
    getGoalsReport(supabase, userId, todayISODate(), addDaysISODate(14)),
  ]);

  const goalProgressAverage = goalsReport.goals.length
    ? Math.round(goalsReport.goals.reduce((t, g) => t + g.progress, 0) / goalsReport.goals.length)
    : 0;

  return { ...weekly, topicsCompleted: learning.topicsCompleted, goalProgressAverage };
}
