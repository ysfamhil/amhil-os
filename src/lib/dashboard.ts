import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDaysISODate,
  endOfMonthISODate,
  startOfMonthISODate,
  startOfWeek,
  startOfWeekISODate,
  todayISODate,
  tomorrowISODate,
} from "@/lib/dates";
import { getHabits } from "@/lib/queries/habits";
import { getGoals } from "@/lib/queries/goals";
import { getTimeStats } from "@/lib/queries/time-entries";
import { getFinanceOverview, getMonthlyFinanceTrend } from "@/lib/queries/finance";
import { getEmergencyFundSummary } from "@/lib/queries/emergency-fund";
import { getSubtaskProgressMap } from "@/lib/queries/tasks";
import type { Database, Task, TaskStatus } from "@/types/database";

const OPEN_TASK_STATUSES: TaskStatus[] = ["Backlog", "Todo", "In Progress", "Waiting"];
const DEADLINE_HORIZON_DAYS = 14;

function sum(rows: { amount?: number | null }[]) {
  return rows.reduce((total, row) => total + (row.amount ?? 0), 0);
}

function sumMinutes(rows: { duration_minutes?: number | null }[]) {
  return rows.reduce((total, row) => total + (row.duration_minutes ?? 0), 0);
}

type TaskRow = Pick<Task, "id" | "title" | "status" | "priority" | "due_date" | "category" | "position">;

