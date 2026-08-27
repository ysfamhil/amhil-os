import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNotes } from "@/lib/queries/notes";
import { NotesBoard } from "@/components/notes/notes-board";

export default async function NotesPage({
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
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const [notes, projectsRes, clientsRes, tasksRes, topicsRes, goalsRes] = await Promise.all([
    getNotes(supabase, user.id, { q }),
    supabase.from("projects").select("id,name").eq("user_id", user.id).order("name"),
    supabase.from("clients").select("id,name").eq("user_id", user.id).order("name"),
    supabase.from("tasks").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("learning_topics").select("id,name").eq("user_id", user.id).order("name"),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Notes</h1>
        <p className="text-sm text-muted">Notes connected to projects, clients, tasks, learning topics, and goals.</p>
      </div>

      <NotesBoard
        notes={notes}
        projects={projectsRes.data ?? []}
        clients={clientsRes.data ?? []}
        tasks={(tasksRes.data ?? []).map((t) => ({ id: t.id, name: t.title }))}
        topics={topicsRes.data ?? []}
        goals={(goalsRes.data ?? []).map((g) => ({ id: g.id, name: g.title }))}
      />
    </div>
  );
}
