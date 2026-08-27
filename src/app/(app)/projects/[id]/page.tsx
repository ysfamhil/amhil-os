import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/queries/projects";
import { getSubtaskProgressMap, getTasks } from "@/lib/queries/tasks";
import { ProjectDetailClient, type ActivityItem } from "@/components/projects/project-detail-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const project = await getProjectById(supabase, user.id, id);
  if (!project) {
    notFound();
  }

  const [tasks, goalsRes] = await Promise.all([
    getTasks(supabase, user.id, { tab: "all", projectId: id, sort: "created_at" }),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
  ]);
  const subtaskProgress = await getSubtaskProgressMap(
    supabase,
    user.id,
    tasks.map((t) => t.id)
  );

  const activity: ActivityItem[] = tasks
    .flatMap((task) => {
      const items: ActivityItem[] = [
        { id: `${task.id}-created`, label: `Task created: ${task.title}`, at: task.created_at },
      ];
      if (task.completed_at) {
        items.push({ id: `${task.id}-completed`, label: `Task completed: ${task.title}`, at: task.completed_at });
      }
      return items;
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  return (
    <ProjectDetailClient
      project={project}
      tasks={tasks}
      subtaskProgress={subtaskProgress}
      activity={activity}
      goals={goalsRes.data ?? []}
    />
  );
}
