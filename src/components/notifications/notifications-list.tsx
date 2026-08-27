"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { Notification } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  task_overdue: "Overdue task",
  stale_project: "Stale project",
  habit_reminder: "Habit reminder",
  goal_deadline: "Goal deadline",
  payment_reminder: "Payment reminder",
  upcoming_deadline: "Upcoming deadline",
};

function hrefFor(n: Notification): string | null {
  switch (n.related_entity_type) {
    case "task":
      return "/tasks";
    case "project":
      return `/projects/${n.related_entity_id}`;
    case "habit":
      return "/habits";
    case "goal":
      return `/goals/${n.related_entity_id}`;
    case "income":
      return "/finance?tab=income";
    default:
      return null;
  }
}

export function NotificationsList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();

  async function handleClick(n: Notification) {
    if (!n.is_read) await markNotificationRead(n.id);
    const href = hrefFor(n);
    if (href) router.push(href);
    else router.refresh();
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    router.refresh();
  }

  if (notifications.length === 0) {
    return <EmptyState icon={Bell} title="No notifications" description="Overdue work, deadlines, and reminders will show up here." />;
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex flex-col gap-3">
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={handleMarkAll}
          className="inline-flex w-fit items-center gap-1.5 self-end rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-border/40"
        >
          <CheckCheck size={14} /> Mark all read
        </button>
      )}
      <div className="flex flex-col gap-2">
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={`cursor-pointer transition-opacity hover:opacity-90 ${n.is_read ? "opacity-60" : ""}`}
          >
            <button type="button" onClick={() => handleClick(n)} className="flex w-full flex-col gap-1 text-left">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={n.is_read ? "neutral" : "accent"}>{TYPE_LABELS[n.type] ?? n.type}</Badge>
                  <span className="font-medium">{n.title}</span>
                </div>
                <span className="shrink-0 text-xs text-muted">{new Date(n.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-muted">{n.message}</p>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
