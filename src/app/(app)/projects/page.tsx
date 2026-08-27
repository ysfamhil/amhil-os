import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/lib/queries/projects";
import { ProjectsBoard } from "@/components/projects/projects-board";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [projects, goalsRes, clientsRes] = await Promise.all([
    getProjects(supabase, user.id),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("clients").select("id,name").eq("user_id", user.id).order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted">Meaningful work, tracked from idea to completion.</p>
      </div>

      <ProjectsBoard projects={projects} goals={goalsRes.data ?? []} clients={clientsRes.data ?? []} />
    </div>
  );
}
