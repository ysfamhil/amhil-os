import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLearningAreas, getLearningOverview } from "@/lib/queries/learning";
import { LearningOverviewClient } from "@/components/learning/learning-overview-client";

export default async function LearningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [areas, overview] = await Promise.all([
    getLearningAreas(supabase, user.id),
    getLearningOverview(supabase, user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Learning</h1>
        <p className="text-sm text-muted">Areas, topics, and study time that tracks your growth.</p>
      </div>

      <LearningOverviewClient areas={areas} overview={overview} />
    </div>
  );
}
