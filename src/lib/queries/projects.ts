import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Project, ProjectStatus, Task } from "@/types/database";
import { todayISODate } from "@/lib/dates";

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  overdueTasks: number;
  progress: number;
  hoursInvested: number;
  /** Paid income for this project — kept as the "headline" revenue figure
   * shown on cards, consistent with Finance's "Actual Revenue = Paid only". */
  revenue: number;
  expectedRevenue: number;
  expenses: number;
  /** revenue (paid) - expenses. Always derived, never stored. */
  profit: number;
  incomeCount: number;
  expenseCount: number;
}

export type ProjectWithStats = Project & ProjectStats;

async function attachStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  projects: Project[]
): Promise<ProjectWithStats[]> {
  const projectIds = projects.map((p) => p.id);
  if (projectIds.length === 0) return [];

  const today = todayISODate();

  const [tasksRes, timeRes, incomeRes, expensesRes] = await Promise.all([
    supabase.from("tasks").select("id,project_id,status,due_date").eq("user_id", userId).in("project_id", projectIds),
    supabase
      .from("time_entries")
      .select("project_id,duration_minutes")
      .eq("user_id", userId)
      .in("project_id", projectIds),
    supabase.from("income").select("project_id,amount,status").eq("user_id", userId).in("project_id", projectIds),
    supabase.from("expenses").select("project_id,amount").eq("user_id", userId).in("project_id", projectIds),
  ]);

  const tasks = (tasksRes.data ?? []) as Pick<Task, "id" | "project_id" | "status" | "due_date">[];
  const timeEntries = (timeRes.data ?? []) as { project_id: string; duration_minutes: number }[];
  const income = (incomeRes.data ?? []) as { project_id: string; amount: number; status: string }[];
  const projectExpenses = (expensesRes.data ?? []) as { project_id: string; amount: number }[];

  return projects.map((project) => {
    const projectTasks = tasks.filter((t) => t.project_id === project.id);
    const completedTasks = projectTasks.filter((t) => t.status === "Done").length;
    const overdueTasks = projectTasks.filter(
      (t) => t.due_date !== null && t.due_date < today && t.status !== "Done" && t.status !== "Cancelled"
    ).length;
    const totalTasks = projectTasks.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const minutes = timeEntries
      .filter((t) => t.project_id === project.id)
      .reduce((sum, t) => sum + t.duration_minutes, 0);
    const projectIncome = income.filter((i) => i.project_id === project.id);
    const revenue = projectIncome.filter((i) => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);
    const expectedRevenue = projectIncome
      .filter((i) => i.status === "Expected" || i.status === "Invoiced")
      .reduce((sum, i) => sum + i.amount, 0);
    const expenses = projectExpenses
      .filter((e) => e.project_id === project.id)
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      ...project,
      totalTasks,
      completedTasks,
      remainingTasks: totalTasks - completedTasks,
      overdueTasks,
      progress,
      hoursInvested: minutes / 60,
      revenue,
      expectedRevenue,
      expenses,
      profit: revenue - expenses,
      incomeCount: projectIncome.length,
      expenseCount: projectExpenses.filter((e) => e.project_id === project.id).length,
    };
  });
}

export async function getProjects(
  supabase: SupabaseClient<Database>,
  userId: string,
  status?: ProjectStatus
): Promise<ProjectWithStats[]> {
  let query = supabase.from("projects").select("*").eq("user_id", userId);
  if (status) query = query.eq("status", status);
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return attachStats(supabase, userId, data ?? []);
}

export async function getProjectById(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<ProjectWithStats | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [withStats] = await attachStats(supabase, userId, [data]);
  return withStats;
}
