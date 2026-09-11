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

  const [entries, stats, tasksRes] = await Promise.all([
    getTimeEntries(supabase, user.id, {
      date: typeof sp.date === "string" ? sp.date : undefined,
      category: typeof sp.category === "string" ? sp.category : undefined,
    }),
    getTimeStats(supabase, user.id),
    supabase.from("tasks").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Timesheet</h1>
        <p className="text-sm text-muted">Where did your time go?</p>
      </div>

      <TimeBoard entries={entries} stats={stats} tasks={tasksRes.data ?? []} />
    </div>
  );
}
