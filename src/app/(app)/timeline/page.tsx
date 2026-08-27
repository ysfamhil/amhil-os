import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTimelineEvents, type TimelineFilters as TimelineFiltersInput } from "@/lib/queries/timeline";
import { resolveDateRange, isDateRangePreset, type DateRangePreset } from "@/lib/date-ranges";
import { TIMELINE_CATEGORIES, type TimelineCategory } from "@/lib/timeline";
import { TimelineFilters } from "@/components/timeline/timeline-filters";
import { TimelineList } from "@/components/timeline/timeline-list";

function isTimelineCategory(value: string): value is TimelineCategory {
  return (TIMELINE_CATEGORIES as readonly string[]).includes(value);
}

export default async function TimelinePage({
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

  const rangeParam = typeof sp.range === "string" && isDateRangePreset(sp.range) ? sp.range : "this_month";
  const range: DateRangePreset = rangeParam;
  const custom =
    typeof sp.start === "string" && typeof sp.end === "string" ? { start: sp.start, end: sp.end } : undefined;
  const resolvedRange = resolveDateRange(range, custom);

  const category = typeof sp.category === "string" && isTimelineCategory(sp.category) ? sp.category : undefined;
  const projectId = typeof sp.project === "string" ? sp.project : undefined;
  const entityType = typeof sp.entityType === "string" ? sp.entityType : undefined;

  const filters: TimelineFiltersInput = {
    category,
    projectId,
    entityType,
    start: resolvedRange.start,
    end: resolvedRange.end,
  };

  const [{ events, nextCursor }, projectsRes] = await Promise.all([
    getTimelineEvents(supabase, user.id, filters),
    supabase.from("projects").select("id,name").eq("user_id", user.id).order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-sm text-muted">A chronological history of everything meaningful you&apos;ve done.</p>
      </div>

      <TimelineFilters range={range} projects={projectsRes.data ?? []} />

      <TimelineList initialEvents={events} initialCursor={nextCursor} filters={filters} />
    </div>
  );
}
