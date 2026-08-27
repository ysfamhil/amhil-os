import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SearchPageClient } from "@/components/search/search-page-client";

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted">
          Search across tasks, projects, goals, learning, habits, clients, leads, notes, and your timeline. Or press{" "}
          <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">⌘K</kbd> anywhere.
        </p>
      </div>

      <SearchPageClient />
    </div>
  );
}
