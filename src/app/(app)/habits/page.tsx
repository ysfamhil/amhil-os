import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHabits } from "@/lib/queries/habits";
import { HabitsGrid } from "@/components/habits/habits-grid";
import { addDaysISODate, startOfWeekISODate } from "@/lib/dates";

function weekDatesFrom(mondayISO: string): string[] {
  const monday = new Date(`${mondayISO}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => addDaysISODate(i, monday));
}

export default async function HabitsPage({
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
  const weekParam = typeof sp.week === "string" ? sp.week : undefined;
  const weekStart = weekParam ?? startOfWeekISODate();
  const weekDates = weekDatesFrom(weekStart);

  const [habits, goalsRes] = await Promise.all([
    getHabits(supabase, user.id, { weekDates }),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Habits</h1>
        <p className="text-sm text-muted">Did you do it today? A quick weekly tracking grid.</p>
      </div>

      <HabitsGrid habits={habits} goals={goalsRes.data ?? []} weekDates={weekDates} weekStart={weekStart} />
    </div>
  );
}
