"use client";

import { Search } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import type { Notification } from "@/types/database";

export function TopBar({
  title,
  notifications = [],
  unreadCount = 0,
}: {
  title?: string;
  notifications?: Notification[];
  unreadCount?: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        {title && <h1 className="text-sm font-semibold md:text-base">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          aria-label="Search everything"
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-border/40 hover:text-foreground"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
        </button>
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        <ThemeToggle />
      </div>
    </header>
  );
}
