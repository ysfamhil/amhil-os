import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Goal, Habit, LearningTopic, Project, Task } from "@/types/database";

export interface GoalProgress {
  progress: number;
  source: "tasks" | "projects" | "manual";
  linkedTasks: number;
  linkedProjects: number;
  linkedTopics: number;
  linkedHabits: number;
}

export type GoalWithProgress = Goal & GoalProgress;

/**
 * Progress is derived from connected work where possible: task completion
 * first (the most granular signal), project completion as a fallback, and
 * the manually-set `progress` column when nothing is linked yet. Learning
 * topics and habits are shown as connections but don't feed the percentage —
 * "topic 60% understood" and "habit streak" aren't commensurable with task
 * completion, and blending them would make the number harder to trust, not
 * more accurate.
 */
function computeProgress(
  goal: Goal,
  tasks: Pick<Task, "status">[],
  projects: Pick<Project, "status">[]
): GoalProgress {
  if (tasks.length > 0) {
    const completed = tasks.filter((t) => t.status === "Done").length;
    return {
      progress: Math.round((completed / tasks.length) * 100),
      source: "tasks",
      linkedTasks: tasks.length,
      linkedProjects: projects.length,
      linkedTopics: 0,
      linkedHabits: 0,
    };
  }
  if (projects.length > 0) {
    const completed = projects.filter((p) => p.status === "Completed").length;
    return {
      progress: Math.round((completed / projects.length) * 100),
      source: "projects",
      linkedTasks: 0,
      linkedProjects: projects.length,
      linkedTopics: 0,
      linkedHabits: 0,
    };
  }
  return {
    progress: goal.progress,
    source: "manual",
    linkedTasks: 0,
    linkedProjects: 0,
    linkedTopics: 0,
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

  const [tasksRes, projectsRes, topicsRes, habitsRes] = await Promise.all([
    supabase.from("tasks").select("goal_id,status").eq("user_id", userId).in("goal_id", goalIds),
    supabase.from("projects").select("goal_id,status").eq("user_id", userId).in("goal_id", goalIds),
    supabase.from("learning_topics").select("goal_id").eq("user_id", userId).in("goal_id", goalIds),
    supabase.from("habits").select("goal_id").eq("user_id", userId).in("goal_id", goalIds),
  ]);

  const tasks = (tasksRes.data ?? []) as { goal_id: string; status: Task["status"] }[];
  const projects = (projectsRes.data ?? []) as { goal_id: string; status: Project["status"] }[];
  const topics = (topicsRes.data ?? []) as { goal_id: string }[];
  const habits = (habitsRes.data ?? []) as { goal_id: string }[];

  return goals.map((goal) => {
    const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
    const goalProjects = projects.filter((p) => p.goal_id === goal.id);
    const result = computeProgress(goal, goalTasks, goalProjects);
    result.linkedTopics = topics.filter((t) => t.goal_id === goal.id).length;
    result.linkedHabits = habits.filter((h) => h.goal_id === goal.id).length;
    return { ...goal, ...result };
  });
}

export interface GoalDetail extends GoalWithProgress {
  tasks: Task[];
  projects: Project[];
  topics: LearningTopic[];
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

  const [tasksRes, projectsRes, topicsRes, habitsRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("user_id", userId).eq("goal_id", id).order("created_at", { ascending: false }),
    supabase.from("projects").select("*").eq("user_id", userId).eq("goal_id", id).order("created_at", { ascending: false }),
    supabase.from("learning_topics").select("*").eq("user_id", userId).eq("goal_id", id),
    supabase.from("habits").select("*").eq("user_id", userId).eq("goal_id", id),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const projects = (projectsRes.data ?? []) as Project[];
  const topics = (topicsRes.data ?? []) as LearningTopic[];
  const habits = (habitsRes.data ?? []) as Habit[];

  const result = computeProgress(goal, tasks, projects);
  result.linkedTopics = topics.length;
  result.linkedHabits = habits.length;

  return { ...goal, ...result, tasks, projects, topics, habits };
}
