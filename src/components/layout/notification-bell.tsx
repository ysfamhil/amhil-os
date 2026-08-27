"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { Notification } from "@/types/database";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell({ notifications, unreadCount }: { notifications: Notification[]; unreadCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleMarkAll() {
    await markAllNotificationsRead();
    router.refresh();
  }

  async function handleClickOne(n: Notification) {
    if (!n.is_read) await markNotificationRead(n.id);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:bg-border/40 hover:text-foreground"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-2 shadow-2xl">
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Notifications</p>
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAll} className="text-xs font-medium text-accent hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted">Nothing to see here.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClickOne(n)}
                    className={`block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-border/40 ${n.is_read ? "opacity-60" : ""}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{n.title}</span>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
                    </span>
                    <span className="block text-xs text-muted">{n.message}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border pt-1">
              <Link href="/notifications" onClick={() => setOpen(false)} className="block px-2 py-1.5 text-center text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
