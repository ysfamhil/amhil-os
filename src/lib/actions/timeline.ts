"use server";

import { createClient } from "@/lib/supabase/server";
import { getTimelineEvents, type TimelineCursor, type TimelineFilters } from "@/lib/queries/timeline";

export async function loadMoreTimelineEvents(filters: TimelineFilters, cursor: TimelineCursor) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  return getTimelineEvents(supabase, user.id, filters, cursor);
}
