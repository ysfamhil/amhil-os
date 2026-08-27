import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/queries/goals";
import { GoalsBoard } from "@/components/goals/goals-board";

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const goals = await getGoals(supabase, user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Goals</h1>
        <p className="text-sm text-muted">Measurable outcomes, connected to the work behind them.</p>
      </div>

      <GoalsBoard goals={goals} />
    </div>
  );
}
