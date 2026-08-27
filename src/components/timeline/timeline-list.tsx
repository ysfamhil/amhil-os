"use client";

import { useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TimelineEventIcon } from "@/components/timeline/timeline-event-icon";
import { loadMoreTimelineEvents } from "@/lib/actions/timeline";
import { resolveTimelineEventHref } from "@/lib/timeline";
import type { TimelineFilters, TimelineCursor } from "@/lib/queries/timeline";
import type { TimelineEvent } from "@/types/database";

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function groupByDay(events: TimelineEvent[]): { label: string; events: TimelineEvent[] }[] {
  const groups: { label: string; events: TimelineEvent[] }[] = [];
  for (const event of events) {
    const label = dayLabel(event.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.events.push(event);
    } else {
      groups.push({ label, events: [event] });
    }
  }
  return groups;
}

function EventRow({ event }: { event: TimelineEvent }) {
  const href = resolveTimelineEventHref(event);
  const content = (
    <div className="flex items-start gap-3">
      <TimelineEventIcon eventType={event.event_type} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{event.title}</p>
        {event.description && <p className="text-xs text-muted">{event.description}</p>}
      </div>
      <span className="shrink-0 text-xs text-muted">
        {new Date(event.occurred_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </span>
    </div>
  );

  if (!href) {
    return <div className="rounded-lg px-2 py-2">{content}</div>;
  }

  return (
    <Link href={href} className="block rounded-lg px-2 py-2 transition-colors hover:bg-border/40">
      {content}
    </Link>
  );
}

export function TimelineList({
  initialEvents,
  initialCursor,
  filters,
}: {
  initialEvents: TimelineEvent[];
  initialCursor: TimelineCursor | null;
  filters: TimelineFilters;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const { events: more, nextCursor } = await loadMoreTimelineEvents(filters, cursor);
      setEvents((prev) => [...prev, ...more]);
      setCursor(nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoading(false);
    }
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nothing here yet"
        description="Meaningful activity — completed tasks, logged sessions, new income — will show up here as it happens."
      />
    );
  }

  const groups = groupByDay(events);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</h3>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {group.events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      {cursor && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loading}
          className="self-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-border/40 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
