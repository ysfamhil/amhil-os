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

  const [notes, tasksRes, goalsRes] = await Promise.all([
    getNotes(supabase, user.id, { q }),
    supabase.from("tasks").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="h-[28px] w-[5px] shrink-0 rounded-full bg-[var(--domain-notes)]" />
        <div>
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em]">Notes</h1>
          <p className="mt-1.5 text-[13px] text-muted">Anything worth remembering, optionally linked to a task or goal.</p>
        </div>
      </div>

      <NotesBoard
        notes={notes}
        tasks={(tasksRes.data ?? []).map((t) => ({ id: t.id, name: t.title }))}
        goals={(goalsRes.data ?? []).map((g) => ({ id: g.id, name: g.title }))}
      />
    </div>
  );
}
