import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DateRange } from "@/lib/date-ranges";
import { addDaysISODate } from "@/lib/dates";
import { getHabits, type HabitWithStats } from "@/lib/queries/habits";
import { getGoals, type GoalWithProgress } from "@/lib/queries/goals";
import { getProjects, type ProjectWithStats } from "@/lib/queries/projects";
import { getFinanceOverview, type FinanceOverview, type FinanceBreakdowns } from "@/lib/queries/finance";

function daysBetween(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

/** Buckets a set of dated rows into daily points if the range is short enough
 * to read as a day-by-day chart, otherwise monthly — a 365-bar daily chart
 * would be noise, not insight. */
function bucketDates(dates: string[], range: DateRange): { label: string; count: number }[] {
  const span = daysBetween(range.start, range.end);
  const buckets = new Map<string, number>();

  if (span <= 31) {
    const cursor = new Date(`${range.start}T00:00:00Z`);
    const endDate = new Date(`${range.end}T00:00:00Z`);
    while (cursor <= endDate) {
      buckets.set(cursor.toISOString().slice(0, 10), 0);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    for (const d of dates) {
      const key = d.slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([key, count]) => ({
      label: new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count,
    }));
  }

  const cursor = new Date(`${range.start}T00:00:00Z`);
  const endDate = new Date(`${range.end}T00:00:00Z`);
  while (cursor <= endDate) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, 0);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const d of dates) {
    const key = d.slice(0, 7);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([key, count]) => ({
    label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
    count,
  }));
}

// ---------------------------------------------------------------------------
// Productivity
// ---------------------------------------------------------------------------

export interface ProductivityReport {
  tasksCompleted: number;
  tasksCreated: number;
  overdueTasks: number;
  completionRate: number;
  hoursWorked: number;
  productiveDays: number;
  avgCompletedPerDay: number;
  /** Average time from creation to completion, for tasks completed in this
   * range — null when there's nothing completed to average. */
  avgCompletionTimeHours: number | null;
  /** Estimated vs. actually-logged minutes, for tasks completed in this
   * range that had an estimate — null fields when there's no estimated data
   * to compare against (never fabricated). */
  plannedVsActualMinutes: { plannedMinutes: number; actualMinutes: number } | null;
  trend: { label: string; count: number }[];
}

export async function getProductivityReport(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DateRange,
  today: string
): Promise<ProductivityReport> {
  const rangeStartTs = `${range.start}T00:00:00.000Z`;
  const rangeEndTs = `${range.end}T23:59:59.999Z`;

  const [completedRes, createdRes, overdueRes, timeRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,completed_at,created_at,estimated_minutes")
      .eq("user_id", userId)
      .eq("status", "Done")
      .gte("completed_at", rangeStartTs)
      .lte("completed_at", rangeEndTs),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", rangeStartTs)
      .lte("created_at", rangeEndTs),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lt("due_date", today)
      .not("status", "in", "(Done,Cancelled)"),
    supabase.from("time_entries").select("date,duration_minutes").eq("user_id", userId).gte("date", range.start).lte("date", range.end),
  ]);

  const completed = (completedRes.data ?? []) as {
    id: string;
    completed_at: string;
    created_at: string;
    estimated_minutes: number | null;
  }[];
  const timeEntries = (timeRes.data ?? []) as { date: string; duration_minutes: number }[];

  const completionDurationsHours = completed.map(
    (t) => (Date.parse(t.completed_at) - Date.parse(t.created_at)) / (1000 * 60 * 60)
  );
  const avgCompletionTimeHours = completionDurationsHours.length
    ? Math.round((completionDurationsHours.reduce((a, b) => a + b, 0) / completionDurationsHours.length) * 10) / 10
    : null;

  const withEstimates = completed.filter((t) => t.estimated_minutes != null);
  let plannedVsActualMinutes: { plannedMinutes: number; actualMinutes: number } | null = null;
  if (withEstimates.length) {
    // Actual minutes worked is always derived live from time_entries — the
    // tasks.actual_minutes column is never written to and would silently
    // show 0 for every task if read directly.
    const { data: loggedTime } = await supabase
      .from("time_entries")
      .select("task_id,duration_minutes")
      .eq("user_id", userId)
      .in(
        "task_id",
        withEstimates.map((t) => t.id)
      );
    const actualByTask = new Map<string, number>();
    for (const entry of (loggedTime ?? []) as { task_id: string | null; duration_minutes: number }[]) {
      if (!entry.task_id) continue;
      actualByTask.set(entry.task_id, (actualByTask.get(entry.task_id) ?? 0) + entry.duration_minutes);
    }
    plannedVsActualMinutes = {
      plannedMinutes: withEstimates.reduce((t, task) => t + (task.estimated_minutes ?? 0), 0),
      actualMinutes: withEstimates.reduce((t, task) => t + (actualByTask.get(task.id) ?? 0), 0),
    };
  }

  const tasksCreated = createdRes.count ?? 0;
  const tasksCompleted = completed.length;
  const productiveDays = new Set([...completed.map((t) => t.completed_at.slice(0, 10)), ...timeEntries.map((t) => t.date)]).size;
  const spanDays = daysBetween(range.start, range.end);

  return {
    tasksCompleted,
    tasksCreated,
    overdueTasks: overdueRes.count ?? 0,
    completionRate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0,
    hoursWorked: timeEntries.reduce((t, e) => t + e.duration_minutes, 0) / 60,
    productiveDays,
    avgCompletedPerDay: spanDays > 0 ? Math.round((tasksCompleted / spanDays) * 10) / 10 : 0,
    avgCompletionTimeHours,
    plannedVsActualMinutes,
    trend: bucketDates(completed.map((t) => t.completed_at), range),
  };
}

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

