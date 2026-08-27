import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTimeEntries, getTimeStats } from "@/lib/queries/time-entries";
import { TimeBoard } from "@/components/time/time-board";

export default async function TimePage({
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

  const [entries, stats, projectsRes, tasksRes] = await Promise.all([
    getTimeEntries(supabase, user.id, {
      date: typeof sp.date === "string" ? sp.date : undefined,
      projectId: typeof sp.project === "string" ? sp.project : undefined,
      category: typeof sp.category === "string" ? sp.category : undefined,
    }),
    getTimeStats(supabase, user.id),
    supabase.from("projects").select("id,name").eq("user_id", user.id).order("name"),
    supabase.from("tasks").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Time</h1>
        <p className="text-sm text-muted">Manual time entries across projects, tasks, and categories.</p>
      </div>

      <TimeBoard
        entries={entries}
        stats={stats}
        projects={projectsRes.data ?? []}
        tasks={tasksRes.data ?? []}
      />
    </div>
  );
}
