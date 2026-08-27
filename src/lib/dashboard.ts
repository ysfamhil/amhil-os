import type { SupabaseClient } from "@supabase/supabase-js";
import {
  endOfMonthISODate,
  startOfMonthISODate,
  startOfWeekISODate,
  todayISODate,
  tomorrowISODate,
} from "@/lib/dates";
import { getProjects } from "@/lib/queries/projects";
import { getHabits } from "@/lib/queries/habits";
import { getLearningOverview } from "@/lib/queries/learning";
import { getGoals } from "@/lib/queries/goals";
import { getTimeStats } from "@/lib/queries/time-entries";
import { getFinanceOverview } from "@/lib/queries/finance";
import { computeLeadAnalytics, getLeads } from "@/lib/queries/leads";
import type { Database, Task, TaskStatus } from "@/types/database";

const OPEN_TASK_STATUSES: TaskStatus[] = ["Backlog", "Todo", "In Progress", "Waiting"];
const DEADLINE_HORIZON_DAYS = 14;

function sum(rows: { amount?: number | null }[]) {
  return rows.reduce((total, row) => total + (row.amount ?? 0), 0);
}

export async function getDashboardData(supabase: SupabaseClient<Database>, userId: string) {
  const today = todayISODate();
  const weekStartDate = startOfWeekISODate();
  const monthStart = startOfMonthISODate();
  const monthEnd = endOfMonthISODate();
  const deadlineHorizon = new Date(Date.now() + DEADLINE_HORIZON_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [
    todayTasksRes,
    overdueTasksRes,
    prioritiesRes,
    tasksCompletedWeekRes,
    tasksCompletedTodayRes,
    incomeWeekRes,
    activeProjectsWithStats,
    habits,
    learning,
    goals,
    timeStats,
    financeThisMonth,
    activeClientsRes,
    newClientsThisMonthRes,
    leads,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date")
      .eq("user_id", userId)
      .eq("due_date", today)
      .in("status", OPEN_TASK_STATUSES)
      .order("priority", { ascending: false }),
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date")
      .eq("user_id", userId)
      .lt("due_date", today)
      .in("status", OPEN_TASK_STATUSES)
      .order("due_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date")
      .eq("user_id", userId)
      .in("status", OPEN_TASK_STATUSES)
      .in("priority", ["High", "Urgent"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Done")
      .gte("completed_at", weekStartDate),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Done")
      .gte("completed_at", `${today}T00:00:00.000Z`)
      .lt("completed_at", `${tomorrowISODate()}T00:00:00.000Z`),
    supabase.from("income").select("amount").eq("user_id", userId).gte("date", weekStartDate),
    getProjects(supabase, userId, "Active"),
    getHabits(supabase, userId, { activeOnly: true }),
    getLearningOverview(supabase, userId),
    getGoals(supabase, userId),
    getTimeStats(supabase, userId),
    getFinanceOverview(supabase, userId, { start: monthStart, end: monthEnd }),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "Client"),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", `${monthStart}T00:00:00.000Z`),
    getLeads(supabase, userId),
  ]);

  const activeGoals = goals.filter((g) => g.status === "In Progress" || g.status === "Not Started");
  const goalsNearingDeadline = activeGoals
    .filter((g) => g.target_date && g.target_date <= deadlineHorizon && g.target_date >= today)
    .sort((a, b) => (a.target_date! < b.target_date! ? -1 : 1));

  const leadAnalytics = computeLeadAnalytics(leads);
  const openLeads = leads.filter((l) => !["Won", "Lost"].includes(l.status));

  return {
    today: {
      tasks: (todayTasksRes.data ?? []) as Pick<Task, "id" | "title" | "status" | "priority" | "due_date">[],
      overdueTasks: (overdueTasksRes.data ?? []) as Pick<Task, "id" | "title" | "status" | "priority" | "due_date">[],
      priorities: (prioritiesRes.data ?? []) as Pick<Task, "id" | "title" | "status" | "priority" | "due_date">[],
      habits: habits.map((h) => ({ id: h.id, name: h.name, completedToday: h.completedToday })),
      completedToday: tasksCompletedTodayRes.count ?? 0,
    },
    week: {
      tasksCompleted: tasksCompletedWeekRes.count ?? 0,
      hoursWorked: timeStats.weekHours,
      learningHours: learning.weekMinutes / 60,
      habitConsistency:
        habits.length > 0
          ? Math.round(habits.reduce((t, h) => t + h.weeklyConsistency, 0) / habits.length)
          : 0,
      income: sum((incomeWeekRes.data ?? []) as { amount: number }[]),
    },
    activeProjects: activeProjectsWithStats,
    learning: {
      currentTopics: learning.activeTopics.slice(0, 5),
      totalStudyHours: learning.totalMinutes / 60,
    },
    goals: {
      active: activeGoals.length,
      nearingDeadline: goalsNearingDeadline.slice(0, 4),
    },
    time: {
      todayHours: timeStats.todayHours,
      weekHours: timeStats.weekHours,
    },
    habitsToday: {
      total: habits.length,
      completed: habits.filter((h) => h.completedToday).length,
      list: habits.slice(0, 5),
    },
    finance: {
      monthRevenue: financeThisMonth.overview.paidRevenue,
      monthExpenses: financeThisMonth.overview.expenses,
      netIncome: financeThisMonth.overview.netIncome,
      expectedIncome: financeThisMonth.overview.expectedIncome,
      unpaidIncome: financeThisMonth.overview.invoicedIncome,
    },
    clients: {
      active: activeClientsRes.count ?? 0,
      newThisMonth: newClientsThisMonthRes.count ?? 0,
    },
    leads: {
      open: openLeads.length,
      pipelineValue: leadAnalytics.pipelineValue,
      won: leadAnalytics.won,
    },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
