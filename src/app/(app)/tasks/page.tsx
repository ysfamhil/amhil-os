import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubtaskProgressMap, getTasks, getTaskTabCounts, type TaskTab } from "@/lib/queries/tasks";
import { TaskBoard } from "@/components/tasks/task-board";
import type { TaskPriority } from "@/types/database";

const VALID_TABS: TaskTab[] = ["today", "upcoming", "overdue", "completed", "all"];

export default async function TasksPage({
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
  const tabParam = typeof sp.tab === "string" ? sp.tab : "today";
  const tab: TaskTab = VALID_TABS.includes(tabParam as TaskTab) ? (tabParam as TaskTab) : "today";

  const [tasks, counts, projectsRes, goalsRes] = await Promise.all([
    getTasks(supabase, user.id, {
      tab,
      q: typeof sp.q === "string" ? sp.q : undefined,
      projectId: typeof sp.project === "string" ? sp.project : undefined,
      priority: typeof sp.priority === "string" ? (sp.priority as TaskPriority) : undefined,
      sort: typeof sp.sort === "string" ? (sp.sort as "due_date" | "created_at" | "priority") : undefined,
    }),
    getTaskTabCounts(supabase, user.id),
    supabase.from("projects").select("id,name").eq("user_id", user.id).order("name"),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  const subtaskProgress = await getSubtaskProgressMap(
    supabase,
    user.id,
    tasks.map((t) => t.id)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted">Everything you need to do, in one place.</p>
      </div>

      <TaskBoard
        tasks={tasks}
        counts={counts}
        subtaskProgress={subtaskProgress}
        projects={projectsRes.data ?? []}
        goals={goalsRes.data ?? []}
      />
    </div>
  );
}