export async function getDashboardData(supabase: SupabaseClient<Database>, userId: string) {
  const today = todayISODate();
  const weekStartDate = startOfWeekISODate();
  const lastWeekStartDate = addDaysISODate(-7, startOfWeek());
  const monthStart = startOfMonthISODate();
  const monthEnd = endOfMonthISODate();
  const deadlineHorizon = new Date(Date.now() + DEADLINE_HORIZON_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysISODate(i, startOfWeek()));

  const [
    openTasksRes,
    overdueTasksRes,
    prioritiesRes,
    tasksCompletedWeekRes,
    tasksCompletedLastWeekRes,
    tasksCompletedTodayRes,
    incomeWeekRes,
    incomePaidWeekCountRes,
    timeEntriesLastWeekRes,
    timeEntriesThisWeekRes,
    habits,
    goals,
    timeStats,
    financeThisMonth,
    financeTrend,
    habitCompletionsWeekRes,
    recentTimeEntriesRes,
    recentIncomeRes,
    recentExpensesRes,
    recentNotesRes,
    emergencyFund,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date,category,position")
      .eq("user_id", userId)
      .in("status", OPEN_TASK_STATUSES)
      .order("position", { ascending: true })
      .limit(50),
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date,category,position")
      .eq("user_id", userId)
      .lt("due_date", today)
      .in("status", OPEN_TASK_STATUSES)
      .order("due_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date,category,position")
      .eq("user_id", userId)
      .in("status", OPEN_TASK_STATUSES)
      .in("priority", ["High", "Urgent"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("status", "Done")
      .gte("completed_at", weekStartDate),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Done")
      .gte("completed_at", lastWeekStartDate)
      .lt("completed_at", weekStartDate),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Done")
      .gte("completed_at", `${today}T00:00:00.000Z`)
      .lt("completed_at", `${tomorrowISODate()}T00:00:00.000Z`),
    supabase.from("income").select("amount").eq("user_id", userId).gte("date", weekStartDate),
    supabase
      .from("income")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Paid")
      .gte("date", weekStartDate),
    supabase
      .from("time_entries")
      .select("duration_minutes")
      .eq("user_id", userId)
      .gte("date", lastWeekStartDate)
      .lt("date", weekStartDate),
    supabase
      .from("time_entries")
      .select("date,duration_minutes")
      .eq("user_id", userId)
      .gte("date", weekStartDate),
    getHabits(supabase, userId, { activeOnly: true, weekDates }),
    getGoals(supabase, userId),
    getTimeStats(supabase, userId),
    getFinanceOverview(supabase, userId, { start: monthStart, end: monthEnd }),
    getMonthlyFinanceTrend(supabase, userId, 6),
    supabase
      .from("habit_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_completed", true)
      .gte("date", weekStartDate),
    supabase
      .from("time_entries")
      .select("id,date,duration_minutes,category,description,start_time,end_time,tasks(title)")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("income")
      .select("id,amount,date,source,status")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(4),
    supabase
      .from("expenses")
      .select("id,amount,date,category,description")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(4),
    supabase
      .from("notes")
      .select("id,title,content,tags,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    getEmergencyFundSummary(supabase, userId),
  ]);

  const activeGoals = goals.filter((g) => g.status === "In Progress" || g.status === "Not Started");
  const goalsNearingDeadline = activeGoals
    .filter((g) => g.target_date && g.target_date <= deadlineHorizon && g.target_date >= today)
    .sort((a, b) => (a.target_date! < b.target_date! ? -1 : 1));
  const activeGoalsSorted = [...activeGoals].sort((a, b) => a.position - b.position);

  const openTasks = (openTasksRes.data ?? []) as TaskRow[];
  const subtaskProgress = await getSubtaskProgressMap(supabase, userId, openTasks.map((t) => t.id));

  const enrichTask = (task: TaskRow) => ({
    ...task,
    subtasks: subtaskProgress[task.id] ?? null,
  });

  const hoursWorkedLastWeek = sumMinutes((timeEntriesLastWeekRes.data ?? []) as { duration_minutes: number }[]) / 60;

  const tasksCompletedThisWeek = (tasksCompletedWeekRes.data ?? []) as { completed_at: string | null }[];
  const timeEntriesThisWeek = (timeEntriesThisWeekRes.data ?? []) as { date: string; duration_minutes: number }[];
  const tasksSparkline = weekDates.map(
    (date) => tasksCompletedThisWeek.filter((t) => t.completed_at?.slice(0, 10) === date).length
  );
  const hoursSparkline = weekDates.map((date) =>
    Math.round((sumMinutes(timeEntriesThisWeek.filter((e) => e.date === date)) / 60) * 10) / 10
  );
  const habitsSparkline = weekDates.map((date) =>
    habits.length > 0 ? Math.round((habits.filter((h) => h.weekCompletions?.[date]).length / habits.length) * 100) : 0
  );
  const netIncomeSparkline = financeTrend.map((p) => p.revenue - p.expenses);

  type RecentTimeEntry = {
    id: string;
    date: string;
    duration_minutes: number;
    category: string | null;
    description: string | null;
    start_time: string | null;
    end_time: string | null;
    tasks: { title: string } | null;
  };
  const recentTimeEntries = ((recentTimeEntriesRes.data ?? []) as unknown as RecentTimeEntry[]).map((entry) => ({
    id: entry.id,
    date: entry.date,
    durationMinutes: entry.duration_minutes,
    category: entry.category,
    label: entry.tasks?.title ?? entry.description ?? entry.category ?? "Time logged",
    startTime: entry.start_time,
    endTime: entry.end_time,
  }));

  type RecentTransaction = {
    id: string;
    date: string;
    amount: number;
    label: string;
    type: "income" | "expense";
  };
  const recentIncome: RecentTransaction[] = ((recentIncomeRes.data ?? []) as { id: string; amount: number; date: string; source: string | null; status: string }[]).map(
    (i) => ({ id: i.id, date: i.date, amount: i.amount, label: i.source ?? i.status, type: "income" })
  );
  const recentExpenses: RecentTransaction[] = ((recentExpensesRes.data ?? []) as { id: string; amount: number; date: string; category: string | null; description: string | null }[]).map(
    (e) => ({ id: e.id, date: e.date, amount: e.amount, label: e.description ?? e.category ?? "Expense", type: "expense" })
  );
  const recentTransactions = [...recentIncome, ...recentExpenses].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  type RecentNote = { id: string; title: string; content: string | null; tags: string[]; created_at: string };
  const recentNotes = (recentNotesRes.data ?? []) as RecentNote[];

  return {
    today: {
      tasks: openTasks.map(enrichTask),
      overdueTasks: ((overdueTasksRes.data ?? []) as TaskRow[]).map(enrichTask),
      priorities: (prioritiesRes.data ?? []) as TaskRow[],
      habits: habits.map((h) => ({ id: h.id, name: h.name, completedToday: h.completedToday, currentStreak: h.currentStreak })),
      completedToday: tasksCompletedTodayRes.count ?? 0,
    },
    week: {
      tasksCompleted: tasksCompletedThisWeek.length,
      tasksCompletedDelta: tasksCompletedThisWeek.length - (tasksCompletedLastWeekRes.count ?? 0),
      tasksSparkline,
      hoursSparkline,
      habitsSparkline,
      hoursWorked: timeStats.weekHours,
      hoursWorkedDelta: timeStats.weekHours - hoursWorkedLastWeek,
      habitConsistency:
        habits.length > 0
          ? Math.round(habits.reduce((t, h) => t + h.weeklyConsistency, 0) / habits.length)
          : 0,
      habitCompletions: habitCompletionsWeekRes.count ?? 0,
      habitPossible: habits.length * 7,
      income: sum((incomeWeekRes.data ?? []) as { amount: number }[]),
      incomePaidCount: incomePaidWeekCountRes.count ?? 0,
    },
    goals: {
      active: activeGoals.length,
      nearingDeadline: goalsNearingDeadline.slice(0, 4),
      activeList: activeGoalsSorted.slice(0, 6),
    },
    time: {
      todayHours: timeStats.todayHours,
      weekHours: timeStats.weekHours,
      recentEntries: recentTimeEntries,
    },
    habitsToday: {
      total: habits.length,
      completed: habits.filter((h) => h.completedToday).length,
      bestStreak: habits.reduce((max, h) => Math.max(max, h.bestStreak), 0),
      list: habits.slice(0, 8),
    },
    habitsWeek: {
      weekDates,
      list: habits,
    },
    finance: {
      monthRevenue: financeThisMonth.overview.paidRevenue,
      monthExpenses: financeThisMonth.overview.expenses,
      netIncome: financeThisMonth.overview.netIncome,
      expectedIncome: financeThisMonth.overview.expectedIncome,
      unpaidIncome: financeThisMonth.overview.invoicedIncome,
      recentTransactions,
      netIncomeSparkline,
    },
    notes: {
      recent: recentNotes,
    },
    emergencyFund,
    financeTrend,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
