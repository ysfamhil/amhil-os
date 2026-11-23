"use server";

import { requireApprovedSession } from "@/lib/auth";
import { getTimelineEvents, type TimelineCursor, type TimelineFilters } from "@/lib/queries/timeline";

export async function loadMoreTimelineEvents(filters: TimelineFilters, cursor: TimelineCursor) {
  const { supabase, user } = await requireApprovedSession();

  return getTimelineEvents(supabase, user.id, filters, cursor);
}
