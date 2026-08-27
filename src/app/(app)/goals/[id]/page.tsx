import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGoalById } from "@/lib/queries/goals";
import { GoalDetailClient } from "@/components/goals/goal-detail-client";

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const goal = await getGoalById(supabase, user.id, id);
  if (!goal) {
    notFound();
  }

  return <GoalDetailClient goal={goal} />;
}
