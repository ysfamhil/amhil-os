import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Goal, Habit, Task } from "@/types/database";

export interface GoalProgress {
  progress: number;
  source: "tasks" | "manual";
  linkedTasks: number;
  linkedHabits: number;
}

export type GoalWithProgress = Goal & GoalProgress;

/**
 * Progress is derived from linked tasks where possible (task completion is
 * the most granular real signal), falling back to the manually-set
 * `progress` column when no tasks are linked yet. Habits are shown as a
 * connection but don't feed the percentage — a habit streak isn't
 * commensurable with task completion.
 */
function computeProgress(goal: Goal, tasks: Pick<Task, "status">[]): GoalProgress {
  if (tasks.length > 0) {
    const completed = tasks.filter((t) => t.status === "Done").length;
    return {
      progress: Math.round((completed / tasks.length) * 100),
      source: "tasks",
      linkedTasks: tasks.length,
      linkedHabits: 0,
    };
  }
  return {
    progress: goal.progress,
    source: "manual",
    linkedTasks: 0,
    linkedHabits: 0,
  };
}

export async function getGoals(supabase: SupabaseClient<Database>, userId: string): Promise<GoalWithProgress[]> {
  const { data: goals, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!goals || goals.length === 0) return [];

  const goalIds = goals.map((g) => g.id);

  const [tasksRes, habitsRes] = await Promise.all([
    supabase.from("tasks").select("goal_id,status").eq("user_id", userId).in("goal_id", goalIds),
    supabase.from("habits").select("goal_id").eq("user_id", userId).in("goal_id", goalIds),
  ]);

  const tasks = (tasksRes.data ?? []) as { goal_id: string; status: Task["status"] }[];
  const habits = (habitsRes.data ?? []) as { goal_id: string }[];

  return goals.map((goal) => {
    const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
    const result = computeProgress(goal, goalTasks);
    result.linkedHabits = habits.filter((h) => h.goal_id === goal.id).length;
    return { ...goal, ...result };
  });
}

export interface GoalDetail extends GoalWithProgress {
  tasks: Task[];
  habits: Habit[];
}

export async function getGoalById(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<GoalDetail | null> {
  const { data: goal, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!goal) return null;

  const [tasksRes, habitsRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("user_id", userId).eq("goal_id", id).order("created_at", { ascending: false }),
    supabase.from("habits").select("*").eq("user_id", userId).eq("goal_id", id),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const habits = (habitsRes.data ?? []) as Habit[];

  const result = computeProgress(goal, tasks);
  result.linkedHabits = habits.length;

  return { ...goal, ...result, tasks, habits };
}
