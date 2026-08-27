import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TimelineEvent } from "@/types/database";
import { TIMELINE_CATEGORY_BY_EVENT_TYPE, type TimelineCategory, type TimelineEventType } from "@/lib/timeline";

export interface TimelineFilters {
  category?: TimelineCategory;
  projectId?: string;
  entityType?: string;
  start?: string;
  end?: string;
}

export interface TimelineCursor {
  occurredAt: string;
  id: string;
}

export const TIMELINE_PAGE_SIZE = 30;

export async function getTimelineEvents(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters: TimelineFilters,
  cursor?: TimelineCursor | null
): Promise<{ events: TimelineEvent[]; nextCursor: TimelineCursor | null }> {
  let query = supabase.from("timeline_events").select("*").eq("user_id", userId);

  if (filters.category) {
    const eventTypes = (Object.keys(TIMELINE_CATEGORY_BY_EVENT_TYPE) as TimelineEventType[]).filter(
      (t) => TIMELINE_CATEGORY_BY_EVENT_TYPE[t] === filters.category
    );
    query = query.in("event_type", eventTypes);
  }
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.entityType) query = query.eq("related_entity_type", filters.entityType);
  if (filters.start) query = query.gte("occurred_at", `${filters.start}T00:00:00.000Z`);
  if (filters.end) query = query.lte("occurred_at", `${filters.end}T23:59:59.999Z`);

  // Keyset pagination on (occurred_at, id) — stable under concurrent inserts,
  // unlike offset pagination which can skip/duplicate rows as new events land.
  if (cursor) {
    query = query.or(
      `occurred_at.lt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.lt.${cursor.id})`
    );
  }

  query = query
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TIMELINE_PAGE_SIZE + 1);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as TimelineEvent[];
  const hasMore = rows.length > TIMELINE_PAGE_SIZE;
  const events = hasMore ? rows.slice(0, TIMELINE_PAGE_SIZE) : rows;
  const last = events[events.length - 1];
  const nextCursor = hasMore && last ? { occurredAt: last.occurred_at, id: last.id } : null;

  return { events, nextCursor };
}
