import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDistinctTags,
  getSubtaskProgressMap,
  getTaskTimeLoggedMap,
  getTasks,
  getTaskTabCounts,
  type TaskTab,
} from "@/lib/queries/tasks";
import { getGoals } from "@/lib/queries/goals";
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
  const tabParam = typeof sp.tab === "string" ? sp.tab : "all";
  const tab: TaskTab = VALID_TABS.includes(tabParam as TaskTab) ? (tabParam as TaskTab) : "all";
  const priorities = typeof sp.priority === "string" ? (sp.priority.split(",") as TaskPriority[]) : undefined;
  const tags = typeof sp.tag === "string" ? sp.tag.split(",") : undefined;

  const [tasks, counts, allTags, goals] = await Promise.all([
    getTasks(supabase, user.id, {
      tab,
      q: typeof sp.q === "string" ? sp.q : undefined,
      priorities,
      tags,
      sort: typeof sp.sort === "string" ? (sp.sort as "due_date" | "created_at" | "priority") : undefined,
    }),
    getTaskTabCounts(supabase, user.id),
    getDistinctTags(supabase, user.id),
    getGoals(supabase, user.id),
  ]);

  const [subtaskProgress, timeLogged] = await Promise.all([
    getSubtaskProgressMap(
      supabase,
      user.id,
      tasks.map((t) => t.id)
    ),
    getTaskTimeLoggedMap(
      supabase,
      user.id,
      tasks.map((t) => t.id)
    ),
  ]);

  const goalSuggestions = goals
    .filter((g) => g.linkedTasks === 0 && (g.status === "In Progress" || g.status === "Not Started"))
    .slice(0, 3)
    .map((g) => ({ id: g.id, title: g.title, category: g.category }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="h-[28px] w-[5px] shrink-0 rounded-full bg-[var(--domain-tasks)]" />
        <div>
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em]">Tasks</h1>
          <p className="mt-1.5 text-[13px] text-muted">Everything you need to do, in one place.</p>
        </div>
      </div>

      <TaskBoard
        tasks={tasks}
        counts={counts}
        subtaskProgress={subtaskProgress}
        timeLogged={timeLogged}
        tags={allTags}
        goalSuggestions={goalSuggestions}
      />
    </div>
  );
}
