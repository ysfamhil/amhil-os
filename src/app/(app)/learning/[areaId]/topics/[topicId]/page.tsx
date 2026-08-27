import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTopicById } from "@/lib/queries/learning";
import { TopicDetailClient } from "@/components/learning/topic-detail-client";

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ areaId: string; topicId: string }>;
}) {
  const { topicId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [result, goalsRes] = await Promise.all([
    getTopicById(supabase, user.id, topicId),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  if (!result) {
    notFound();
  }

  return (
    <TopicDetailClient
      topic={result.topic}
      area={result.area}
      sessions={result.sessions}
      goals={goalsRes.data ?? []}
    />
  );
}
