import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAreaById } from "@/lib/queries/learning";
import { AreaDetailClient } from "@/components/learning/area-detail-client";

export default async function AreaDetailPage({ params }: { params: Promise<{ areaId: string }> }) {
  const { areaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [result, goalsRes] = await Promise.all([
    getAreaById(supabase, user.id, areaId),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  if (!result) {
    notFound();
  }

  return <AreaDetailClient area={result.area} topics={result.topics} goals={goalsRes.data ?? []} />;
}
