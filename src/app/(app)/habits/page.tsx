import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHabits } from "@/lib/queries/habits";
import { HabitsBoard } from "@/components/habits/habits-board";

export default async function HabitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [habits, goalsRes] = await Promise.all([
    getHabits(supabase, user.id),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Habits</h1>
        <p className="text-sm text-muted">Lightweight tracking with streaks and consistency.</p>
      </div>

      <HabitsBoard habits={habits} goals={goalsRes.data ?? []} />
    </div>
  );
}