export interface LearningReport {
  totalHours: number;
  sessionCount: number;
  topicsCompleted: number;
  topicsInProgress: number;
  averageConfidence: number | null;
  confidenceChange: number | null;
  byTopic: { name: string; areaName: string; progress: number; hours: number }[];
  byArea: { name: string; hours: number }[];
  trend: { label: string; count: number }[];
  /** Hours per 7-day week, averaged over the selected range. */
  velocityHoursPerWeek: number;
  /** Completed / total topics that have ever had at least one session — a
   * topic with zero sessions was never really "started", so it's excluded
   * rather than dragging the rate down with topics that don't apply yet. */
  topicCompletionRate: number | null;
  /** Days with at least one session / days in range. */
  consistencyPercent: number;
}

export async function getLearningReport(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DateRange
): Promise<LearningReport> {
  const [sessionsRes, topicsRes] = await Promise.all([
    supabase
      .from("learning_sessions")
      .select("date,duration_minutes,topic_id,confidence_before,confidence_after")
      .eq("user_id", userId)
      .gte("date", range.start)
      .lte("date", range.end),
    supabase
      .from("learning_topics")
      .select("id,name,status,progress,confidence,completed_at,area_id,learning_areas(name)")
      .eq("user_id", userId),
  ]);

  const sessions = (sessionsRes.data ?? []) as {
    date: string;
    duration_minutes: number;
    topic_id: string;
    confidence_before: number | null;
    confidence_after: number | null;
  }[];
  const topics = (topicsRes.data ?? []) as unknown as {
    id: string;
    name: string;
    status: string;
    progress: number;
    confidence: number | null;
    completed_at: string | null;
    area_id: string;
    learning_areas: { name: string } | null;
  }[];

  const topicsCompleted = topics.filter(
    (t) => t.status === "Completed" && t.completed_at && t.completed_at >= `${range.start}T00:00:00.000Z` && t.completed_at <= `${range.end}T23:59:59.999Z`
  ).length;
  const topicsInProgress = topics.filter((t) => t.status === "Learning" || t.status === "Practicing").length;

  const confidences = topics.map((t) => t.confidence).filter((c): c is number => c != null);
  const averageConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;

  const changes = sessions
    .filter((s) => s.confidence_before != null && s.confidence_after != null)
    .map((s) => s.confidence_after! - s.confidence_before!);
  const confidenceChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;

  const minutesByTopic = new Map<string, number>();
  for (const s of sessions) {
    minutesByTopic.set(s.topic_id, (minutesByTopic.get(s.topic_id) ?? 0) + s.duration_minutes);
  }

  const byTopic = topics
    .map((t) => ({
      name: t.name,
      areaName: t.learning_areas?.name ?? "",
      progress: t.progress,
      hours: (minutesByTopic.get(t.id) ?? 0) / 60,
    }))
    .filter((t) => t.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const minutesByArea = new Map<string, number>();
  for (const s of sessions) {
    const topic = topics.find((t) => t.id === s.topic_id);
    const areaName = topic?.learning_areas?.name ?? "Unknown area";
    minutesByArea.set(areaName, (minutesByArea.get(areaName) ?? 0) + s.duration_minutes);
  }
  const byArea = [...minutesByArea.entries()]
    .map(([name, minutes]) => ({ name, hours: minutes / 60 }))
    .sort((a, b) => b.hours - a.hours);

  const totalHours = sessions.reduce((t, s) => t + s.duration_minutes, 0) / 60;
  const spanDays = daysBetween(range.start, range.end);
  const velocityHoursPerWeek = spanDays > 0 ? Math.round((totalHours / spanDays) * 7 * 10) / 10 : 0;

  const topicsWithSessions = new Set(sessions.map((s) => s.topic_id));
  const startedTopics = topics.filter((t) => topicsWithSessions.has(t.id) || t.status !== "Not Started");
  const topicCompletionRate = startedTopics.length
    ? Math.round((startedTopics.filter((t) => t.status === "Completed").length / startedTopics.length) * 100)
    : null;

  const daysWithSessions = new Set(sessions.map((s) => s.date)).size;
  const consistencyPercent = spanDays > 0 ? Math.round((daysWithSessions / spanDays) * 100) : 0;

  return {
    totalHours,
    sessionCount: sessions.length,
    topicsCompleted,
    topicsInProgress,
    averageConfidence,
    confidenceChange,
    byTopic,
    byArea,
    trend: bucketDates(sessions.map((s) => s.date), range),
    velocityHoursPerWeek,
    topicCompletionRate,
    consistencyPercent,
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ProjectsReport {
  active: number;
  completed: number;
  byStatus: { status: string; count: number }[];
  totalHours: number;
  averageProgress: number;
  breakdowns: FinanceBreakdowns["byProject"];
  projects: ProjectWithStats[];
  /** Estimated vs. actually-invested hours, summed across projects that
   * have an estimate set — null when none do. */
  plannedVsActualHours: { plannedHours: number; actualHours: number } | null;
  /** Revenue and profit per hour invested, per project with hours logged. */
  efficiencyByProject: { name: string; revenuePerHour: number; profitPerHour: number }[];
}

export async function getProjectsReport(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DateRange
): Promise<ProjectsReport> {
  const [projects, timeRes, financeResult] = await Promise.all([
    getProjects(supabase, userId),
    supabase.from("time_entries").select("duration_minutes").eq("user_id", userId).gte("date", range.start).lte("date", range.end),
    getFinanceOverview(supabase, userId, range),
  ]);

  const timeEntries = (timeRes.data ?? []) as { duration_minutes: number }[];
  const byStatusMap = new Map<string, number>();
  for (const p of projects) byStatusMap.set(p.status, (byStatusMap.get(p.status) ?? 0) + 1);

  const withEstimates = projects.filter((p) => p.estimated_hours != null);
  const plannedVsActualHours = withEstimates.length
    ? {
        plannedHours: withEstimates.reduce((t, p) => t + (p.estimated_hours ?? 0), 0),
        actualHours: withEstimates.reduce((t, p) => t + p.hoursInvested, 0),
      }
    : null;

  const efficiencyByProject = projects
    .filter((p) => p.hoursInvested > 0)
    .map((p) => ({
      name: p.name,
      revenuePerHour: Math.round((p.revenue / p.hoursInvested) * 100) / 100,
      profitPerHour: Math.round((p.profit / p.hoursInvested) * 100) / 100,
    }))
    .sort((a, b) => b.profitPerHour - a.profitPerHour);

  return {
    active: projects.filter((p) => p.status === "Active").length,
    completed: projects.filter((p) => p.status === "Completed").length,
    byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    totalHours: timeEntries.reduce((t, e) => t + e.duration_minutes, 0) / 60,
    averageProgress: projects.length ? Math.round(projects.reduce((t, p) => t + p.progress, 0) / projects.length) : 0,
    breakdowns: financeResult.breakdowns.byProject,
    projects,
    plannedVsActualHours,
    efficiencyByProject,
  };
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export interface HabitsReport {
  overallCompletionRate: number;
  habits: HabitWithStats[];
  mostConsistent: HabitWithStats | null;
  leastConsistent: HabitWithStats | null;
}

export async function getHabitsReport(supabase: SupabaseClient<Database>, userId: string): Promise<HabitsReport> {
  const habits = await getHabits(supabase, userId, { activeOnly: false });
  const active = habits.filter((h) => h.is_active);

  const sorted = [...active].sort((a, b) => b.weeklyConsistency - a.weeklyConsistency);

  return {
    overallCompletionRate: active.length ? Math.round(active.reduce((t, h) => t + h.completionRate, 0) / active.length) : 0,
    habits,
    mostConsistent: sorted[0] ?? null,
    leastConsistent: sorted.length > 1 ? sorted[sorted.length - 1] : null,
  };
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface GoalsReport {
  active: number;
  completed: number;
  nearingDeadline: GoalWithProgress[];
  byCategory: { category: string; count: number }[];
  goals: GoalWithProgress[];
}

export async function getGoalsReport(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
  horizonDate: string
): Promise<GoalsReport> {
  const goals = await getGoals(supabase, userId);

  const byCategoryMap = new Map<string, number>();
  for (const g of goals) {
    const cat = g.category || "Uncategorized";
    byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + 1);
  }

  return {
    active: goals.filter((g) => g.status === "In Progress" || g.status === "Not Started").length,
    completed: goals.filter((g) => g.status === "Completed").length,
    nearingDeadline: goals.filter(
      (g) => (g.status === "In Progress" || g.status === "Not Started") && g.target_date && g.target_date <= horizonDate && g.target_date >= today
    ),
    byCategory: [...byCategoryMap.entries()].map(([category, count]) => ({ category, count })),
    goals,
  };
}

// ---------------------------------------------------------------------------
// Cross-system analytics
// ---------------------------------------------------------------------------

export interface CrossSystemReport {
  work: { tasksCompleted: number; hoursWorked: number };
  learning: { hours: number; topicsCompleted: number; averageConfidence: number | null };
  projects: { tasksCompleted: number; hours: number; revenue: number; expenses: number };
  freelance: { newLeads: number; newClients: number; activeProjects: number; paidRevenue: number };
  financialProductivity: { revenuePerHour: number | null; revenue: number; hoursWorked: number };
}

export async function getCrossSystemReport(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DateRange
): Promise<CrossSystemReport> {
  const rangeStartTs = `${range.start}T00:00:00.000Z`;
  const rangeEndTs = `${range.end}T23:59:59.999Z`;

  const [
    tasksCompletedRes,
    projectTasksRes,
    timeRes,
    learningRes,
    topicsCompletedRes,
    financeResult,
    leadsRes,
    clientsRes,
    activeProjectsRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Done")
      .gte("completed_at", rangeStartTs)
      .lte("completed_at", rangeEndTs),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Done")
      .not("project_id", "is", null)
      .gte("completed_at", rangeStartTs)
      .lte("completed_at", rangeEndTs),
    supabase.from("time_entries").select("duration_minutes,project_id").eq("user_id", userId).gte("date", range.start).lte("date", range.end),
    supabase.from("learning_sessions").select("duration_minutes").eq("user_id", userId).gte("date", range.start).lte("date", range.end),
    supabase
      .from("learning_topics")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "Completed")
      .gte("completed_at", rangeStartTs)
      .lte("completed_at", rangeEndTs),
    getFinanceOverview(supabase, userId, range),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", rangeStartTs).lte("created_at", rangeEndTs),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", rangeStartTs).lte("created_at", rangeEndTs),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "Active"),
  ]);

  const timeEntries = (timeRes.data ?? []) as { duration_minutes: number; project_id: string | null }[];
  const learningSessions = (learningRes.data ?? []) as { duration_minutes: number }[];
  const hoursWorked = timeEntries.reduce((t, e) => t + e.duration_minutes, 0) / 60;
  const projectHours = timeEntries.filter((e) => e.project_id).reduce((t, e) => t + e.duration_minutes, 0) / 60;

  const topics = (await supabase.from("learning_topics").select("confidence").eq("user_id", userId)).data ?? [];
  const confidences = (topics as { confidence: number | null }[]).map((t) => t.confidence).filter((c): c is number => c != null);
  const averageConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;

  return {
    work: { tasksCompleted: tasksCompletedRes.count ?? 0, hoursWorked },
    learning: {
      hours: learningSessions.reduce((t, s) => t + s.duration_minutes, 0) / 60,
      topicsCompleted: topicsCompletedRes.count ?? 0,
      averageConfidence,
    },
    projects: {
      tasksCompleted: projectTasksRes.count ?? 0,
      hours: projectHours,
      revenue: financeResult.overview.paidRevenue,
      expenses: financeResult.overview.expenses,
    },
    freelance: {
      newLeads: leadsRes.count ?? 0,
      newClients: clientsRes.count ?? 0,
      activeProjects: activeProjectsRes.count ?? 0,
      paidRevenue: financeResult.overview.paidRevenue,
    },
    financialProductivity: {
      revenuePerHour: hoursWorked > 0 ? Math.round((financeResult.overview.paidRevenue / hoursWorked) * 100) / 100 : null,
      revenue: financeResult.overview.paidRevenue,
      hoursWorked,
    },
  };
}

// ---------------------------------------------------------------------------
// Finance — advanced analytics
// ---------------------------------------------------------------------------

export interface FinanceAdvancedMetrics {
  /** % change in paid revenue vs. the immediately preceding period of equal
   * length — null when the prior period has no revenue to compare against. */
  revenueGrowthPercent: number | null;
  /** Top client's share of paid revenue in this period, 0-100 — null with
   * no paid revenue at all. */
  revenueConcentrationPercent: number | null;
  topClientName: string | null;
  /** Average paid amount per client with at least one paid record. */
  averageProjectValue: number | null;
}

export async function getFinanceAdvancedMetrics(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DateRange
): Promise<FinanceAdvancedMetrics> {
  const spanDays = daysBetween(range.start, range.end);
  const prevEnd = addDaysISODate(-1, new Date(`${range.start}T00:00:00Z`));
  const prevStart = addDaysISODate(-spanDays, new Date(`${range.start}T00:00:00Z`));

  const [current, previous] = await Promise.all([
    getFinanceOverview(supabase, userId, range),
    getFinanceOverview(supabase, userId, { start: prevStart, end: prevEnd }),
  ]);

  const revenueGrowthPercent =
    previous.overview.paidRevenue > 0
      ? Math.round(((current.overview.paidRevenue - previous.overview.paidRevenue) / previous.overview.paidRevenue) * 100)
      : null;

  const totalRevenue = current.breakdowns.byClient.reduce((t, c) => t + c.revenue, 0);
  const topClient = current.breakdowns.byClient[0] ?? null;
  const revenueConcentrationPercent = totalRevenue > 0 && topClient ? Math.round((topClient.revenue / totalRevenue) * 100) : null;

  const projectRevenues = current.breakdowns.byProject.filter((p) => p.revenue > 0);
  const averageProjectValue = projectRevenues.length
    ? Math.round(projectRevenues.reduce((t, p) => t + p.revenue, 0) / projectRevenues.length)
    : null;

  return {
    revenueGrowthPercent,
    revenueConcentrationPercent,
    topClientName: topClient?.label ?? null,
    averageProjectValue,
  };
}

export type { FinanceOverview, FinanceBreakdowns };
